// Every reference to a moved file, in one place. The moves themselves are done;
// this is the half that is easy to miss and that a browser finds for you at run
// time, silently, as a content script that never loads.
const fs = require('node:fs');
const path = require('node:path');
// The project root, one folder up. These files used to sit in it.
const ROOT = path.join(__dirname, '..') + path.sep;

const MOVES = {
  'src/background/worker.js': 'src/background/worker.js',
  'src/core/i18n.js': 'src/core/i18n.js',
  'src/core/format-catalog.js': 'src/core/format-catalog.js',
  'src/core/format-overrides.js': 'src/core/format-overrides.js',
  'src/core/tag-icons.js': 'src/core/tag-icons.js',
  'src/core/theme.js': 'src/core/theme.js',
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
  'tests/test-theme.cjs': 'tests/test-theme.cjs',
  'assets/data/': 'assets/data/',
  'assets/licences/': 'assets/licences/',
  'assets/icons/': 'assets/icons/'
};

// ROOT is absolute, and the walk produces absolute paths, so joining them gives a
// path that starts with the drive letter twice. A file is one path or the other.
const at = f => (path.isAbsolute(f) ? f : ROOT + f);
const read = f => fs.readFileSync(at(f), 'utf8');
const write = (f, s) => fs.writeFileSync(at(f), s);

// Longest names first, or "assets/data/" rewrites the start of "assets/data/x.js" twice.
const NAMES = Object.keys(MOVES).sort((a, b) => b.length - a.length);

// Longest wins, and it has to be that name in quotes or as a path segment, not
// the same letters inside an identifier.
const rewrite = (text, file) => {
  let out = text;
  for (const from of NAMES) {
    const to = MOVES[from];
    if (!out.includes(from)) continue;
    const isDir = from.endsWith('/');
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // A quoted name, or a path segment in a quoted path.
    const pattern = isDir
      ? new RegExp('(["\'`])' + escaped, 'g')
      : new RegExp('(["\'`])' + escaped + '(["\'`/])', 'g');
    out = out.replace(pattern, (match, before, after) =>
      (isDir ? before + to : before + to + after));
  }
  return out;
};

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const rel = path.join(dir, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) walk(rel);
    else if (/\.(js|cjs|json|html|css|md|yml|ps1)$/.test(entry.name)) files.push(rel);
  }
})(ROOT);

let changed = 0;
for (const file of files) {
  const before = read(file);
  const after = rewrite(before, file);
  if (after !== before) { write(file, after); changed++; }
}
console.log(changed + ' files had their references rewritten');
