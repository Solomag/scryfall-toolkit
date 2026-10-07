'use strict';
// The mutations each check must catch, so a claim about coverage is not taken on trust.
//
// Two of these are here because they slipped through something. `deckButtonPlace` put the
// buttons back into the hidden sidebar and both `npm run render` and `npm test` passed: the
// render tools cannot see the decision (the features run in the harness and the browser only
// draws what they left) and the suites had never been asked. And a Secret Lair name pattern
// that no longer matched anything would have been reported as covered by everything, because
// the tools that classify sets each kept their own copy of the patterns — the copy that
// drifted, and the reason `tools/shots/worker-tables.cjs` exists.
//
// So each mutation names the check that must notice it, and this file fails if none does.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = {
  css: path.join(ROOT, 'src/styles/content.css'),
  sets: path.join(ROOT, 'src/card-page/sets.js'),
  setsPage: path.join(ROOT, 'src/card-page/sets.js'),
  core: path.join(ROOT, 'src/card-page/core.js'),
  prints: path.join(ROOT, 'src/card-page/prints.js'),
  options: path.join(ROOT, 'src/ui/options.js'),
  model: path.join(ROOT, 'src/core/set-filters.js'),
  deck: path.join(ROOT, 'src/card-page/deck-lists.js'),
  worker: path.join(ROOT, 'src/background/worker.js')
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
    // The rule that decides whether the whole set filter runs at all. Written as "some
    // family is shown is false" it is true only when every family is off, so narrowing the
    // category to a single family stood the entire feature down: untick 4BB, leave the other
    // two on, and not one row moved. This shipped for one run before a render check asked
    // about a single family, which is the second time this line has been the wrong way round.
    name: 'the set filter stands down when one border family is left on',
    file: 'core',
    run: 'render-card',
    find: '.some(show => show !== true);',
    replace: '.some(show => show === false && Object.values(settings.showForeignBlackBorder).every(() => false));',
    expect: 'leaving one family on keeps every one of its sets'
  },
  {
    // And the same question asked of the set index rather than of the boot decision, which
    // is a second copy of the same gate in a different file.
    name: 'the sets index stops narrowing the border category',
    file: 'sets',
    run: 'render-card',
    find: 'const borderOff = Object.entries(settings.showForeignBlackBorder || {})\n        .filter(([, show]) => show !== true)',
    replace: 'const borderOff = Object.entries(settings.showForeignBlackBorder || {})\n        .filter(([, show]) => show === false && Object.keys(settings.showForeignBlackBorder).every(k => false))',
    expect: 'leaving one family on keeps every one of its sets'
  },
  {
    // The analogue comparison, which decides whether a translated printing is redundant.
    // Compare only the frame and the art is the rule working for most cards, so a check that
    // only used same-art-same-frame examples would not notice; this one uses a printing whose
    // only difference is the border colour.
    name: 'the English-analogue comparison forgets the border colour',
    file: 'model',
    run: 'test-model',
    find: "      printing?.borderColor || '',",
    replace: "      '',",
    expect: 'a different border colour is a different picture'
  },
  {
    // And the full-art treatment, which is the same kind of difference one field further down.
    name: 'the English-analogue comparison forgets the full-art treatment',
    file: 'model',
    run: 'test-model',
    find: "      printing?.fullArt === true ? 'full' : ''",
    replace: "      ''",
    expect: 'a full-art treatment is a different picture from the plain version'
  },
  {
    // The per-printing platform. Answering it from the set is what made turning Arena off
    // lose the paper printing of a set that was on both, and this is the line that moved.
    name: 'a printing is placed by its set rather than by itself',
    file: 'model',
    run: 'test-model',
    find: 'return games.some(game => chosen.includes(game));',
    replace: 'return true;',
    expect: 'a Magic Online printing is gone when only Arena is kept'
  },
  {
    name: 'the deck button goes back into the hidden sidebar',
    file: 'deck',
    run: 'test',
    find: 'if (shown(sidebar)) return sidebar;',
    replace: 'if (sidebar) return sidebar;\n    if (shown(sidebar)) return sidebar;',
    expect: 'not the unreachable one inside the hidden sidebar'
  },
  {
    // A name pattern that stops matching. Nothing in the extension notices: no sub-list
    // comes back, every row stays, and the feature reads as a switch that does nothing —
    // which is how the drifted copy in the tools went unnoticed for three releases. What
    // catches it is the completeness check: nine sets on Scryfall say Portal or Secret Lair
    // and a pattern that matches none of them is a rule with a hole, which nothing about the
    // sets it does match would ever show.
    name: 'the Secret Lair name pattern stops matching anything',
    file: 'worker',
    run: 'set-rules',
    find: "'secret-lair': /^Secret Lair/i",
    replace: "'secret-lair': /^Secret Lairs and Things/i",
    expect: 'every set Scryfall names Portal or Secret Lair is matched'
  },
  {
    // And the same in the other direction: a pattern that matches too much. Widened to
    // /^Fourth Edition/, the rule also claims `4ed` — an ordinary English set with hundreds
    // of English printings — and the sweep contradicts it against the API rather than
    // against a copy of itself.
    name: 'the black border pattern is widened to an ordinary English set',
    file: 'worker',
    run: 'set-rules',
    find: "'4bb': /^Fourth Edition Foreign Black Border/i",
    replace: "'4bb': /^Fourth Edition/i",
    expect: '4bb/4ed'
  },
  {
    // The measured list is dropped from the answer the worker gives. The rule then reads
    // `undefined`, hides nothing, and looks switched on — which is the failure this whole
    // shape of bug has been about, and the reason the cache guard in `loadSetCategories`
    // names every list rather than the ones that existed when it was written.
    name: 'the worker stops answering with the foreign-only list',
    file: 'worker',
    run: 'test-background',
    find: "categories.foreignOnly = bundledForeignOnly.filter(code => served.has(code));",
    replace: "categories.foreignOnly = [];",
    expect: 'set categories are classified correctly'
  },
  {
    // And the same list not reaching the page that acts on it, which is where the drifted
    // copy in this repository's own tools hid for three releases: the fixture had no
    // `foreignOnly` at all, every sub-list came back empty, and both rules hid nothing while
    // the render check reported the feature as covered.
    name: 'the card page stops asking for the foreign-only list',
    file: 'setsPage',
    run: 'test',
    find: "...(settings.showNoEnglishSets ? [] : categories.foreignOnly || [])",
    replace: "...([])",
    expect: 'foreign-only'
  },
  {
    // The worker stops carrying the treatment fields the analogue rule compares. The rows
    // still arrive and the table still draws them, so the only symptom is that the rule stops
    // removing anything and the mode reads as chosen. A print list with no `art` in it is
    // exactly what "cannot compare, therefore keep" says, so this is the failure that the
    // comparison's own safety net hides.
    name: 'the worker stops carrying the treatment fields',
    file: 'worker',
    run: 'test-background',
    find: 'art: cardArt(card),',
    replace: 'art: [],',
    expect: 'scryfall print fields are renamed for the content script, art and treatment included'
  },
  {
    // The artwork of a multi-faced card, which lives in the worker rather than in the model:
    // taking the card's own `illustration_id` reads as null for a double-faced card, because
    // Scryfall leaves it off and puts the illustrations on the faces. Every DFC's art then
    // compares as empty and the rule quietly does nothing for the cards that needed it most.
    name: 'the artwork of a multi-faced card is read off the wrong place',
    file: 'worker',
    run: 'test-background',
    find: '.map(face => face.illustration_id || null)',
    replace: '.map(face => card.card_faces[0].illustration_id || null)',
    expect: 'a double-faced printing carries one illustration per face'
  },
  {
    // And the areas list. One area off is the ordinary state of a reader who wants the sets
    // index untouched, and a gate that ignores it hides rows on a surface they excluded.
    name: 'the areas list is ignored and every surface is filtered',
    file: 'core',
    run: 'test',
    find: 'const filteringOn = area => settings.filterAreas?.[area] === true;',
    replace: 'const filteringOn = area => true;',
    expect: 'leaving the sets index off leaves it alone'
  },
  {
    // The same answer asked of the grouped table rather than of the boot decision. This is
    // the one that held for the wrong reason for a release: the language rule was gated on the
    // area and the four category rules were not, and the only thing keeping them quiet was
    // that nothing else wanted the set index. Turning a platform off wants it, so four rules
    // reached a surface the reader had excluded, and the same settings gave two different
    // answers depending on an unrelated switch.
    name: 'the grouped table ignores the prints area for its category rules',
    file: 'prints',
    run: 'test',
    find: 'const excluded = printsWantedForTable ? new Set([',
    // Not `new Set([` without the guard: that leaves `]) : new Set();` behind and the file
    // stops parsing, which fails the run without testing anything. `syntaxOnly` below is what
    // stops such a mutation being counted as a caught one.
    replace: 'const excluded = true ? new Set([',
    expect: 'with the prints area off it still removes nothing once the platform filter'
  },
  {
    // The area gate on the *language* rule, which is the sibling of the one above and was
    // already correct. A gate can be right for the wrong reason, so it is mutated rather than
    // assumed covered by the check above.
    //
    // The case it is checked against has the language rule as the *only* rule acting. Every
    // other category switch is on, so with the gate gone nothing else would hide the Japanese
    // printing and the fixture would pass — measuring the fixture rather than the gate, which
    // is what the first version of this mutation did.
    name: 'the language rule is not gated on the prints area',
    file: 'prints',
    run: 'test',
    find: "const languageMode = printsWantedForTable ? settings.nonEnglishMode : 'all';",
    replace: "const languageMode = settings.nonEnglishMode;",
    expect: 'the language rule at None takes nothing out while the prints area is off'
  },
  {
    // The fallback that put three platforms back when the kept list came back empty. A reader
    // who unticks all three was shown a settings page with three unticked switches and a
    // Scryfall page with everything on it, and only the settings page was ever checked.
    name: 'an empty kept-platform list is read as three platforms',
    file: 'core',
    run: 'test',
    find: 'const platformFilterOn = chosenPlatforms.size < PLATFORM_NAMES.length;',
    replace: 'if (!chosenPlatforms.size) for (const n of PLATFORM_NAMES) chosenPlatforms.add(n);\n' +
      '  const platformFilterOn = chosenPlatforms.size < PLATFORM_NAMES.length;',
    expect: 'with every platform switched off every set on the index is hidden'
  },
  {
    // The list of Foreign Black Border families, hidden whenever the category switch was on.
    // A reader who had chosen "everything except FBB" was shown a category reading as simply
    // on, with no way to see that one of its three families was hidden: the setting applied
    // correctly and was invisible, which is the one state a reader cannot act on.
    name: 'a narrowed border category hides the list that shows the narrowing',
    file: 'options',
    run: 'test-options',
    find: 'borderList.hidden = borderFamilies.every(key => filters.paper.foreignBlackBorder[key] !== false);',
    replace: 'borderList.hidden = borderSwitch.checked || borderFamilies.every(' +
      'key => filters.paper.foreignBlackBorder[key] !== false);',
    expect: 'and the list under it is open, so the one hidden family is visible'
  },
  {
    // The print list as the answer to "is this row translated". Scryfall writes the language
    // into most links and not into six of a thousand — sld/ph, acr/grc, pinv/la — and those
    // rows stayed on the page with the rule switched on. Measured on 1762 printings.
    name: 'a row is called translated only by the shape of its link',
    file: 'sets',
    run: 'test',
    find: 'const foreignPrinting = translatedByList ||',
    replace: 'const foreignPrinting = false ||',
    expect: 'a Filipino printing whose link names no language is hidden under None'
  }
];

const RUNS = {
  'render-card': () => [path.join(ROOT, 'tools/check-card-render.cjs')],
  'render-deck': () => [path.join(ROOT, 'tools/check-deck-render.cjs')],
  test: () => [path.join(ROOT, 'tests/test-preview.cjs')],
  'test-background': () => [path.join(ROOT, 'tests/test-background.cjs')],
  'test-model': () => [path.join(ROOT, 'tests/test-set-filters.cjs')],
  'test-options': () => [path.join(ROOT, 'tests/test-options.cjs')],
  'set-rules': () => [path.join(ROOT, 'tools/check-set-name-rules.cjs')]
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
    const run = RUNS[mutation.run];
    if (!run) {
      console.log('FAIL: ' + mutation.name + ' — no runner named "' + mutation.run +
        '", so this mutation was never applied. A mutation pointing at a runner that does ' +
        'not exist passes by not running.');
      wrong += 1;
      restore(mutation.file);
      continue;
    }
    try {
      output = execFileSync(process.execPath, run(),
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 2400000 });
    } catch (error) {
      code = error.status === undefined ? -1 : error.status;
      output = (error.stdout || '') + (error.stderr || '');
    }
    restore(mutation.file);
    // A run that only reports a parse error has not tested the rule. Mutating an expression
    // so that the file stops being valid JavaScript fails every suite in the repository, and
    // calling that coverage is the same mistake this file exists to catch: the check "passed"
    // for a reason that has nothing to do with what it claims to check.
    //
    // So a mutation whose output names the expected assertion *and* also reports a syntax
    // error is not counted. It is reported as a broken mutation instead, which is a different
    // failure with a different fix — rewrite the mutation so the file still parses.
    const syntaxOnly = /SyntaxError|Unexpected token|Unexpected identifier/.test(output);
    const caught = code !== 0 && output.includes(mutation.expect) && !syntaxOnly;
    if (!caught) wrong += 1;
    console.log((caught ? 'ok:   ' : syntaxOnly ? 'BROKEN: ' : 'FAIL: ') + mutation.name + ' — ' +
      (caught ? 'caught by ' + mutation.run
        : syntaxOnly ? 'only broke the parse, so it proved nothing (exit ' + code + ')'
          : 'NOT caught by ' + mutation.run + ' (exit ' + code + ')'));
    if (!caught) {
      for (const line of output.split('\n').filter(l => /FAIL|Error|Syntax/.test(l)).slice(0, 5)) {
        console.log('       ' + line.trim());
      }
    }
  }
} finally {
  for (const key of Object.keys(TARGETS)) restore(key);
}

console.log('');
console.log(wrong
  ? wrong + ' of ' + MUTATIONS.length +
    ' mutations did not prove what they claim: either nothing noticed, or the run failed ' +
    'only because the file stopped parsing'
  : 'all ' + MUTATIONS.length +
    ' mutations were caught by the check that names them, and every file is back as it was');
process.exit(wrong ? 1 : 0);
