<script setup lang="ts">
import { ref, watch } from 'vue';
import { SettingOutlined, CopyOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import {
  buildParseRegex,
  renderTemplate,
  clearVoltageCurrentText,
  getPrimaryTemplate,
  getTemplateVariants,
  stripTextForMatch,
  type SymbolRule,
} from '../utils/textUtils.ts';
import { getDefaultTaskSettings, normalizeSymbolRules, type Task } from '../utils/taskSettings.ts';

const props = defineProps<{
  tasks: Task[],
  stateNames: string[],
  symbolRules: SymbolRule[],
  onSaveTaskSettings: (t: Task[], s: string[], r: SymbolRule[]) => void
}>();

// ─── 全局状态名称 ─────────────────────────────────────────
const stateNames = ref<string[]>([...props.stateNames]);

// ─── UI State ────────────────────────────────────────────
const toStateIdx = ref<number>(0);          // 目标状态索引
const inputText = ref<string>('');
const outputLines = ref<any[]>([]);        // [{text, matched}]
const errorMsg = ref<string>('');
const matchLog = ref<any[]>([]);           // [{line, taskName, fromState, toState}]
const isSettingsVisible = ref<boolean>(false);

// 编辑用
const editingStateNames = ref<string[]>([]);
interface EditingTask {
  id: string;
  name: string;
  templates: string[];
}

interface EditingSymbolRule extends SymbolRule {
  variantsText: string;
}

const editingTasks = ref<EditingTask[]>([]);
const editingSymbolRules = ref<EditingSymbolRule[]>([]);
const activeTaskKeys = ref<string[]>([]);

// ─── 行级缓存 ────────────────────────────────────────────
// key:去空白后的行文本；value: { result: {text,matched}, logEntry: {...}|null }
// 当目标状态或任务模板变化时清空缓存
const lineResultCache = new Map<string, any>();
let lastConfigKey: string | null = null;
const getConfigKey = () => `${toStateIdx.value}\x01${JSON.stringify(props.tasks)}\x01${JSON.stringify(props.symbolRules)}`;

// ─── 清空电压电流 ────────────────────────────────────────
const clearVoltageCurrent = () => {
  if (!inputText.value) return;
  inputText.value = clearVoltageCurrentText(inputText.value);
  message.success('已清空电压电流数值');
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
  let allPatterns: { task: Task, si: number, rx: RegExp }[] | null = null;
  const getPatterns = () => {
    if (!allPatterns) {
      allPatterns = [];
      for (const task of props.tasks) {
        for (let si = 0; si < (task.templates || []).length; si++) {
          for (const tmpl of getTemplateVariants(task.templates[si])) {
            try {
              allPatterns.push({ task, si, rx: buildParseRegex(tmpl, props.symbolRules) });
            } catch { /* skip bad regex */ }
          }
        }
      }
    }
    return allPatterns;
  };

  for (const line of lines) {
    const stripped = stripTextForMatch(line);

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
        const captures: Record<string, string | undefined> = {};
        if (m.groups) Object.assign(captures, m.groups);
        const targetTmpl = getPrimaryTemplate((task.templates || [])[targetIdx]);
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

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch([() => props.tasks, () => props.symbolRules, () => props.stateNames], () => {
  stateNames.value = [...props.stateNames];
}, { deep: true });

watch([() => props.tasks, () => props.symbolRules, toStateIdx, inputText], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
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
  editingStateNames.value = [...props.stateNames];
  editingTasks.value = props.tasks.map(taskToEditingTask);
  editingSymbolRules.value = props.symbolRules.map(symbolRuleToEditingRule);
  isSettingsVisible.value = true;
};

const addTask = () => {
  editingTasks.value.push({
    id: 'task_' + Date.now(),
    name: '新任务',
    templates: Array(stateNames.value.length).fill(''),
  });
};

const templateEntryToText = (entry: Task['templates'][number] | undefined): string => {
  if (Array.isArray(entry)) return entry.join('\n');
  return entry ?? '';
};

const textToTemplateEntry = (text: string): Task['templates'][number] => {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length > 1) {
    return lines;
  }
  return lines[0] ?? '';
};

const taskToEditingTask = (task: Task): EditingTask => ({
  id: task.id,
  name: task.name,
  templates: task.templates.map(templateEntryToText),
});

const createSymbolRule = (): EditingSymbolRule => ({
  id: `symbol_rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label: '新符号规则',
  canonical: '',
  variants: [],
  variantsText: '',
});

const addSymbolRule = () => {
  editingSymbolRules.value.push(createSymbolRule());
};

const removeSymbolRule = (idx: number) => {
  editingSymbolRules.value.splice(idx, 1);
};

const symbolRuleVariantsToText = (variants: string[]): string => variants.join(' | ');

const parseSymbolRuleVariants = (value: string): string[] => {
  return value
    .split(/[\n\r|]+/g)
    .map(item => item.trim())
    .filter(item => item.length > 0);
};

const symbolRuleToEditingRule = (rule: SymbolRule): EditingSymbolRule => ({
  ...rule,
  variantsText: symbolRuleVariantsToText(rule.variants),
});

const removeTask = (idx: number) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除任务「${editingTasks.value[idx].name}」吗？`,
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk() { editingTasks.value.splice(idx, 1); },
  });
};

const saveSettings = () => {
  const normalizedSymbolRules = normalizeSymbolRules(
    editingSymbolRules.value.map(rule => ({
      id: rule.id,
      label: rule.label,
      canonical: rule.canonical,
      variants: parseSymbolRuleVariants(rule.variantsText),
    })),
    [],
  );
  // 确保每个任务的 templates 数组长度与 stateNames 对齐
  const ns = editingStateNames.value.length;
  const newTasks = editingTasks.value.map(t => ({
    ...t,
    templates: Array.from({ length: ns }, (_, i) => textToTemplateEntry(t.templates?.[i] ?? '')),
  }));

  stateNames.value = [...editingStateNames.value];
  props.onSaveTaskSettings(newTasks, editingStateNames.value, normalizedSymbolRules);
  isSettingsVisible.value = false;
  message.success('任务模板保存成功');
};

const resetSettingsToDefault = () => {
  const defaults = getDefaultTaskSettings();
  Modal.confirm({
    title: '重置步骤转换规则',
    content: '确定要将步骤转换的状态名称、任务模板和全局符号兼容规则恢复为内置默认值吗？重置后需点击保存才会生效。',
    okText: '重置',
    cancelText: '取消',
    onOk() {
      editingStateNames.value = [...defaults.stateNames];
      editingTasks.value = defaults.tasks.map(taskToEditingTask);
      editingSymbolRules.value = defaults.symbolRules.map(symbolRuleToEditingRule);
      message.success('已恢复默认规则，请点击保存生效');
    },
  });
};

// ─── JSON 导出/导入 ──────────────────────────────────────
const exportTasks = () => {
  const data = {
    stateNames: editingStateNames.value,
    tasks: editingTasks.value.map(task => ({
      ...task,
      templates: task.templates.map(textToTemplateEntry),
    })),
    symbolRules: normalizeSymbolRules(
      editingSymbolRules.value.map(rule => ({
        id: rule.id,
        label: rule.label,
        canonical: rule.canonical,
        variants: parseSymbolRuleVariants(rule.variantsText),
      })),
      [],
    ),
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'ticket_tasks.json');
  document.body.appendChild(a); a.click(); a.remove();
};

const triggerImport = () => {
  const fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.json';
  fi.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const parsed = JSON.parse(result);
        if (parsed.stateNames) editingStateNames.value = parsed.stateNames;
        if (Array.isArray(parsed.tasks)) editingTasks.value = parsed.tasks.map(taskToEditingTask);
        if (Array.isArray(parsed.symbolRules)) {
          editingSymbolRules.value = normalizeSymbolRules(parsed.symbolRules, []).map(symbolRuleToEditingRule);
        }
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
        <a-form-item>
          <template #label>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span>输入文本（支持多行、多任务混合粘贴，自动识别来源）</span>
              <a-button size="small" @click="clearVoltageCurrent">清空电压电流</a-button>
            </div>
          </template>
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
      width="880px"
      centered
      :footer="null"
    >
      <!-- 全局状态名称 -->
      <div class="settings-hint">
        <p>
          占位符：<code>{deviceName}</code> 设备名称 &nbsp;|&nbsp;
          <code>{n}</code> 数值通配符（解析时匹配任意数字及空格，生成时为4个空格）<br />
          全局符号兼容规则只影响识别，不会改写模板正文；最终输出始终以主模板中的符号为准。
        </p>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">全局状态名称</div>
        <div class="state-name-grid">
          <div v-for="(_, idx) in editingStateNames" :key="idx" class="state-name-item">
            <div class="compact-field-label">状态 {{ idx + 1 }}</div>
            <a-input
              v-model:value="editingStateNames[idx]"
              :placeholder="`状态 ${idx + 1}`"
              size="small"
            />
          </div>
        </div>
      </div>

      <div class="settings-section">
      <div class="symbol-rules-header">
        <div>
          <div class="symbol-rules-title">全局符号兼容规则</div>
          <div class="symbol-rules-subtitle">用于统一识别英文/中文等价符号，输出仍以模板中的规范符号为准。</div>
        </div>
        <a-button type="dashed" @click="addSymbolRule">
          <template #icon><PlusOutlined /></template>
          添加符号规则
        </a-button>
      </div>

      <div class="symbol-rule-list" v-if="editingSymbolRules.length > 0">
        <div class="symbol-rule-columns">
          <span></span>
          <span>规则名</span>
          <span>规范输出</span>
          <span>兼容识别符号</span>
          <span></span>
        </div>
        <div v-for="(rule, idx) in editingSymbolRules" :key="rule.id" class="symbol-rule-card">
          <div class="symbol-rule-index">#{{ idx + 1 }}</div>
          <div class="symbol-rule-fields">
            <div class="compact-field">
              <div class="compact-field-label mobile-only">规则名</div>
              <a-input v-model:value="rule.label" placeholder="例如：中文左引号" size="small" />
            </div>
            <div class="compact-field compact-field-canonical">
              <div class="compact-field-label mobile-only">规范输出</div>
              <a-input v-model:value="rule.canonical" placeholder="例如：“" maxlength="8" size="small" />
            </div>
            <div class="compact-field compact-field-variants">
              <div class="compact-field-label mobile-only">兼容识别符号</div>
              <a-input v-model:value="rule.variantsText" placeholder='例如：" | “ | ”' size="small" />
            </div>
          </div>
          <div class="symbol-rule-actions">
            <a-button type="text" danger size="small" @click="removeSymbolRule(idx)">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </div>
        </div>
      </div>
      <div v-else class="symbol-rule-empty">当前没有符号兼容规则，解析时将只按模板中的原始符号严格匹配。</div>
      </div>

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
                class="template-textarea"
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
          <a-button @click="resetSettingsToDefault">
            <template #icon><ReloadOutlined /></template>
            重置规则
          </a-button>
          <a-button @click="exportTasks">导出 JSON</a-button>
          <a-button @click="triggerImport">导入 JSON</a-button>
        </div>
        <div>
          <a-button @click="isSettingsVisible = false">取消</a-button>
          <a-button type="primary" @click="saveSettings">保存</a-button>
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

.settings-section {
  margin-bottom: 16px;
}

.settings-section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.state-name-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.state-name-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-footer-actions > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 8px;
}

.symbol-rules-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.symbol-rules-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.symbol-rules-subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.symbol-rule-list {
  display: grid;
  gap: 8px;
}

.symbol-rule-columns,
.symbol-rule-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 2fr) 110px minmax(0, 2.2fr) 40px;
  gap: 8px;
  align-items: center;
}

.symbol-rule-columns {
  padding: 0 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.symbol-rule-card {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px;
  background: #f8fbff;
}

.symbol-rule-index {
  color: #1e3a8a;
  font-size: 12px;
  font-weight: 700;
}

.symbol-rule-fields {
  display: contents;
}

.compact-field {
  min-width: 0;
}

.compact-field-label {
  margin-bottom: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.compact-field-canonical :deep(.ant-input) {
  font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif;
  font-size: 16px;
  font-variant-ligatures: none;
  letter-spacing: 0.02em;
  text-align: center;
}

.compact-field-variants :deep(.ant-input) {
  font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif;
  font-size: 15px;
  font-variant-ligatures: none;
  letter-spacing: 0.02em;
}

.template-textarea :deep(.ant-input) {
  font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif;
  font-size: 15px;
  line-height: 1.65;
  font-variant-ligatures: none;
  letter-spacing: 0.02em;
}

.symbol-rule-actions {
  display: flex;
  justify-content: flex-end;
}

.mobile-only {
  display: none;
}

.symbol-rule-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 14px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 760px) {
  .symbol-rules-header,
  .modal-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .symbol-rule-columns {
    display: none;
  }

  .symbol-rule-card {
    grid-template-columns: 40px minmax(0, 1fr) 36px;
    align-items: start;
  }

  .symbol-rule-fields {
    display: grid;
    gap: 8px;
  }

  .compact-field-canonical {
    max-width: 120px;
  }

  .mobile-only {
    display: block;
  }
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
