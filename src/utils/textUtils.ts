// ─── 正则与文本处理工具库 ────────────────────────────────────────

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 占位符列表：除 {n} 外均使用命名捕获组
// 在模板字符串中可用 {deviceName} / {a} / {b} / {c} 等任意单小写字母占位符
const PLACEHOLDER_RE = /\{([a-z][a-zA-Z0-9]*)\}/g;

export type TemplateEntry = string | string[];
export interface SymbolRule {
    id: string;
    label: string;
    canonical: string;
    variants: string[];
}

const MATCH_WHITESPACE_RE = /[\s\t\u00A0\u200B]+/g;
const NUM_TOKEN = '\x00NUM\x00';
const PLACEHOLDER_TOKEN_RE = /^\x00PH_([a-zA-Z0-9]+)\x00/;

const getRuleAlternatives = (rule: SymbolRule): string[] => {
    return Array.from(new Set([
        rule.canonical,
        ...rule.variants,
    ].filter(value => typeof value === 'string' && value.length > 0)));
};

const buildRulePattern = (rule: SymbolRule): string => {
    const variants = getRuleAlternatives(rule)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex);
    return variants.length === 1 ? variants[0] : `(?:${variants.join('|')})`;
};

const buildLiteralPattern = (literal: string, symbolRules: SymbolRule[]): string => {
    if (!literal) return '';

    const sortedRules = symbolRules
        .filter(rule => typeof rule.canonical === 'string' && rule.canonical.length > 0)
        .slice()
        .sort((a, b) => b.canonical.length - a.canonical.length);

    let result = '';
    let index = 0;

    while (index < literal.length) {
        const matchedRule = sortedRules.find(rule => literal.startsWith(rule.canonical, index));
        if (matchedRule) {
            result += buildRulePattern(matchedRule);
            index += matchedRule.canonical.length;
            continue;
        }

        result += escapeRegex(literal[index]);
        index += 1;
    }

    return result;
};

export const stripTextForMatch = (text: string): string => {
    return (text || '').replace(MATCH_WHITESPACE_RE, '');
};

/**
 * 获取用于输出渲染的主模板：字符串直接使用，数组使用第一项。
 */
export const getPrimaryTemplate = (templateEntry: TemplateEntry | undefined): string => {
    if (Array.isArray(templateEntry)) {
        return templateEntry[0] ?? '';
    }
    return templateEntry ?? '';
};

/**
 * 获取用于解析匹配的全部模板变体：字符串为单一变体，数组为主模板+兼容模板。
 */
export const getTemplateVariants = (templateEntry: TemplateEntry | undefined): string[] => {
    if (Array.isArray(templateEntry)) {
        return templateEntry.filter((template): template is string => typeof template === 'string' && template.trim().length > 0);
    }
    if (typeof templateEntry === 'string' && templateEntry.trim().length > 0) {
        return [templateEntry];
    }
    return [];
};

/**
 * 将模板字符串构建为用于解析和捕获数据的正则表达式
 * @param {string} template 模板字符串
 * @returns {RegExp} 构建的正则表达式
 */
export const buildParseRegex = (template: string, symbolRules: SymbolRule[] = []): RegExp => {
    const sanitizedTemplate = template
        .replace(/\{n\}/g, NUM_TOKEN)
        .replace(PLACEHOLDER_RE, (_, name) => `\x00PH_${name}\x00`)
        .replace(MATCH_WHITESPACE_RE, '');

    let pattern = '';
    let index = 0;

    while (index < sanitizedTemplate.length) {
        if (sanitizedTemplate.startsWith(NUM_TOKEN, index)) {
            const nextChar = sanitizedTemplate[index + NUM_TOKEN.length];
            if (nextChar === 'A') {
                pattern += '[\\d.]*A?';
                index += NUM_TOKEN.length + 1;
            } else {
                pattern += '[\\d.]*';
                index += NUM_TOKEN.length;
            }
            continue;
        }

        const placeholderMatch = sanitizedTemplate.slice(index).match(PLACEHOLDER_TOKEN_RE);
        if (placeholderMatch) {
            pattern += `(?<${placeholderMatch[1]}>.+?)`;
            index += placeholderMatch[0].length;
            continue;
        }

        const nextTokenIndex = sanitizedTemplate.slice(index).search(/\x00(?:NUM|PH_[a-zA-Z0-9]+)\x00/);
        const literalEnd = nextTokenIndex === -1
            ? sanitizedTemplate.length
            : index + nextTokenIndex;
        pattern += buildLiteralPattern(sanitizedTemplate.slice(index, literalEnd), symbolRules);
        index = literalEnd;
    }

    return new RegExp('^' + pattern + '$');
};

/**
 * 根据捕获的变量对象，渲染目标模板字符串
 * @param {string} template 目标模板
 * @param {Object} captures 捕获的数据对象
 * @returns {string} 渲染后的字符串
 */
export const renderTemplate = (template: string, captures: Record<string, string | undefined>): string => {
    let result = template;
    for (const [key, val] of Object.entries(captures)) {
        if (val !== undefined) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
        }
    }
    return result.replace(/\{n\}/g, '   ');
};

/**
 * 一键清空文本中的电压、电流等实测数据，替换为规范空格
 * @param {string} text 原始文本
 * @returns {string} 清洗后的文本
 */
export const clearVoltageCurrentText = (text: string): string => {
    if (!text) return text;
    return text.replace(/[(（](.*?)[)）]/g, (_, inner) => {
        let processed = inner.replace(/:/g, '：').replace(/,/g, '，');
        processed = processed.replace(/\s*[+-]?\d+(?:\.\d+)?\s*/g, '   ');
        return `（${processed}）`;
    });
};
