import defaultData from '../templates/ticket_template.json';
import { storageKey } from '../config/appConfig.ts';
import type { SymbolRule, TemplateEntry } from './textUtils.ts';

export interface Task {
  id: string;
  name: string;
  templates: TemplateEntry[];
}

export interface TaskSettingsData {
  tasks: Task[];
  stateNames: string[];
  symbolRules: SymbolRule[];
}

export const TASK_SETTINGS_STORAGE_KEY = storageKey('ticketTasks');

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const defaultStateNames = defaultData.stateNames as string[];
const defaultTasks = defaultData.tasks as Task[];
const defaultSymbolRules = defaultData.symbolRules as SymbolRule[];

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
};

const normalizeSymbolRule = (value: unknown, index: number): SymbolRule | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<SymbolRule>;
  const canonical = typeof candidate.canonical === 'string' ? candidate.canonical.trim() : '';
  if (!canonical) return null;

  const label = typeof candidate.label === 'string' && candidate.label.trim().length > 0
    ? candidate.label.trim()
    : `规则 ${index + 1}`;

  return {
    id: typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id
      : `symbol_rule_${index + 1}`,
    label,
    canonical,
    variants: Array.from(new Set(normalizeStringArray(candidate.variants))),
  };
};

export const normalizeSymbolRules = (value: unknown, fallback = getDefaultSymbolRules()): SymbolRule[] => {
  if (!Array.isArray(value)) return cloneJson(fallback);

  const normalized = value
    .map((rule, index) => normalizeSymbolRule(rule, index))
    .filter((rule): rule is SymbolRule => rule !== null);

  return normalized;
};

export const getDefaultSymbolRules = (): SymbolRule[] => cloneJson(defaultSymbolRules);

export const getDefaultTaskSettings = (): TaskSettingsData => ({
  tasks: cloneJson(defaultTasks),
  stateNames: [...defaultStateNames],
  symbolRules: getDefaultSymbolRules(),
});

export const normalizeTaskSettings = (value: unknown): TaskSettingsData => {
  const defaults = getDefaultTaskSettings();

  if (Array.isArray(value)) {
    return {
      ...defaults,
      tasks: value as Task[],
    };
  }

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const candidate = value as Partial<TaskSettingsData>;
  const stateNames = normalizeStringArray(candidate.stateNames);

  return {
    tasks: Array.isArray(candidate.tasks) ? (candidate.tasks as Task[]) : defaults.tasks,
    stateNames: stateNames.length > 0 ? stateNames : defaults.stateNames,
    symbolRules: normalizeSymbolRules(candidate.symbolRules, defaults.symbolRules),
  };
};

export const loadTaskSettings = (): TaskSettingsData => {
  const saved = localStorage.getItem(TASK_SETTINGS_STORAGE_KEY);
  if (!saved) return getDefaultTaskSettings();

  try {
    return normalizeTaskSettings(JSON.parse(saved));
  } catch (error) {
    console.error('Failed to parse task settings', error);
    return getDefaultTaskSettings();
  }
};

export const saveTaskSettings = (settings: TaskSettingsData) => {
  localStorage.setItem(TASK_SETTINGS_STORAGE_KEY, JSON.stringify({
    tasks: settings.tasks,
    stateNames: settings.stateNames,
    symbolRules: settings.symbolRules,
  }));
};
