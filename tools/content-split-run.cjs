// Do the split. Every line is moved as it stands; the only edits are the four
// reassigned shared names becoming members of one object, because a destructured
// name cannot be written back across a file boundary.
//
// The order the features run in is the order they ran in before, and it is
// declared in content-core.js rather than left to the order the manifest happens
// to list the files in. That is the point of doing this: a feature's place in
// the run is a decision, not a side effect of where its file ended up.
const fs = require('node:fs');
const path = require('node:path');
const { take, span, lines } = require('./content-split.cjs');
// The project root, one folder up. These files used to sit in it.
const ROOT = path.join(__dirname, '..') + path.sep;

const LICENSE = [
  '/*',
  ' * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.',
  ' *',
  ' * This Source Code Form is subject to the terms of the Mozilla Public',
  ' * License, v. 2.0. If a copy of the MPL was not distributed with this',
  ' * file, You can obtain one at https://mozilla.org/MPL/2.0/.',
  ' *',
  ' * Third-party data, images and code in this project keep their own licence and',
  ' * are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.',
  ' */'
].join('\n');

// The four names that are written to after they are made. They live on one
// object so a write is visible to every file; a destructured copy would not be.
const MUTABLE = ['clipboardCards', 'realignStatsPanel', 'finishesSettled', 'enqueueCardTraderPrint'];
const mutate = text => {
  let out = text;
  for (const name of MUTABLE) {
    // A word boundary that is not a member access, so `shared.finishesSettled`
    // is not rewritten a second time.
    out = out.replace(new RegExp('(^|[^.\\w$])' + name + '\\b', 'g'), '$1shared.' + name);
  }
  return out;
};

// What a feature file may read out of the core.
const CONTEXT = [
  'settings', 'language', 't', 'cardPath', 'cardPage', 'advancedPage', 'identity',
  'PLATFORM_NAMES', 'chosenPlatforms', 'platformFilterOn', 'setPlatformsOf',
  'platformSetVisible', 'platformSetRequests', 'request', 'button', 'iconButton',
  'attachPrintButton', 'printKey', 'refreshPrintButtons', 'flashCopied',
  'hidePreview', 'positionPreview', 'enablePreview', 'ctQueuedCells',
  'printButtonRefreshers', 'shared'
];

// file -> { title, why, blocks: [[definition, bootStep], ...] }
const FEATURES = [
  {
    file: 'src/card-page/clipboard.js',
    title: 'The shared clipboard, and the per-printing + on the card page',
    why: '// The clipboard is read by more features than any other part of this — the price\n' +
         '// columns, the grouped printings and the deck list all read what it holds — so it\n' +
         '// goes first and is awaited before anything else runs.',
    blocks: [['initClipboard', 'clipboard'], ['initNativePrintButtons', 'nativePrintButtons']]
  },
  {
    file: 'src/card-page/tags.js',
    title: 'Tag panels, related cards, and the hover preview they share',
    why: '',
    blocks: [['initTags', 'tags'], ['initSearchTaggerLinks', 'searchTaggerLinks']]
  },
  {
    file: 'src/card-page/legalities.js',
    title: "Scryfall's own legality block, with the extra formats added to it",
    why: '',
    blocks: [['initLegalities', 'legalities']]
  },
  {
    file: 'src/card-page/prints.js',
    title: 'The grouped printings table, and the finish column it counts on',
    why: '// These two are one file because the grouped table waits for the finish column to\n' +
         '// land before it counts columns, and because the rows it creates later reuse the\n' +
         '// throttled CardTrader queue the price column set up.',
    blocks: [['initPrintFinishes', 'printFinishes'], ['initExpandedPrints', 'expandedPrints']]
  },
  {
    file: 'src/card-page/edhrec.js',
    title: "EDHREC's usage and salt, and the panel beside the legalities",
    why: '',
    blocks: [['initEdhrecStats', 'edhrecStats']]
  },
  {
    file: 'src/card-page/prices.js',
    title: 'The EUR column: Cardmarket, CardTrader, and the advanced page filters',
    why: '',
    blocks: [['initCardTrader', 'cardTrader'], ['priceHeading', null], ['brandLogo', null],
             ['initPriceFilter', 'priceFilter'], ['initAdvancedPriceFilter', 'advancedPriceFilter']]
  },
  {
    file: 'src/card-page/sets.js',
    title: 'The set list filters, on /sets and on the advanced search page',
    why: '',
    blocks: [['initSetFilter', 'setFilter'], ['initAdvancedSetFilter', 'advancedSetFilter']]
  },
  {
    file: 'src/card-page/card.js',
    title: 'Card nicknames and the type and mana search links',
    why: '',
    blocks: [['initCardNicknames', 'cardNicknames'], ['initCardSearchLinks', 'cardSearchLinks']]
  },
  {
    file: 'src/card-page/deck-lists.js',
    title: 'The deck page: token list, stacked cards, and the No Prices switch',
    why: '',
    blocks: [['initDeckTokens', 'deckTokens'], ['initStackedDeckCards', 'stackedDeckCards'],
             ['initDeckPriceOption', 'deckPriceOption']]
  }
];

const write = (name, text) => {
  fs.writeFileSync(path.join(ROOT, name), text);
  const n = text.split('\n').length;
  console.log(String(n).padStart(5) + '  ' + name);
};

let written = 0;
for (const feature of FEATURES) {
  const plain = [];
  const steps = [];
  for (const [name, step] of feature.blocks) {
    // The function body always goes in. A block with a boot step also gets a
    // registration line under it; one without is only used by another function
    // in this same file, and needs no registration of its own.
    plain.push(mutate(take(name)));
    if (step) steps.push([step, name]);
  }
  const body = plain.join('\n');

  const out = [
    LICENSE,
    '',
    '// ' + feature.title + '.',
    feature.why || null,
    '// Loaded after content-core.js: everything this file needs is on self.STK_CONTENT, and',
    '// nothing here is needed by the files around it. What runs, and in which order, is',
    '// decided in content-core.js — where this file sits in the manifest does not decide it.',
    '(async () => {',
    '  // The settings have not been read yet when this file is injected, so the context is',
    '  // waited for rather than read. Destructuring at load time would give every name',
    '  // below as undefined, and nothing would say so until a feature asked for a card page',
    '  // that was not there.',
    '  const {',
    ...CONTEXT.map((name, i) => '    ' + name + (i === CONTEXT.length - 1 ? '' : ',')),
    '  } = await self.STK_CONTENT.context;',
    '',
    body,
    '',
    ...steps.map(([step, name]) =>
      '  self.STK_CONTENT.on(' + JSON.stringify(step) + ', () => ' + name + '());'),
    '})();'
  ].filter(line => line !== null).join('\n') + '\n';

  write(feature.file, out);
  written++;
}

console.log('\n' + written + ' feature files written');
console.log('spans used: ' + FEATURES.flatMap(f => f.blocks.map(b => b[0] + ' ' + span(b[0]))).join(', '));
