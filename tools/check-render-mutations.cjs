'use strict';
// The three mutations the render tools and the unit tests must each catch, so a claim about
// coverage is not taken on trust.
//
// The third one is here because it slipped through both: `deckButtonPlace` put the buttons
// back into the hidden sidebar, `npm run render` passed (it cannot see the decision — the
// features run in the harness and the browser only draws what they left), and so did
// `npm test`. Nothing was covering the phone fix. It is covered now, by a test that gives
// the harness the answer the browser would give.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = {
  css: path.join(ROOT, 'src/styles/content.css'),
  sets: path.join(ROOT, 'src/card-page/sets.js'),
  deck: path.join(ROOT, 'src/card-page/deck-lists.js')
};
const before = {};
for (const [key, file] of Object.entries(TARGETS)) before[key] = fs.readFileSync(file, 'utf8');

const MUTATIONS = [
  {
    name: 'tag icons with no size of their own',
    file: 'css',
    run: 'render-card',
    find: '#stk-tags .stk-card-table .stk-tag-icon svg{padding:4px!important;overflow:visible!important}',
    replace: '#stk-tags .stk-card-table .stk-tag-icon svg{padding:4px!important;overflow:visible!important;' +
      'width:100%!important;height:auto!important}',
    expect: 'icon-sized rather than filling its cell'
  },
  {
    name: 'the non-English rule no longer reaches the sets index',
    file: 'sets',
    run: 'render-card',
    find: 'const langHidesSets = RULES.reachesSets(settings.nonEnglishSurfaces);',
    replace: 'const langHidesSets = false;',
    expect: 'choosing secret-lair hides all of them'
  },
  {
    name: 'the deck button goes back into the hidden sidebar',
    file: 'deck',
    run: 'test',
    find: 'if (shown(sidebar)) return sidebar;',
    replace: 'if (sidebar) return sidebar;\n    if (shown(sidebar)) return sidebar;',
    expect: 'not the unreachable one inside the hidden sidebar'
  }
];

const RUNS = {
  'render-card': () => [path.join(ROOT, 'tools/check-card-render.cjs')],
  'render-deck': () => [path.join(ROOT, 'tools/check-deck-render.cjs')],
  test: () => [path.join(ROOT, 'tests/test-preview.cjs')]
};

function restore(key) {
  fs.writeFileSync(TARGETS[key], before[key], 'utf8');
}

let wrong = 0;
try {
  for (const mutation of MUTATIONS) {
    const source = before[mutation.file];
    if (!source.includes(mutation.find)) {
      console.log('FAIL: ' + mutation.name + ' — the text to mutate is not in ' +
        mutation.file + ' any more, so this mutation is stale and proves nothing');
      wrong += 1;
      continue;
    }
    fs.writeFileSync(TARGETS[mutation.file],
      source.replace(mutation.find, mutation.replace), 'utf8');
    let output = '';
    let code = 0;
    try {
      output = execFileSync(process.execPath, RUNS[mutation.run](),
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 2400000 });
    } catch (error) {
      code = error.status === undefined ? -1 : error.status;
      output = (error.stdout || '') + (error.stderr || '');
    }
    restore(mutation.file);
    const caught = code !== 0 && output.includes(mutation.expect);
    if (!caught) wrong += 1;
    console.log((caught ? 'ok:   ' : 'FAIL: ') + mutation.name + ' — ' +
      (caught ? 'caught by ' + mutation.run : 'NOT caught by ' + mutation.run +
        ' (exit ' + code + ')'));
    if (!caught) {
      for (const line of output.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 5)) {
        console.log('       ' + line.trim());
      }
    }
  }
} finally {
  for (const key of Object.keys(TARGETS)) restore(key);
}

console.log('');
console.log(wrong
  ? wrong + ' of ' + MUTATIONS.length + ' mutations were not caught'
  : 'all ' + MUTATIONS.length + ' mutations were caught, and every file is back as it was');
process.exit(wrong ? 1 : 0);
