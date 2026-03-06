<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { SettingOutlined, CopyOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import defaultData from '../templates/ticket_template.json';

const props = defineProps({
  tasks: { type: Array, required: true },
  onSaveTasks: { type: Function, required: true },
});

// ─── 全局状态名称 ─────────────────────────────────────────
const stateNames = ref([...defaultData.stateNames]);

onMounted(() => {
  const saved = localStorage.getItem('ticketTasks');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.stateNames) stateNames.value = parsed.stateNames;
    } catch (e) { /* ignore */ }
  }
});

// ─── UI State ────────────────────────────────────────────
const toStateIdx = ref(0);          // 目标状态索引
const inputText = ref('');
const outputText = ref('');
const outputLines = ref([]);        // [{text, matched}]
const errorMsg = ref('');
const matchLog = ref([]);           // [{line, taskName, fromState, toState}]
const isSettingsVisible = ref(false);

// 编辑用
const editingStateNames = ref([]);
const editingTasks = ref([]);
const activeTaskKeys = ref([]);

// ─── 核心：正则工具 ───────────────────────────────────────
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── 行级缓存 ────────────────────────────────────────────
// key: 去空白后的行文本；value: { result: {text,matched}, logEntry: {...}|null }
// 当目标状态或任务模板变化时清空缓存
const lineResultCache = new Map();
let lastConfigKey = null;
const getConfigKey = () => toStateIdx.value + '\x01' + JSON.stringify(props.tasks);

// 展位符列表：除 {n} 外均使用命名捕获组
// 在模板字符串中可用 {deviceName} / {a} / {b} / {c} 等任意单小写字母占位符
const PLACEHOLDER_RE = /\{([a-z][a-zA-Z0-9]*)\}/g;

const buildParseRegex = (template) => {
  // Step1: 保护 {n} 和各占位符, 去除空白
  let r = template
    .replace(/\{n\}/g, '\x00NUM\x00')
    .replace(PLACEHOLDER_RE, (_, name) => `\x00PH_${name}\x00`)
    .replace(/[\s\t\u00A0\u200B]+/g, '');
  // Step2: 转义其予内容
  r = escapeRegex(r);
  
  // 兼容中英文符号差异
  r = r.replace(/\\\(|\\\)|[（），、:：]/g, '[()（），、:：]*');
  // 兼容单位 A 和 小数
  r = r.replace(/\x00NUM\x00A?/g, '[\\d.]*A?');
  
  // Step3: 还原占位符为命名捕获组 / 数字通配
  r = r.replace(/\x00NUM\x00/g, '[\\d.]*');
  r = r.replace(/\x00PH_([a-zA-Z0-9]+)\x00/g, (_, name) => `(?<${name}>.+?)`);
  return new RegExp('^' + r + '$');
};

// captures: { deviceName: '...', a: '...', b: '...', ... }
const renderTemplate = (template, captures) => {
  let result = template;
  for (const [key, val] of Object.entries(captures)) {
    if (val !== undefined) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
  }
  return result.replace(/\{n\}/g, '   ');
};

// ─── 转换逻辑 ────────────────────────────────────────────
const convert = () => {
  // ── 配置变化时清空缓存 ──
  const currentConfigKey = getConfigKey();
  if (currentConfigKey !== lastConfigKey) {
    lineResultCache.clear();
    lastConfigKey = currentConfigKey;
  }

  const lines = inputText.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    outputLines.value = [];
    errorMsg.value = '';
    matchLog.value = [];
    return;
  }

  const targetIdx = toStateIdx.value;
  const resultLines = [];
  const log = [];

  // allPatterns 懒初始化：只在有缓存未命中时才构建
  let allPatterns = null;
  const getPatterns = () => {
    if (!allPatterns) {
      allPatterns = [];
      for (const task of props.tasks) {
        for (let si = 0; si < (task.templates || []).length; si++) {
          const tmpl = task.templates[si];
          if (!tmpl) continue;
          try {
            allPatterns.push({ task, si, rx: buildParseRegex(tmpl) });
          } catch { /* skip bad regex */ }
        }
      }
    }
    return allPatterns;
  };

  for (const line of lines) {
    const stripped = line.replace(/[\s\t\u00A0\u200B]+/g, '');

    if (lineResultCache.has(stripped)) {
      // 此行内容未变化，直接复用缓存结果（跳过所有正则匹配）
      const cached = lineResultCache.get(stripped);
      resultLines.push(cached.result);
      if (cached.logEntry) log.push(cached.logEntry);
      continue;
    }

    let matched = false;
    let cacheEntry = null;

    for (const { task, si, rx } of getPatterns()) {
      const m = stripped.match(rx);
      if (m) {
        const captures = {};
        if (m.groups) Object.assign(captures, m.groups);
        const targetTmpl = (task.templates || [])[targetIdx];
        if (targetTmpl) {
          const result = { text: renderTemplate(targetTmpl, captures), matched: true };
          const logEntry = {
            line,
            taskName: task.name,
            fromState: stateNames.value[si] ?? `状态${si + 1}`,
            toState: stateNames.value[targetIdx] ?? `状态${targetIdx + 1}`,
          };
          cacheEntry = { result, logEntry };
          resultLines.push(result);
          log.push(logEntry);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // 未匹配：原样保留，标记为 unmatched——展示时标黄
      const result = { text: line, matched: false };
      cacheEntry = { result, logEntry: null };
      resultLines.push(result);
    }

    lineResultCache.set(stripped, cacheEntry);
  }

  errorMsg.value = '';
  outputLines.value = resultLines;
  matchLog.value = log;
};

let debounceTimer = null;
watch([() => props.tasks, toStateIdx, inputText], () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(convert, 300);
}, { deep: true });

// ─── 复制 ─────────────────────────────────────────────
const copyOutput = async () => {
  const text = outputLines.value.map(l => l.text).join('\n');
  if (!text) { message.warning('没有可复制的内容'); return; }
  try {
    await navigator.clipboard.writeText(text);
    message.success('复制成功！');
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    message.success('复制成功！');
  }
};

// ─── 设置弹窗 ────────────────────────────────────────────
const openSettings = () => {
  editingStateNames.value = [...stateNames.value];
  editingTasks.value = JSON.parse(JSON.stringify(props.tasks));
  isSettingsVisible.value = true;
};

const addTask = () => {
  editingTasks.value.push({
    id: 'task_' + Date.now(),
    name: '新任务',
    templates: Array(stateNames.value.length).fill(''),
  });
};

const removeTask = (idx) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除任务「${editingTasks.value[idx].name}」吗？`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk() { editingTasks.value.splice(idx, 1); },
  });
};

const saveSettings = () => {
  // 确保每个任务的 templates 数组长度与 stateNames 对齐
  const ns = editingStateNames.value.length;
  const newTasks = editingTasks.value.map(t => ({
    ...t,
    templates: Array.from({ length: ns }, (_, i) => t.templates?.[i] ?? ''),
  }));

  stateNames.value = [...editingStateNames.value];
  props.onSaveTasks(newTasks, editingStateNames.value);
  isSettingsVisible.value = false;
  message.success('任务模板保存成功');
};

// ─── JSON 导出/导入 ──────────────────────────────────────
const exportTasks = () => {
  const data = { stateNames: editingStateNames.value, tasks: editingTasks.value };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'ticket_tasks.json');
  document.body.appendChild(a); a.click(); a.remove();
};

const triggerImport = () => {
  const fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.json';
  fi.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.stateNames) editingStateNames.value = parsed.stateNames;
        if (Array.isArray(parsed.tasks)) editingTasks.value = parsed.tasks;
        message.success('导入成功，请点击保存生效配置');
      } catch { message.error('解析 JSON 失败'); }
    };
    reader.readAsText(file);
  };
  fi.click();
};
</script>

<template>
  <div class="converter-wrap">
    <a-card class="main-card" :bordered="false">
      <template #title>
        <div class="card-header">
          <span class="title-text">操作步骤状态转换</span>
          <a-button type="text" @click="openSettings" title="任务模板配置">
            <template #icon><SettingOutlined style="font-size: 18px; color: #64748b;" /></template>
          </a-button>
        </div>
      </template>

      <a-form layout="vertical">
        <!-- 目标状态选择 -->
        <a-form-item label="目标状态（转换后的格式）">
          <a-radio-group v-model:value="toStateIdx" button-style="solid">
            <a-radio-button v-for="(name, idx) in stateNames" :key="idx" :value="idx">
              {{ name }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>

        <!-- 输入文本 -->
        <a-form-item label="输入文本（支持多行、多任务混合粘贴，自动识别来源）">
          <a-textarea
            v-model:value="inputText"
            placeholder="粘贴任意状态下的操作步骤文本，每行一条，系统将自动识别任务和来源状态..."
            :rows="7"
            allowClear
          />
        </a-form-item>

        <!-- 匹配日志（折叠） -->
        <a-collapse v-if="matchLog.length > 0" ghost style="margin-bottom: 12px;">
          <a-collapse-panel key="log" :header="`识别详情（共 ${matchLog.length} 条）`">
            <div class="match-log">
              <div v-for="(item, i) in matchLog" :key="i" class="log-item">
                <span class="log-idx">{{ i + 1 }}</span>
                <span class="log-task">{{ item.taskName }}</span>
                <span class="log-arrow">{{ item.fromState }} → {{ item.toState }}</span>
                <span class="log-line">{{ item.line }}</span>
              </div>
            </div>
          </a-collapse-panel>
        </a-collapse>

        <a-divider dashed style="margin: 8px 0 16px;" />

        <!-- 输出 -->
        <div class="section-header">
          <span class="section-title">转换结果</span>
          <a-button type="primary" @click="copyOutput">
            <template #icon><CopyOutlined /></template>
            一键复制
          </a-button>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div class="output-lines" v-if="outputLines.length">
          <div
            v-for="(item, i) in outputLines"
            :key="i"
            :class="['output-line', item.matched ? 'line-matched' : 'line-unmatched']"
          >{{ item.text }}</div>
        </div>
        <div v-else class="output-placeholder">转换结果将显示在这里</div>
      </a-form>
    </a-card>

    <!-- 设置弹窗 -->
    <a-modal
      v-model:open="isSettingsVisible"
      title="任务模板配置"
      width="720px"
      centered
      :footer="null"
    >
      <!-- 全局状态名称 -->
      <div class="settings-hint">
        <p>
          占位符：<code>{deviceName}</code> 设备名称 &nbsp;|&nbsp;
          <code>{n}</code> 数值通配符（解析时匹配任意数字及空格，生成时为4个空格）
        </p>
      </div>

      <a-form layout="vertical" style="margin-bottom: 16px;">
        <a-form-item label="全局状态名称（所有任务共用）">
          <a-space wrap>
            <a-input
              v-for="(name, idx) in editingStateNames"
              :key="idx"
              v-model:value="editingStateNames[idx]"
              :placeholder="`状态 ${idx + 1}`"
              style="width: 120px;"
              :addonBefore="idx + 1"
            />
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 任务列表 -->
      <a-collapse v-model:activeKey="activeTaskKeys" accordion>
        <a-collapse-panel v-for="(task, idx) in editingTasks" :key="task.id" :header="task.name || '（未命名任务）'">
          <template #extra>
            <a-button type="text" danger size="small" @click.stop="removeTask(idx)">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </template>
          <a-form layout="vertical">
            <a-form-item label="任务名称">
              <a-input v-model:value="task.name" placeholder="请输入任务名称" />
            </a-form-item>
            <a-form-item
              v-for="(stateName, si) in editingStateNames"
              :key="si"
              :label="`${stateName} 的模板`"
            >
              <a-textarea
                v-model:value="task.templates[si]"
                :rows="2"
                :placeholder="`例：检查{deviceName}已{n}切换至${stateName}`"
              />
            </a-form-item>
          </a-form>
        </a-collapse-panel>
      </a-collapse>

      <a-button type="dashed" block style="margin-top: 12px;" @click="addTask">
        <template #icon><PlusOutlined /></template>
        添加任务
      </a-button>

      <div class="modal-footer-actions" style="margin-top: 16px;">
        <div>
          <a-button @click="exportTasks">导出 JSON</a-button>
          <a-button @click="triggerImport" style="margin-left: 8px;">导入 JSON</a-button>
        </div>
        <div>
          <a-button @click="isSettingsVisible = false">取消</a-button>
          <a-button type="primary" @click="saveSettings" style="margin-left: 8px;">保存</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.converter-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.main-card {
  width: 100%;
  max-width: 860px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
  background: -webkit-linear-gradient(45deg, #059669, #10b981);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.section-title {
  font-weight: 600;
  font-size: 16px;
  color: #334155;
}

.output-lines {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  padding: 8px 0;
  min-height: 120px;
  max-height: 320px;
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
}

.output-line {
  padding: 3px 12px;
  word-break: break-all;
  white-space: pre-wrap;
  color: #0f172a;
  transition: background 0.15s;
}

.line-unmatched {
  background-color: #fef9c3;
  color: #b45309;
}

.output-placeholder {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 14px;
  padding: 32px 12px;
  text-align: center;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-hint {
  margin-bottom: 16px;
  padding: 10px 14px;
  background-color: #f0fdf4;
  border-left: 4px solid #34d399;
  border-radius: 4px;
}
.settings-hint p { margin: 0; color: #334155; font-size: 13px; line-height: 1.8; }
.settings-hint code {
  background: #d1fae5;
  padding: 1px 5px;
  border-radius: 3px;
  color: #059669;
  font-family: Consolas, monospace;
}

.modal-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 8px;
}

/* 匹配日志 */
.match-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}
.log-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #475569;
}
.log-idx {
  min-width: 20px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
.log-task {
  background: #e0f2fe;
  color: #0369a1;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.log-arrow {
  color: #059669;
  font-weight: 500;
  white-space: nowrap;
}
.log-line {
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
