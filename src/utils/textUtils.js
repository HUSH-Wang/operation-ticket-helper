// ─── 正则与文本处理工具库 ────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 占位符列表：除 {n} 外均使用命名捕获组
// 在模板字符串中可用 {deviceName} / {a} / {b} / {c} 等任意单小写字母占位符
const PLACEHOLDER_RE = /\{([a-z][a-zA-Z0-9]*)\}/g;

/**
 * 将模板字符串构建为用于解析和捕获数据的正则表达式
 * @param {string} template 模板字符串
 * @returns {RegExp} 构建的正则表达式
 */
export const buildParseRegex = (template) => {
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

/**
 * 根据捕获的变量对象，渲染目标模板字符串
 * @param {string} template 目标模板
 * @param {Object} captures 捕获的数据对象
 * @returns {string} 渲染后的字符串
 */
export const renderTemplate = (template, captures) => {
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
export const clearVoltageCurrentText = (text) => {
    if (!text) return text;
    return text.replace(/[(（](.*?)[)）]/g, (match, inner) => {
        let processed = inner.replace(/:/g, '：').replace(/,/g, '，');
        processed = processed.replace(/\s*[+-]?\d+(?:\.\d+)?\s*/g, '   ');
        return `（${processed}）`;
    });
};
