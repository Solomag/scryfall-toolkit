// Put the files in folders.
//
// A root of fifty-one files is a root where nobody can find anything, and the
// answer to "which file holds the EUR column" being "four of them, depending on
// the page" is not one anybody can hold in their head. The folders are by role
// and by which world a script runs in, because that is how the browser loads
// them and therefore how the manifest reads.
//
// Nothing here changes what a file contains. Only where it is, and every
// reference to it.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// The project root, one folder up. These files used to sit in it.
const ROOT = path.join(__dirname, '..') + path.sep;

// from -> to. The content- and deck- prefixes go: the folder says which one it
// is, and `card-page/edhrec.js` next to `deck-page/edhrec.js` is clearer than
// two files with a prefix each that names the same thing.
const MOVES = {
  'src/background/worker.js': 'src/background/worker.js',
  'src/core/i18n.js': 'src/core/i18n.js',
  'src/core/format-catalog.js': 'src/core/format-catalog.js',
  'src/core/format-overrides.js': 'src/core/format-overrides.js',
  'src/core/tag-icons.js': 'src/core/tag-icons.js',

  'src/card-page/core.js': 'src/card-page/core.js',
  'src/card-page/clipboard.js': 'src/card-page/clipboard.js',
  'src/card-page/tags.js': 'src/card-page/tags.js',
  'src/card-page/legalities.js': 'src/card-page/legalities.js',
  'src/card-page/prints.js': 'src/card-page/prints.js',
  'src/card-page/edhrec.js': 'src/card-page/edhrec.js',
  'src/card-page/prices.js': 'src/card-page/prices.js',
  'src/card-page/sets.js': 'src/card-page/sets.js',
  'src/card-page/card.js': 'src/card-page/card.js',
  'src/card-page/deck-lists.js': 'src/card-page/deck-lists.js',
  'src/card-page/tagger-clipboard.js': 'src/card-page/tagger-clipboard.js',

  'src/deck-page/tools.js': 'src/deck-page/tools.js',
  'src/deck-page/scryfall.js': 'src/deck-page/scryfall.js',
  'src/deck-page/results.js': 'src/deck-page/results.js',
  'src/deck-page/clean-up.js': 'src/deck-page/clean-up.js',
  'src/deck-page/edhrec.js': 'src/deck-page/edhrec.js',
  'src/deck-page/search.js': 'src/deck-page/search.js',
  'src/deck-page/bridge.js': 'src/deck-page/bridge.js',

  'src/ui/options.html': 'src/ui/options.html',
  'src/ui/options.js': 'src/ui/options.js',
  'src/ui/options.css': 'src/ui/options.css',
  'src/ui/popup.html': 'src/ui/popup.html',
  'src/ui/popup.js': 'src/ui/popup.js',
  'src/ui/popup.css': 'src/ui/popup.css',

  'src/styles/theme.css': 'src/styles/theme.css',
  'src/styles/content.css': 'src/styles/content.css',

  'tests/testlib.cjs': 'tests/testlib.cjs',
  'tests/test-background.cjs': 'tests/test-background.cjs',
  'tests/test-deck-modules.cjs': 'tests/test-deck-modules.cjs',
  'tests/test-deck-tools.cjs': 'tests/test-deck-tools.cjs',
  'tests/test-options.cjs': 'tests/test-options.cjs',
  'tests/test-package.cjs': 'tests/test-package.cjs',
  'tests/test-preview.cjs': 'tests/test-preview.cjs',
  'tests/test-tagger.cjs': 'tests/test-tagger.cjs',
  'tests/test-theme.cjs': 'tests/test-theme.cjs'
};

// assets/ holds what ships but is not code: the artwork, the generated tag
// snapshot, and the licences that have to sit beside the material they cover.
const DIR_MOVES = { 'data': 'assets/data', 'third_party': 'assets/licences' };

let moved = 0;
for (const [from, to] of Object.entries(MOVES)) {
  if (!fs.existsSync(ROOT + from)) { console.error('missing: ' + from); process.exit(1); }
  fs.mkdirSync(path.dirname(ROOT + to), { recursive: true });
  execFileSync('git', ['mv', from, to], { cwd: ROOT });
  moved++;
}
for (const [from, to] of Object.entries(DIR_MOVES)) {
  if (!fs.existsSync(ROOT + from)) { console.error('missing dir: ' + from); process.exit(1); }
  fs.mkdirSync(path.dirname(ROOT + to), { recursive: true });
  execFileSync('git', ['mv', from, to], { cwd: ROOT });
  moved++;
}
for (const name of fs.readdirSync(ROOT + 'icons')) {
  execFileSync('git', ['mv', 'assets/icons/' + name, 'assets/icons/' + name], { cwd: ROOT });
  moved++;
}
fs.rmdirSync(ROOT + 'icons');
console.log(moved + ' files moved');
