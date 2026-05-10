import assert from 'node:assert/strict';

import {
  buildParseRegex,
  renderTemplate,
  stripTextForMatch,
} from '../src/utils/textUtils.ts';

const platTemplates = {
  input: '投入{screen}{plat}压板',
  exit: '退出{screen}{plat}压板',
  checkInput: '检查{screen}{plat}压板确已投入',
  checkExit: '检查{screen}{plat}压板确已退出',
  measureInput: '测量{screen}{plat}压板两端对地确无异极性电压后，投入',
};

const templateKeys = ['input', 'exit', 'checkInput', 'checkExit', 'measureInput'];

const normalizePlatTemplates = (value) => {
  const normalized = { ...platTemplates };
  if (value && typeof value === 'object') {
    for (const key of templateKeys) {
      if (typeof value[key] === 'string') normalized[key] = value[key];
    }
  }
  return normalized;
};

const parsePlatLine = (line, screenName = '', operationType = 'exit', inputMode = 'parse', templates = platTemplates) => {
  const strippedLine = stripTextForMatch(line);
  const screenForReplace = inputMode === 'parse' ? '' : screenName.trim();
  const normalizedTemplates = normalizePlatTemplates(templates);
  const regexes = Object.values(normalizedTemplates).map(template => buildParseRegex(template, [], {
    literalPlaceholders: {
      screen: screenForReplace,
    },
  }));

  for (const rx of regexes) {
    const match = strippedLine.match(rx);
    if (match?.groups?.plat) {
      const text = renderTemplate(normalizedTemplates[operationType], {
        screen: screenForReplace,
        plat: match.groups.plat,
      });
      return { text, screenForReplace, plat: match.groups.plat };
    }
  }

  return null;
};

const renderBasicLine = (plat, screenName = '', operationType = 'input', templates = platTemplates) => {
  return renderTemplate(normalizePlatTemplates(templates)[operationType], {
    screen: screenName.trim(),
    plat,
  });
};

const screen = '500kVⅡ段母线第一套母差保护屏';
const platA = '跳5023开关A相TC1跳闸出口1C2LP1';
const platB = '跳5023开关B相TC1跳闸出口1C2LP2';
const exitLineA = `退出${screen}${platA}压板`;
const exitLineB = `退出${screen}${platB}压板`;
const measureLineA = `测量${screen}${platA}压板两端对地确无异极性电压后，投入`;

assert.equal(platTemplates.measureInput, '测量{screen}{plat}压板两端对地确无异极性电压后，投入');

assert.equal(parsePlatLine(exitLineA)?.text, exitLineA);
assert.equal(parsePlatLine(exitLineB)?.text, exitLineB);

const parsedWithDisabledScreen = parsePlatLine(exitLineA, screen, 'input');
assert.equal(parsedWithDisabledScreen?.screenForReplace, '');
assert.equal(parsedWithDisabledScreen?.plat, `${screen}${platA}`);
assert.equal(parsedWithDisabledScreen?.text, `投入${screen}${platA}压板`);

assert.equal(renderBasicLine(platA, screen, 'input'), `投入${screen}${platA}压板`);
assert.equal(renderBasicLine(platA, screen, 'measureInput'), measureLineA);
assert.equal(parsePlatLine(exitLineA, screen, 'measureInput')?.text, measureLineA);
assert.equal(parsePlatLine(measureLineA, screen, 'exit')?.text, exitLineA);
assert.equal(parsePlatLine('退出主变保护屏A压板')?.text, '退出主变保护屏A压板');

const legacyTemplates = {
  input: platTemplates.input,
  exit: platTemplates.exit,
  checkInput: platTemplates.checkInput,
  checkExit: platTemplates.checkExit,
};
assert.equal(normalizePlatTemplates(legacyTemplates).measureInput, platTemplates.measureInput);
assert.equal(renderBasicLine(platA, screen, 'measureInput', legacyTemplates), measureLineA);

const taskRegex = buildParseRegex('退出{deviceName}压板');
assert.equal(
  stripTextForMatch(exitLineA).match(taskRegex)?.groups?.deviceName,
  `${screen}${platA}`,
);

console.log('regression tests passed');
