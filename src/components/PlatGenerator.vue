<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { SettingOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import defaultData from '../templates/ticket_template.json';
import {
  buildParseRegex,
  renderTemplate,
  stripTextForMatch,
  type SymbolRule,
} from '../utils/textUtils.ts';

const defaultTemplates = defaultData.platTemplates as Record<string, string>;
const templateOptions = [
  { key: 'input', label: '投入', settingsLabel: '投入模板' },
  { key: 'exit', label: '退出', settingsLabel: '退出模板' },
  { key: 'checkInput', label: '检查投入', settingsLabel: '检查投入模板' },
  { key: 'checkExit', label: '检查退出', settingsLabel: '检查退出模板' },
  { key: 'measureInput', label: '测量后投入', settingsLabel: '测量后投入模板' },
] as const;

const props = defineProps<{
  symbolRules: SymbolRule[]
}>();

// ─── State ───────────────────────────────────────────────
const inputMode = ref<'basic' | 'parse'>('basic');
const operationType = ref<string>('input');
const screenName = ref<string>('');
const platText = ref<string>('');
const parseText = ref<string>('');
const outputLines = ref<any[]>([]);        // [{text: string, matched: boolean}]
const hasPromptedParseError = ref<boolean>(false);
const errorLineMsg = ref<string>('');

const normalizeTemplates = (value: unknown): Record<string, string> => {
  const normalized: Record<string, string> = { ...defaultTemplates };
  if (value && typeof value === 'object') {
    for (const option of templateOptions) {
      const template = (value as Record<string, unknown>)[option.key];
      if (typeof template === 'string') {
        normalized[option.key] = template;
      }
    }
  }
  return normalized;
};

const templates = reactive<Record<string, string>>({ ...defaultTemplates });
const isSettingsVisible = ref<boolean>(false);
const editingTemplates = reactive<Record<string, string>>({ ...defaultTemplates });

onMounted(() => {
  const saved = localStorage.getItem('ticketPlatTemplates');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const normalized = normalizeTemplates(parsed);
      Object.assign(templates, normalized);
      Object.assign(editingTemplates, normalized);
    } catch (e) {
      console.error('Failed to parse templates from localstorage', e);
    }
  }
});

// ─── 行级缓存 ────────────────────────────────────────────
const getScreenForReplace = () => inputMode.value === 'parse' ? '' : screenName.value.trim();

// 缓存 key 由"输入模式 + 操作类型 + 实际参与替换的屏名 + 模板配置"拼接，任意配置变化时自动失效
const basicLineCache = new Map<string, any>();   // platLine    -> { text, matched }
const parseLineCache = new Map<string, any>();   // strippedLine -> { text, matched }
let lastConfigKey: string | null = null;
const getConfigKey = () =>
  [inputMode.value, operationType.value, getScreenForReplace(),
   ...templateOptions.map(option => templates[option.key]), JSON.stringify(props.symbolRules)].join('\x01');

const removeInlineSpaces = () => {
  if (platText.value) {
    platText.value = platText.value.split('\n')
      .map(line => line.replace(/[\s\t\u00A0\u200B]+/g, ''))
      .join('\n');
    message.success('已去除行内所有空格与特殊空白字符');
  }
};

const generateText = () => {
  // ── 配置变化时清空缓存 ──
  const currentConfigKey = getConfigKey();
  if (currentConfigKey !== lastConfigKey) {
    basicLineCache.clear();
    parseLineCache.clear();
    lastConfigKey = currentConfigKey;
  }

  const currentTemplate = templates[operationType.value] ?? '';
  const screenForReplace = getScreenForReplace();

  // resultLines: [{text, matched}]
  const resultLines = [];

  if (inputMode.value === 'basic') {
    const lines = platText.value.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    for (const line of lines) {
      if (basicLineCache.has(line)) {
        // 此行内容未变化，直接复用缓存结果
        resultLines.push(basicLineCache.get(line));
      } else {
        const text = renderTemplate(currentTemplate, {
          screen: screenForReplace,
          plat: line,
        });
        const entry = { text, matched: true };
        basicLineCache.set(line, entry);
        resultLines.push(entry);
      }
    }
  } else {
    const rawLines = parseText.value.split('\n')
      .map(line => stripTextForMatch(line))
      .filter(line => line.length > 0);

    if (rawLines.length === 0) {
      outputLines.value = [];
      errorLineMsg.value = '';
      hasPromptedParseError.value = false;
      return;
    }

    // 正则懒初始化：只在有缓存未命中时才真正构建
    let regexes: RegExp[] | null = null;
    const getRegexes = () => {
      if (!regexes) {
        regexes = Object.values(templates).map(t => buildParseRegex(t, props.symbolRules, {
          literalPlaceholders: {
            screen: screenForReplace,
          },
        }));
      }
      return regexes;
    };

    let unmatchedCount = 0;
    for (const line of rawLines) {
      if (parseLineCache.has(line)) {
        // 此行内容未变化，直接复用缓存结果
        const cached = parseLineCache.get(line);
        if (!cached.matched) unmatchedCount++;
        resultLines.push(cached);
      } else {
        let platName = null;
        for (const rx of getRegexes()) {
          const m = line.match(rx);
          if (m?.groups?.plat) { platName = m.groups.plat; break; }
        }
        let entry;
        if (platName) {
          const text = renderTemplate(currentTemplate, {
            screen: screenForReplace,
            plat: platName,
          });
          entry = { text, matched: true };
        } else {
          // 未匹配：原样保留，标黄显示
          entry = { text: line, matched: false };
          unmatchedCount++;
        }
        parseLineCache.set(line, entry);
        resultLines.push(entry);
      }
    }

    errorLineMsg.value = unmatchedCount > 0
      ? `${unmatchedCount} 行无法匹配模板，已标黄显示`
      : '';
    hasPromptedParseError.value = false;
  }

  outputLines.value = resultLines;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch([operationType, screenName, platText, parseText, templates, inputMode, () => props.symbolRules], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(generateText, 300);
}, { deep: true });

// ─── Copy ─────────────────────────────────────────────
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

// ─── Settings ────────────────────────────────────────────
const openSettings = () => {
  Object.assign(editingTemplates, templates);
  isSettingsVisible.value = true;
};

const saveSettings = () => {
  const normalized = normalizeTemplates(editingTemplates);
  Object.assign(templates, normalized);
  Object.assign(editingTemplates, normalized);
  localStorage.setItem('ticketPlatTemplates', JSON.stringify(templates));
  isSettingsVisible.value = false;
  message.success('模板保存成功');
  generateText();
};

const resetSettingsToDefault = () => {
  Modal.confirm({
    title: '重置压板规则',
    content: '确定要将压板文本模板恢复为内置默认值吗？重置后需点击保存才会生效。',
    okText: '重置',
    cancelText: '取消',
    onOk() {
      Object.assign(editingTemplates, normalizeTemplates(defaultTemplates));
      message.success('已恢复默认规则，请点击保存生效');
    },
  });
};

const exportData = () => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(normalizeTemplates(editingTemplates), null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'plat_templates.json');
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const triggerImport = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object') {
          Object.assign(editingTemplates, normalizeTemplates(parsed));
          message.success('导入成功，请点击保存生效配置');
        } else {
          message.error('无效的JSON数据格式');
        }
      } catch { message.error('解析JSON结构失败'); }
    };
    reader.readAsText(file);
  };
  fileInput.click();
};
</script>

<template>
  <div class="plat-wrap">
    <a-card class="main-card" :bordered="false">
      <template #title>
        <div class="card-header">
          <span class="title-text">保护压板文本生成</span>
          <a-button type="text" @click="openSettings" title="模板配置">
            <template #icon><SettingOutlined style="font-size: 18px; color: #64748b;" /></template>
          </a-button>
        </div>
      </template>

      <a-form layout="vertical">
        <a-form-item label="操作类型">
          <a-radio-group v-model:value="operationType" button-style="solid">
            <a-radio-button v-for="option in templateOptions" :key="option.key" :value="option.key">
              {{ option.label }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="保护屏名 {screen}">
          <a-input
            v-model:value="screenName"
            placeholder="例如：110kV 主变保护屏"
            allowClear
            :disabled="inputMode === 'parse'"
          />
        </a-form-item>

        <a-form-item label="压板输入模式">
          <a-radio-group v-model:value="inputMode" button-style="solid">
            <a-radio-button value="basic">直接输入压板列表</a-radio-button>
            <a-radio-button value="parse">解析已有操作步骤</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <div v-show="inputMode === 'basic'">
          <div class="section-header">
            <span class="section-title">压板名称 {plat}（支持多行输入）</span>
            <a-button @click="removeInlineSpaces">去除行内空格</a-button>
          </div>
          <a-textarea v-model:value="platText" placeholder="请输入压板名称，每行一个。自动过滤空行及首尾空格..." :rows="6" allowClear />
        </div>

        <a-form-item label="已有完整文本（自动解析提取压板）" v-show="inputMode === 'parse'">
          <a-textarea v-model:value="parseText" placeholder="请输入已通过模板生成的完整文本，系统将尝试逆向提取..." :rows="6" allowClear />
          <div v-if="errorLineMsg" class="error-msg">{{ errorLineMsg }}</div>
        </a-form-item>

        <a-divider dashed style="margin: 16px 0;" />

        <div class="section-header">
          <span class="section-title">生成结果</span>
          <a-button type="primary" @click="copyOutput">
            <template #icon><CopyOutlined /></template>
            一键复制
          </a-button>
        </div>
        <div class="output-lines" v-if="outputLines.length">
          <div
            v-for="(item, i) in outputLines"
            :key="i"
            :class="['output-line', item.matched ? 'line-matched' : 'line-unmatched']"
          >{{ item.text }}</div>
        </div>
        <div v-else class="output-placeholder">生成的结果将显示在这里</div>
      </a-form>
    </a-card>

    <!-- Settings Modal -->
    <a-modal v-model:open="isSettingsVisible" title="模板配置" @ok="saveSettings" okText="保存" cancelText="取消" width="600px" centered>
      <div class="settings-hint">
        <p>提示：支持在模板中使用变量占位符<br/>
          <code>{screen}</code> 将被替换为保护屏名<br/>
          <code>{plat}</code> 将被替换为逐行的压板名称<br/>
          <code>{n}</code> 数值通配符：生成时渲染为空，解析时匹配任意数字（如 <code>Ia：{n}A</code> 可从 <code>Ia：0A</code> 中还原）
        </p>
      </div>
      <a-form layout="vertical">
        <a-form-item
          v-for="option in templateOptions"
          :key="option.key"
          :label="option.settingsLabel"
        >
          <a-textarea v-model:value="editingTemplates[option.key]" :rows="2" />
        </a-form-item>
      </a-form>
      <template #footer>
        <div class="modal-footer-actions">
          <div>
            <a-button @click="resetSettingsToDefault">
              <template #icon><ReloadOutlined /></template>
              重置规则
            </a-button>
            <a-button @click="exportData">导出 JSON</a-button>
            <a-button @click="triggerImport">导入 JSON</a-button>
          </div>
          <div>
            <a-button @click="isSettingsVisible = false">取消</a-button>
            <a-button type="primary" @click="saveSettings">保存</a-button>
          </div>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<style scoped>
.plat-wrap {
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
  background: -webkit-linear-gradient(45deg, #0ea5e9, #3b82f6);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 8px;
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
  margin-bottom: 20px;
  padding: 12px 16px;
  background-color: #f0f9ff;
  border-left: 4px solid #38bdf8;
  border-radius: 4px;
}
.settings-hint p { margin: 0; color: #334155; font-size: 14px; line-height: 1.6; }
.settings-hint code {
  background: #e0f2fe;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0284c7;
  font-family: Consolas, monospace;
}

.modal-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.modal-footer-actions > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  margin-top: 4px;
}
</style>
