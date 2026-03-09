<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import {
  FontSizeOutlined,
  UndoOutlined,
  RedoOutlined,
  DeleteOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import defaultData from '../templates/ticket_template.json';
import { buildParseRegex, renderTemplate, clearVoltageCurrentText } from '../utils/textUtils';

// ─── Props ─────────────────────────────────────────
const props = defineProps({
  tasks: { type: Array, required: true },
});

// ─── 状态数据 ──────────────────────────────────────
const textContent = ref('');
const fontSize = ref(14); // 默认字号 14px
const textareaRef = ref(null);
const highlightLayerRef = ref(null);
const highlightedLines = ref(new Set());

const escapeHtml = (unsafe) => {
  return (unsafe || '').replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
};

const highlightedHTML = computed(() => {
  const lines = textContent.value.split('\n');
  return lines.map((line, idx) => {
    const escaped = escapeHtml(line);
    if (highlightedLines.value.has(idx)) {
      return `<mark class="highlight-mark">${escaped || ' '}</mark>`;
    }
    return escaped;
  }).join('\n');
});

const clearHighlight = () => {
  if (highlightedLines.value.size > 0) {
    highlightedLines.value.clear();
  }
};

const syncScroll = () => {
  if (textareaRef.value && highlightLayerRef.value) {
    highlightLayerRef.value.scrollTop = textareaRef.value.scrollTop;
    highlightLayerRef.value.scrollLeft = textareaRef.value.scrollLeft;
  }
};

// -- 历史记录与防抖 --
const historyStack = ref([]);
const redoStack = ref([]);
let isUndoRedoAction = false;

// -- 常量和工具 --
const MAX_FONT_SIZE = 32;
const MIN_FONT_SIZE = 12;
const SAVE_INTERVAL_MS = 10000;
let saveTimer = null;

// -- 右键菜单状态 --
const contextMenuStore = ref({
  visible: false,
  x: 0,
  y: 0,
});
const contextMenuRef = ref(null); // 指向菜单 DOM 节点

// 从 ticket_template.json 读取作为默认 fallback，再从 localStorage 中恢复
const stateNames = ref([...defaultData.stateNames]);

// 获取所有的待匹配正则项
const getAllPatterns = () => {
  const patterns = [];
  for (const task of props.tasks) {
    for (let si = 0; si < (task.templates || []).length; si++) {
      const tmpl = task.templates[si];
      if (!tmpl) continue;
      try {
        patterns.push({ task, si, rx: buildParseRegex(tmpl) });
      } catch { /* skip bad regex */ }
    }
  }
  return patterns;
};

// ─── 方法实现 ─────────────────────────────────────
const increaseFontSize = () => {
  if (fontSize.value < MAX_FONT_SIZE) fontSize.value += 2;
};

const decreaseFontSize = () => {
  if (fontSize.value > MIN_FONT_SIZE) fontSize.value -= 2;
};

// -- 历史记录快照 --
const saveHistorySnapshot = (content, selStart, selEnd) => {
  if (isUndoRedoAction) return; // 回退时不要重复压栈
  // 如果当前内容与上一次一致，则忽略
  if (historyStack.value.length > 0) {
    const last = historyStack.value[historyStack.value.length - 1];
    if (last.text === content) return;
  }
  historyStack.value.push({ text: content, start: selStart, end: selEnd });
  // 如果超出限制则丢弃最早的一条
  if (historyStack.value.length > 50) historyStack.value.shift();
  // 发生新的操作时，重置重做栈
  redoStack.value = [];
};

// 拦截文本区域直接输入
const onTextareaInput = () => {
  if (isUndoRedoAction) {
    isUndoRedoAction = false;
    return;
  }
  const el = textareaRef.value;
  saveHistorySnapshot(el.value, el.selectionStart, el.selectionEnd);
};

const execUndo = () => {
  if (historyStack.value.length <= 1) return; // 至少留一层初始状态
  isUndoRedoAction = true;
  const current = historyStack.value.pop();
  redoStack.value.push(current);
  
  const prev = historyStack.value[historyStack.value.length - 1];
  textContent.value = prev.text;
  clearHighlight();
  
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.setSelectionRange(prev.start, prev.end);
      textareaRef.value.focus();
    }
    isUndoRedoAction = false;
  });
};

const execRedo = () => {
  if (redoStack.value.length === 0) return;
  isUndoRedoAction = true;
  const nextTarget = redoStack.value.pop();
  historyStack.value.push(nextTarget);
  
  textContent.value = nextTarget.text;
  clearHighlight();
  
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.setSelectionRange(nextTarget.start, nextTarget.end);
      textareaRef.value.focus();
    }
    isUndoRedoAction = false;
  });
};

const clearContent = () => {
  if (!textContent.value) return;
  Modal.confirm({
    title: '确认清空',
    content: '确定要清空编辑器中的所有文本吗？此操作不可撤销。',
    okText: '清空',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      // 在清空前保存快照以便用户可以通过撤销找回
      saveHistorySnapshot(textContent.value, 0, 0);
      textContent.value = '';
      clearHighlight();
      saveHistorySnapshot('', 0, 0); // 空状态也需要成为新起点
      message.success('已清空内容');
    },
  });
};

const saveToLocal = () => {
  localStorage.setItem('ticketEditorContent', textContent.value);
};

// ─── 核心：状态转换 ─────────────────────────────────────
const handleConvertState = (targetIdx) => {
  if (!textareaRef.value) return;
  const el = textareaRef.value;
  const rawText = textContent.value;
  
  const selStart = el.selectionStart;
  const selEnd = el.selectionEnd;
  
  // 基于选区，找到所涉及的完整行
  // 哪怕只有一个光标点(selStart===selEnd)，这依然能找到当前行的起点和终点
  let lineStart = rawText.lastIndexOf('\n', selStart - 1) + 1;
  let lineEnd = rawText.indexOf('\n', selEnd);
  if (lineEnd === -1) lineEnd = rawText.length;
  // 如果选区正好停留在行首（比如选中了两行但结束在第三行行首），则将其修正回上一行结尾（避免误判处理下一行）
  // 除非 selStart === selEnd
  if (selStart !== selEnd && selEnd > 0 && rawText[selEnd - 1] === '\n') {
    lineEnd = selEnd - 1;
  }
  
  const selectedTextOriginal = rawText.substring(lineStart, lineEnd);
  const lines = selectedTextOriginal.split('\n');
  const allPatterns = getAllPatterns();
  
  let startLineIdx = 0;
  for (let i = 0; i < lineStart; i++) {
    if (rawText[i] === '\n') startLineIdx++;
  }
  
  let matchedCount = 0;
  let changedCount = 0;
  const newHighlights = new Set();
  
  const newLines = lines.map((line, idx) => {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) return trimmedLine; 

    const strippedForMatch = trimmedLine.replace(/[\s\t\u00A0\u200B]+/g, '');
    let matched = false;
    let convertedLine = trimmedLine;

    for (const { task, rx } of allPatterns) {
      const m = strippedForMatch.match(rx);
      if (m) {
        const captures = {};
        if (m.groups) Object.assign(captures, m.groups);
        const targetTmpl = (task.templates || [])[targetIdx];
        if (targetTmpl) {
          convertedLine = renderTemplate(targetTmpl, captures);
          matched = true;
          break;
        }
      }
    }
    
    const finalLine = matched ? convertedLine : trimmedLine;
    if (matched) {
      matchedCount++;
    }
    if (finalLine !== line) {
      changedCount++;
      newHighlights.add(startLineIdx + idx);
    }
    
    return finalLine;
  });
  
  if (matchedCount === 0 && lines.some(l => l.trim() !== '')) {
    message.warning('未匹配到相应的规则');
  } else if (matchedCount > 0) {
    message.success(`匹配到 ${matchedCount} 行，修改了 ${changedCount} 行`);
  }

  const replacementText = newLines.join('\n');
  
  if (selectedTextOriginal === replacementText) {
    clearHighlight();
    return;
  }
  
  highlightedLines.value = newHighlights;

  // 记录 Undo
  saveHistorySnapshot(rawText, selStart, selEnd);
  
  // 拼接新文本
  const newFullText = rawText.substring(0, lineStart) + replacementText + rawText.substring(lineEnd);
  textContent.value = newFullText;
  
  const newSelectionEnd = lineStart + replacementText.length;
  // 更新记录
  saveHistorySnapshot(newFullText, lineStart, newSelectionEnd);

  // Vue tick 渲染后修正光标
  nextTick(() => {
    if (el) {
      el.setSelectionRange(lineStart, newSelectionEnd);
      el.focus();
    }
  });
};

// ─── 快捷键转换机制 ─────────────────────────────────────
const handleKeyDown = (e) => {
  // 当发生除修饰键以外的大部分正常输入或移动时，取消高亮
  if (e.key !== 'Alt' && e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Meta') {
    clearHighlight();
  }

  if (e.altKey && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key, 10) - 1;
    if (idx >= 0 && idx < stateNames.value.length) {
      e.preventDefault();
      handleConvertState(idx);
    }
  }
};

onMounted(() => {
  const savedTasks = localStorage.getItem('ticketTasks');
  if (savedTasks) {
    try {
      const parsed = JSON.parse(savedTasks);
      if (parsed.stateNames) stateNames.value = parsed.stateNames;
    } catch (e) { /* ignore */ }
  }

  const savedContent = localStorage.getItem('ticketEditorContent');
  if (savedContent) {
    textContent.value = savedContent;
  }

  // 初始快照
  saveHistorySnapshot(textContent.value, 0, 0);
  isUndoRedoAction = false;

  saveTimer = setInterval(saveToLocal, SAVE_INTERVAL_MS);
  document.addEventListener('click', hideContextMenu);
});

onUnmounted(() => {
  if (saveTimer) clearInterval(saveTimer);
  document.removeEventListener('click', hideContextMenu);
});

// ─── 右键菜单 ─────────────────────────────────────────────
const hideContextMenu = () => {
  contextMenuStore.value.visible = false;
};

const handleContextMenu = (e) => {
  // 如果选中了文本，确保右键不会让光标丢失
  // 显示自定义菜单
  let startX = e.clientX;
  let startY = e.clientY;
  
  contextMenuStore.value = {
    visible: true,
    x: startX,
    y: startY,
  };

  // 通过 nextTick 计算 DOM 大小修正坐标以免超出屏幕
  nextTick(() => {
    if (contextMenuRef.value) {
      const menuRect = contextMenuRef.value.getBoundingClientRect();
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      
      let safeX = startX;
      let safeY = startY;
      
      // 若右侧越界，则反向弹出
      if (startX + menuRect.width > ww) {
        safeX = ww - menuRect.width - 8;
      }
      // 若下方越界，则向上弹出
      if (startY + menuRect.height > wh) {
        safeY = wh - menuRect.height - 8;
      }
      
      contextMenuStore.value.x = safeX;
      contextMenuStore.value.y = safeY;
    }
  });
};

const contextMenuUndo = () => {
  execUndo();
  hideContextMenu();
};

const contextMenuRedo = () => {
  execRedo();
  hideContextMenu();
};

const contextMenuConvert = (idx) => {
  handleConvertState(idx);
  hideContextMenu();
};

const clearVoltageCurrent = () => {
  if (!textContent.value) return;
  const oldText = textContent.value;
  const newText = clearVoltageCurrentText(oldText);

  if (oldText !== newText) {
    const el = textareaRef.value;
    saveHistorySnapshot(oldText, el ? el.selectionStart : 0, el ? el.selectionEnd : 0);
    textContent.value = newText;
    nextTick(() => {
      if (textareaRef.value) {
        saveHistorySnapshot(newText, textareaRef.value.selectionStart, textareaRef.value.selectionEnd);
      }
    });
    message.success('已清空电压电流数值');
  } else {
    message.info('没有匹配到需要清空的电压电流内容');
  }
};

// TODO: 方法声明 (字号调整、清除、撤销、重做、转换)

</script>

<template>
  <div class="editor-wrap">
    <a-card class="main-card" :bordered="false">
      <!-- 头部：标题与清空按钮 -->
      <template #title>
        <div class="card-header">
          <span class="title-text">操作票编辑</span>
          <a-button type="text" danger @click="clearContent" title="清空全部">
            <template #icon><DeleteOutlined style="font-size: 18px;" /></template>
          </a-button>
        </div>
      </template>

      <a-form layout="vertical">
        <a-form-item label="操作工具栏（可直接对选中的文本行进行状态转换）" style="margin-bottom: 12px">
          <a-space wrap>
            <a-button-group>
              <a-tooltip title="增大字号">
                <a-button @click="increaseFontSize">A+</a-button>
              </a-tooltip>
              <a-tooltip title="减小字号">
                <a-button @click="decreaseFontSize">A-</a-button>
              </a-tooltip>
            </a-button-group>

            <a-button-group>
              <a-tooltip title="撤销">
                <a-button @click="execUndo" :disabled="historyStack.length <= 1"><template #icon><UndoOutlined /></template></a-button>
              </a-tooltip>
              <a-tooltip title="重做">
                <a-button @click="execRedo" :disabled="redoStack.length === 0"><template #icon><RedoOutlined /></template></a-button>
              </a-tooltip>
            </a-button-group>

            <a-button @click="clearVoltageCurrent">清空电压电流</a-button>
            
            <a-button-group class="action-buttons">
              <a-button v-for="(name, idx) in stateNames" :key="idx" type="default" @click="handleConvertState(idx)">
                {{ name }}
              </a-button>
            </a-button-group>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 编辑主体 -->
      <div class="editor-body">
        <div class="highlight-layer" aria-hidden="true" ref="highlightLayerRef" :style="{ fontSize: `${fontSize}px` }" v-html="highlightedHTML"></div>
        <textarea
          ref="textareaRef"
          v-model="textContent"
          class="custom-textarea"
          :style="{ fontSize: `${fontSize}px` }"
          placeholder="在此直接输入或粘贴操作步骤文本...&#10;您可以使用上方工具栏或右键菜单直接对所选行进行状态转换。&#10;支持开关、刀闸、空开、压板、远方就地的状态转换。&#10;快捷键提示：使用 Alt + 1/2/3/4 可快速进行状态转换"
          @input="onTextareaInput"
          @click="clearHighlight"
          @scroll="syncScroll"
          @contextmenu.prevent="handleContextMenu"
          @keydown="handleKeyDown"
        ></textarea>
      </div>
      
      <!-- 右键菜单 -->
      <Teleport to="body">
        <Transition name="menu-fade">
          <div
            v-if="contextMenuStore.visible"
            ref="contextMenuRef"
            class="context-menu"
            :style="{ top: `${contextMenuStore.y}px`, left: `${contextMenuStore.x}px` }"
            @click.stop
          >
            <div class="menu-item" @click="contextMenuUndo" :class="{ 'menu-disabled': historyStack.length <= 1 }">
              <UndoOutlined class="menu-icon" /> 撤销
            </div>
            <div class="menu-item" @click="contextMenuRedo" :class="{ 'menu-disabled': redoStack.length === 0 }">
              <RedoOutlined class="menu-icon" /> 重做
            </div>
            <div class="menu-divider"></div>
            <div
              v-for="(name, idx) in stateNames"
              :key="idx"
              class="menu-item menu-item-action"
              @click="contextMenuConvert(idx)"
            >
              <ThunderboltOutlined class="menu-icon menu-icon-action" /> 转换为 {{ name }}
            </div>
          </div>
        </Transition>
      </Teleport>
    </a-card>
  </div>
</template>

<style scoped>
.editor-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0;
  height: calc(100vh - 120px); /* 让页面撑满剩余空间 */
}

.main-card {
  width: 100%;
  max-width: 860px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

/* 覆盖 ant-card-body，使内容区撑满 */
:deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
  background: -webkit-linear-gradient(45deg, #6366f1, #8b5cf6);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.action-buttons .ant-btn {
  color: #0369a1;
  border-color: #bae6fd;
  background-color: #f0f9ff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.action-buttons .ant-btn:hover {
  background-color: #e0f2fe;
  border-color: #7dd3fc;
  color: #0284c7;
  transform: translateY(-1px);
}

.editor-body {
  flex: 1;
  display: flex;
  min-height: 400px;
  position: relative;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background-color: #f8fafc;
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.editor-body:focus-within {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  background-color: #ffffff;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 16px;
  margin: 0;
  border: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: transparent;
  pointer-events: none;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1;
}

.highlight-layer::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.highlight-layer::-webkit-scrollbar-track {
  background: transparent;
}
.highlight-layer::-webkit-scrollbar-thumb {
  background-color: transparent;
}

:deep(.highlight-mark) {
  background-color: #ff9100; /* 淡橙色 (Tailwind orange-100) */
  border-radius: 2px;
  color: transparent;
}

.custom-textarea {
  position: relative;
  z-index: 2;
  flex: 1;
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.6;
  color: #1e293b;
  background-color: transparent;
  outline: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 修改文字选中状态的背景色，使用半透明蓝色以免完全遮挡底部的绿色高亮 */
.custom-textarea::selection {
  background-color: rgba(56, 189, 248, 0.3); /* 半透明的尾风蓝 */
}

/* 滚动条美化 */
.custom-textarea::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-textarea::-webkit-scrollbar-track {
  background: transparent;
}
.custom-textarea::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.custom-textarea::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* ── 右键悬浮菜单 ── */
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 6px 0;
  transform-origin: top left;
}

.menu-item {
  padding: 8px 16px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.menu-item:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.menu-item-action {
  color: #0369a1;
}

.menu-item-action:hover {
  background-color: #e0f2fe;
}

.menu-icon {
  margin-right: 8px;
}
.menu-icon-action {
  color: #38bdf8;
}

.menu-disabled {
  color: #94a3b8;
  cursor: not-allowed;
}
.menu-disabled:hover {
  background-color: transparent;
  color: #94a3b8;
}

.menu-divider {
  height: 1px;
  background-color: #e2e8f0;
  margin: 4px 0;
}

/* 菜单弹窗动画 */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
