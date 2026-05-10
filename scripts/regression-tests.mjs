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
};

const parsePlatLine = (line, screenName = '', operationType = 'exit') => {
  const strippedLine = stripTextForMatch(line);
  const regexes = Object.values(platTemplates).map(template => buildParseRegex(template, [], {
    literalPlaceholders: {
      screen: screenName.trim(),
    },
  }));

  for (const rx of regexes) {
    const match = strippedLine.match(rx);
    if (match?.groups?.plat) {
      return renderTemplate(platTemplates[operationType], {
        screen: screenName.trim(),
        plat: match.groups.plat,
      });
    }
  }

  return null;
};

const screen = '500kVⅡ段母线第一套母差保护屏';
const platA = '跳5023开关A相TC1跳闸出口1C2LP1';
const platB = '跳5023开关B相TC1跳闸出口1C2LP2';
const exitLineA = `退出${screen}${platA}压板`;
const exitLineB = `退出${screen}${platB}压板`;

assert.equal(parsePlatLine(exitLineA), exitLineA);
assert.equal(parsePlatLine(exitLineB), exitLineB);
assert.equal(parsePlatLine(exitLineA, screen, 'input'), `投入${screen}${platA}压板`);
assert.equal(parsePlatLine('退出主变保护屏A压板'), '退出主变保护屏A压板');

const taskRegex = buildParseRegex('退出{deviceName}压板');
assert.equal(
  stripTextForMatch(exitLineA).match(taskRegex)?.groups?.deviceName,
  `${screen}${platA}`,
);

console.log('regression tests passed');
