/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence and
 * are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */
'use strict';
// theme.js and stylesheet tests: static integrity of manifest, styles and
// icons, plus dark/locale class handling at runtime.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  assert, assertEqual, summary, sleep, createPage, themeCss, ROOT
} = require('./testlib.cjs');

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));

async function manifestIntegrity() {
  console.log('static: manifest integrity');
  const manifest = JSON.parse(read('manifest.json'));
  assertEqual(manifest.manifest_version, 3, 'manifest is MV3');

  const referenced = new Set();
  referenced.add(manifest.background.service_worker);
  for (const group of manifest.content_scripts) {
    for (const file of group.js || []) referenced.add(file);
    for (const file of group.css || []) referenced.add(file);
  }
  referenced.add(manifest.options_page);
  referenced.add(manifest.action.default_popup);
  for (const value of Object.values(manifest.icons || {})) referenced.add(value);
  for (const file of referenced) assert(exists(file), `manifest references existing file: ${file}`);

  // The deck features run in Scryfall's own page world, because they work
  // through Scryfall's application state and a content script cannot see it.
  const pageWorld = manifest.content_scripts.filter(group => group.world === 'MAIN');
  assertEqual(pageWorld.length, 1, 'exactly one script group runs in the page world');
  assertEqual(pageWorld[0].js,
    ['src/deck-page/tools.js', 'src/deck-page/scryfall.js', 'src/deck-page/results.js', 'src/deck-page/clean-up.js', 'src/deck-page/edhrec.js', 'src/deck-page/search.js', 'src/deck-page/bridge.js'],
    'the page world loads the deck tools, the Scryfall adapter, the shared results area, the features and the bridge');
  assertEqual(pageWorld[0].run_at, 'document_idle', 'and starts once the page is up');
  for (const group of manifest.content_scripts) {
    if (group.world === 'MAIN') continue;
    assert(!group.world || group.world === 'ISOLATED',
      `content script ${group.js[0]} stays in the isolated world`);
  }

  // Line endings are stripped before comparing. A checkout on Windows has CRLF
  // and a checkout on the runner has LF, and a test that forgets that fails on
  // one of them for a reason that has nothing to do with what it is testing.
  const firstLine = file => read(file).split(/\r?\n/)[0].trim();
  // The README carries no version, and the reason is the point of the assertion: a
  // number in the title of a project page is a claim about the newest release, and the
  // page said 0.58.0 while the newest release was 0.51.0 — both true, and the pair of
  // them telling a reader to install something that does not exist. So the title is
  // checked for the opposite: that a version has not crept back into it.
  assertEqual(firstLine('README.md'), '# Scryfall Toolkit',
    'the README title carries no version, and does not call a released extension a preview');
  const pkg = JSON.parse(read('package.json'));
  assertEqual(pkg.version, manifest.version, 'package.json version matches manifest');
  // The store listing is what gets pasted into the review form, and it carries
  // the version in its title. It is not shipped, so nothing else checks it.
  assertEqual(firstLine('docs/CHROME_WEB_STORE_LISTING.md'),
    `# Chrome Web Store listing — Scryfall Toolkit ${manifest.version}`,
    'the store listing carries the same version, so the review form matches the build');
  const lock = JSON.parse(read('package-lock.json'));
  assertEqual(lock.version, manifest.version, 'package-lock.json version matches manifest');
  assertEqual(lock.packages[''].version, manifest.version,
    'and so does its root entry, because npm ci refuses to install when they differ');
  const taggerGroups = manifest.content_scripts.filter(group => group.matches.some(host => host.includes('tagger.scryfall.com')));
  assert(taggerGroups.length >= 1, 'manifest keeps a Tagger content script');
  // Every part of the theme, not one file of it: a Tagger group carrying only
  // the first part would style the page and leave it half dark, with nothing
  // anywhere saying so.
  for (const part of ["src/styles/theme/01-card-page.css","src/styles/theme/02-shared-pages.css","src/styles/theme/03-account-and-marketing.css","src/styles/theme/04-surfaces.css","src/styles/theme/05-tagger.css","src/styles/theme/06-shared-surfaces.css","src/styles/theme/07-our-own-ui.css"]) {
    assert(taggerGroups.some(group => group.js.includes('src/core/theme.js') && group.css.includes(part)),
      'Tagger is given ' + part + ', so the setting reaches the whole theme there');
  }
  assert(taggerGroups.some(group => group.run_at === 'document_start'), 'the Tagger theme runs at document_start');
}

function syntaxCheck() {
  console.log('static: syntax check');
  const files = [
    'src/background/worker.js', 'src/card-page/core.js', 'src/card-page/prices.js', 'src/core/theme.js', 'src/core/i18n.js', 'src/ui/options.js',
    'src/core/format-catalog.js', 'src/core/format-overrides.js', 'src/core/tag-icons.js',
    'src/card-page/tagger-clipboard.js',
    'assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js',
    'assets/data/illustration-tags-2.js', 'assets/data/shambleshark-nicknames.js'
  ];
  const failures = [];
  for (const file of files) {
    try { new vm.Script(read(file), { filename: file }); }
    catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  assertEqual(failures, [], 'all extension scripts compile');
}

// The theme is seven files, and the two ways that can go quietly wrong are both
// invisible on the page: a part that is written and never listed loads nothing,
// and a part that is listed out of order changes which of two equally specific
// rules wins. Neither shows up as an error anywhere, so both are checked here.
function themePartsTest() {
  console.log('static: the theme is seven files and the manifest lists all of them');
  const dir = 'src/styles/theme';
  const onDisk = fs.readdirSync(path.join(ROOT, dir)).filter(name => name.endsWith('.css')).sort();
  assert(onDisk.length > 1, 'the theme really is more than one file, or this is all noise');

  const manifest = JSON.parse(read('manifest.json'));
  const groups = manifest.content_scripts.filter(group =>
    (group.css || []).some(file => file.startsWith(dir + '/')));
  assert(groups.length > 0, 'the manifest lists the theme somewhere');

  const listed = group => group.css.filter(file => file.startsWith(dir + '/')).map(file =>
    file.slice(dir.length + 1));

  // Same order as the filenames sort in, because that is the order they are meant
  // to be loaded in and the numbering in each part's header says so.
  for (const group of groups) {
    assertEqual(listed(group), onDisk, 'every part on disk is listed, in filename order, in ' +
      (group.matches || []).join(', '));
  }

  onDisk.forEach((name, index) => {
    const text = read(dir + '/' + name);
    // The notice travels with the file. Six sevenths of a stylesheet with no
    // licence header is a licence header that nobody will find.
    assert(text.includes('Mozilla Public') && text.includes('MPL'),
      name + ' carries the MPL notice, like every file of this project');
    assert(text.includes('Part ' + (index + 1) + ' of ' + onDisk.length),
      name + ' says it is part ' + (index + 1) + ' of ' + onDisk.length);
    assert(text.includes('/* ' + name + ' '),
      name + ' names itself in its own header, so a rename cannot leave a lie');
    const rules = [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .filter(m => m[1].trim());
    assert(rules.length > 0, name + ' holds at least one rule');
    const braces = (text.replace(/\/\*[\s\S]*?\*\//g, '').match(/[{}]/g) || []).length;
    assertEqual(braces % 2, 0, name + ' has balanced braces');
  });

  // What the browser ends up applying, in one string: the parts in the order the
  // manifest gives them. Every other check in this file that reads the theme
  // reads it this way, so this is the thing they are all reading.
  const whole = themeCss().text;
  for (const name of onDisk) {
    assert(whole.includes(read(dir + '/' + name).slice(0, 200)),
      name + ' is really in the concatenation every other check in this file reads');
  }
  assert(whole.includes('--stk-page'), 'the concatenation carries the palette');
  assertEqual(themeCss().files.map(file => file.slice(dir.length + 1)), onDisk,
    'and the harness reads the same parts, in the same order');
}

function importScriptsCheck() {
  console.log('static: importScripts targets');
  const background = read('src/background/worker.js');
  const targets = [...background.matchAll(/importScripts\(([^)]*)\)/g)]
    .flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(hit => hit[1]));
  assert(targets.length > 0, 'background declares importScripts');
  // importScripts resolves against the worker's own URL, and the worker is
  // src/background/worker.js. Checking the path as written would look in the
  // repository root for "../../assets/..." and either pass by accident or fail for
  // the wrong reason; what matters is the file it lands on.
  const workerDir = 'src/background';
  for (const file of targets) {
    const resolved = file.startsWith('/')
      ? file.slice(1)
      : path.posix.normalize(path.posix.join(workerDir, file));
    assert(!resolved.startsWith('..'),
      `an importScripts target does not walk out of the extension: ${file} -> ${resolved}`);
    assert(exists(resolved), `importScripts target exists: ${resolved} (from ${file})`);
  }
}

function iconCheck() {
  console.log('static: bundled icons');
  for (const icon of ['clip', 'duplicate', 'trash', 'cardtrader']) {
    assert(exists(`assets/icons/${icon}.svg`), `assets/icons/${icon}.svg bundled`);
  }
  assert(exists('assets/icons/edhrec.png'), 'assets/icons/edhrec.png bundled');
  // Cardmarket's symbol, as they distribute it, from the file they publish for
  // dark backgrounds. Cropped from their horizontal lockup — the wordmark beside
  // it and the empty margin are what is gone, the artwork is theirs untouched.
  // There is one file and not a black one and a white one: the mark is drawn as
  // a mask, so the colour comes from the heading and there is no variant to pick
  // wrongly. Shipping the black one again would put that risk back.
  assert(exists('assets/icons/cardmarket-white.png'), 'assets/icons/cardmarket-white.png bundled');
  const cm = fs.readFileSync(path.join(ROOT, 'assets/icons/cardmarket-white.png'));
  assertEqual([...cm.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'it is a real PNG');
  assertEqual([cm.readUInt32BE(16), cm.readUInt32BE(20)], [89, 93],
    'it is Cardmarket\'s symbol at its own proportions, not a stub');
  assert(!exists('assets/icons/cardmarket-black.png'),
    'the black variant is not shipped: the mark is a mask and has no variant to choose');
  assert(!exists('assets/icons/cardmarket.svg'),
    'the placeholder glyph is gone now that Cardmarket\'s own mark is used');
}

function cssCheck() {
  console.log('static: stylesheets');
  const css = read('src/styles/content.css');
  assert(css.includes('#main .prints > .prints-table .stk-native-print-add{'),
    'native print button styles exist');
  assert(css.includes('tbody tr:hover .stk-native-print-add'),
    'print buttons appear when their own printing is hovered');
  assert(css.includes('.stk-native-print-add:hover'),
    'the print button stays reachable while the pointer moves onto it');
  assert(css.includes('.stk-native-print-add::before{content:\'\''),
    'a bridge keeps the hover alive across the gap next to the row');
  assert(!/\.stk-native-print-add\{[^}]*pointer-events:none/.test(css),
    'the hidden print button still takes the pointer so it can be reached');
  assert(css.includes('.stk-native-print-add.stk-print-selected{opacity:1'),
    'a buffered printing keeps its check mark on screen');
  assert(css.includes('@media(hover:none)'),
    'print buttons stay reachable on touch screens');
  assert(css.includes('#main .prints > .prints-table .stk-print-group-row td{'),
    'set group header rows styled');
  assert(css.includes('#main .prints > .prints-table tbody tr[hidden]{display:none!important}'),
    'collapsed group rows are display:none');
  assert(!css.includes('#stk-all-prints'),
    'detached prints panel styles removed');
  assert(/\.card-grid-item:has\(>\.stk-add\)/.test(css),
    'grid add button anchors its parent item');
  for (const selector of [
    '#scryfall-toolkit-clipboard .stk-toolbar{', '.stk-count{', '.stk-list-row{',
    '.stk-copied', '#stk-tags{', '#stk-tags .stk-card-table',
    '#scryfall-toolkit-clipboard .stk-copy-wrap{',
    '#scryfall-toolkit-clipboard .stk-copy-menu[hidden]{display:none}',
    '#scryfall-toolkit-clipboard .stk-copy-plain',
    '#scryfall-toolkit-clipboard .stk-list-set',
    'stk-copied-pop', 'padding:14px 2px 16.5px 25px',
    '#main .card-text:has(.card-legality #stk-edhrec){padding-bottom:0!important}'
  ]) assert(css.includes(selector), `content.css styles ${selector}`);
  assert(/stk-copied-pop \.15s/.test(css), 'copied pop animation is quick');
  // 22px on a 125% zoom is 17.6 CSS px, which is 12px above the panel plus the
  // 5.6px the legality row itself adds above the border.
  assert(css.includes('margin-top:12px'), 'stats panel leaves 22px above itself at 125% zoom');
  assert(!css.includes('margin-left:4px'),
    'the salt meter offset is measured at runtime, not hard-coded');
  assert(css.includes('#main .prints > .prints-table tbody tr:has(.stk-native-print-add){position:relative}'),
    'print rows anchor their plus button');
  assert(css.includes('.stk-native-print-add{position:absolute;top:50%;right:-27px'),
    'print plus sits outside the name cell again');
  assert(css.includes('.stk-print-new-page-line{display:flex'),
    'new-page link shares the native printings line');
  assert(css.includes('.stk-print-group-row td>span{'),
    'group header label uses the native span-in-cell markup');
  assert(css.includes('.stk-print-group-row.stk-current-group td{'),
    'the set of the card being viewed is highlighted');
  assert(css.includes('#main .prints > .prints-table tbody tr:last-child{border-bottom:0!important;border-top:0!important}'),
    "Scryfall's own row hairlines and closing rule are gone, so no doubled separator is left");
  assert(css.includes('#main .prints > .prints-table tbody td{border-bottom:0!important;border-top:0!important}'),
    'the cells are cleared as well, should Scryfall ever draw a line on them');
  assert(!/\.stk-print-group-row td\{[^}]*border-top/.test(css),
    'a group header draws no line of its own, its background and the stripe say where it starts');
  assert(css.includes('tr.stk-group-end{border-bottom:0!important}'),
    "Scryfall's own hairline is cleared where the group stripe takes over");
  assert(css.includes('tr.stk-group-end td{border-bottom:2px solid #cfc3d6!important}'),
    'an open group is closed by a light stripe under its last row');
  assert(css.includes('tr.stk-print-group-row.stk-group-folded-end{border-bottom:0!important}'),
    "a folded group clears the original hairline at its own header");
  assert(css.includes('tr.stk-print-group-row.stk-group-folded-end td{border-bottom:2px solid #cfc3d6!important}'),
    'and closes the stripe there instead');
  assert(!css.includes('tr.stk-group-row'), 'the folded stripe goes to the class group headers really carry');
  assert(!css.includes('.stk-print-group-row td{') || !/\.stk-print-group-row td\{[^}]*user-select:none/.test(css),
    'the group label stays selectable so it can be copied');
  assert(css.includes('.stk-print-new-page-line.stk-print-line-end{justify-content:flex-end}'),
    'a lone full-page link sits on the right of the line');
  assert(css.includes('.stk-tag-icon.icon-flipped svg{transform:scale(-1,1)}'),
    'flipped tag icons rule exists');
  // The tag icons live in their own file now, and this is about their file.
  const flipLine = read('src/card-page/tags.js').split('\n').find(line => line.includes('icon-flipped'));
  assert(flipLine && !flipLine.includes('BETTER_THAN'),
    'BETTER_THAN no longer flips the relation icon');
  assert(flipLine && flipLine.includes('WORSE_THAN'),
    'WORSE_THAN flips the relation icon');

  const theme = themeCss().text;
  assert(/html\.stk-dark\{[^}]*--stk-link-purple:#c4a7ea/.test(theme),
    'dark theme link purple variable');
  assert(theme.includes('html.stk-dark #main .stk-brighter-purple{color:var(--stk-link-purple)!important}'),
    'brighter purple rule for dark theme');
  assert(!/color:#9073bf/.test(theme), 'the first, too dark link purple is gone from every page');
  assert(theme.includes('html.stk-dark #scryfall-toolkit-clipboard .stk-copy-menu{'),
    'dark styles for the names-only menu');
  assert(theme.includes('html.stk-dark #scryfall-toolkit-clipboard .stk-copied{background:#2f9e44!important}'),
    'dark copied feedback matches the vivid green');
  assert(theme.includes('html.stk-dark .prints-info-section,html.stk-dark .prints-info-section h2{color:#29252c!important}'),
    'dark theme keeps the gold info note readable');
  assert(theme.includes('html.stk-dark .card-grid-item-transform-button{'),
    'dark repaint for the Transform button');
  assert(!theme.includes('.card-grid-item-transform-button.spooky'),
    'spooky inversion removed so the flip button stays dark in both states');
  assert(theme.includes('html.stk-dark .card-actions .button-n{'),
    'dark repaint for the card-page action buttons');
  assert(theme.includes('html.stk-dark .prints-table .stk-print-group-row td{background:#2a2835!important'),
    'dark group header rows win over the light content rule');
  assert(theme.includes('html.stk-dark .prints-table .stk-print-group-row.stk-current-group td{'),
    'dark theme keeps the current group accent');
  assert(theme.includes('html.stk-dark #main .prints > .prints-table tbody tr:last-child{border-bottom:0!important;border-top:0!important}'),
    'the dark theme clears the native row hairlines as well, and outranks the light rule');
  assert(theme.includes('html.stk-dark #main .prints > .prints-table tr.stk-group-end td{'),
    'dark theme keeps the group closing stripe');
  assert(theme.includes('html.stk-dark #main .prints > .prints-table tr.stk-print-group-row.stk-group-folded-end td{'),
    'and the folded group stripe in the dark theme too');
  assert(theme.includes('html.stk-dark .prints-table :is(a,span).currency-eur{'),
    'dark theme recolors generated price spans too');
  assert(theme.includes('html.stk-dark .footer .footer-legal,html.stk-dark .footer .footer-legal p{color:#aaa8a6!important}'),
    "the footer's legal paragraphs are readable in the dark theme");
  assert(theme.includes('html.stk-dark body > h1{color:var(--stk-ink)!important}'),
    'the "Nothing Here" heading of a dead link is not left black');
  assert(theme.includes('html.stk-dark #main .card-legality dd{color:#16161d!important}'),
    'the legality pills keep dark ink on Scryfall light status fills');
  assert(theme.includes('html.stk-dark #main .reference-jump a.button-n'),
    'the jump bar button is repainted with the bar around it');
  assert(theme.includes('html.stk-dark.stk-bots-page #main :is(.bot-marketing-panel,.bot-marketing-panel-shadow) :is(p,span,div){background-color:transparent!important}'),
    'the bot panels lose their own light text surfaces');
  assert(theme.includes('html.stk-dark.stk-bots-page #main :is(.bot-marketing-panel,.bot-marketing-panel-shadow) .bot-marketing-panel-footer .button-n{'),
    'and the button inside a panel footer is repainted too, ahead of the transparent rule');
  assert(theme.includes('html.stk-dark #main .advanced-search-checkbox input[type="checkbox"]:checked{background-color:#756287!important;background-image:none!important;color:var(--stk-ink)!important}'),
    'the advanced-search checkbox reuses its own checkmark instead of stacking a second one');
  assert(!/advanced-search-checkbox input\[type="checkbox"\]:checked\{[^}]*background-image:url/.test(theme),
    'no duplicate checkmark image is layered over the native glyph');
  assert(theme.includes('html.stk-dark #main .form-row-label svg :is(path,g,circle,rect,polygon){fill:#bda1df!important}'),
    'the black label icons are brightened in the dark theme');
  assert(theme.includes('html.stk-dark #main :is(.select2-selection__choice,.select2-results__option) svg{filter:invert(1)'),
    'the black set symbols are repainted with a filter, which also reaches the ones spelling out fill="#000" inside the sprite');
  assert(!/select2-[^}]*svg\{[^}]*fill:/.test(theme),
    'no fill rule is aimed at the set symbols any more: it would miss the explicit black ones inside <use>');
  assert(theme.includes('html.stk-dark #main .select2-polarity{background-color:#75986e!important;color:#fff!important}'),
    'the "is" flag of a type uses the legality green');
  assert(theme.includes('html.stk-dark #main .select2-polarity.negative{background-color:#a71f2a!important;color:#fff!important}'),
    'the "not" flag uses the banned red');
  for (const rule of [
    'html.stk-dark.stk-tagger body{background-color:#191820',
    'html.stk-dark.stk-tagger #app{background-color:transparent',
    'html.stk-dark.stk-tagger .app-header{background-color:#2b253a',
    'html.stk-dark.stk-tagger .app-footer{background-color:#191820',
    'html.stk-dark.stk-tagger .tag-input-field{background-color:var\(--stk-panel-2\)!important',
    'html.stk-dark.stk-tagger .dialog :is(h1,p){color:var\(--stk-ink\)!important'
  ]) assert(theme.includes(rule), `Tagger rule present: ${rule.slice(0, 52)}`);
  const js = read('src/core/theme.js');
  assert(js.includes("tagger\\.scryfall\\.com"), 'theme.js marks the Tagger host');
  assert(!/repairSetSymbols|stk-light-set-symbol/.test(js),
    'the set symbols need no per-symbol repair, the stylesheet filter repaints them all');
  assert(/const selector = '[^']*strong/.test(js), 'the purple repair also looks at strong and the other text tags');
  assert(/const sinkIntoDark = value =>/.test(js) && /< 0\.22/.test(js),
    'the purple repair judges the colour itself, so any dark purple is lifted, not just one literal');
  assert(!/color === 'rgb\(99, 68, 150\)'/.test(js), 'the repair no longer matches a single hard-coded purple');
  // The scan reads a colour, so it has to happen when the stylesheet that
  // carries the colour is actually in. Scryfall's sheet is not an obstacle to a
  // content script, so the purple only exists after the load event.
  assert(/window\.addEventListener\('load', settle, \{once:true\}\)/.test(js),
    'the purple repair looks again on load, when Scryfall stylesheet has arrived');
  assert(/requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => scan\(\)\)\)/.test(js),
    'the repair settles one more time after the load event, for a late repaint');
  assert(/function repairBotsArtwork\(\)/.test(js) && /getImageData/.test(js) && /stk-light-screenshot/.test(js),
    'a light screenshot is measured and only then repainted');
  assert(/share >= 0\.8/.test(js),
    'a picture that mixes a light half with a dark one is left as Scryfall published it');
  assert(/repairBotsArtwork\(\);/.test(js), 'the screenshot repair runs with the dark theme');
  assert(/Never paint a footer band/.test(theme), 'footer band guard comment present');
  const stripped = theme.replace(/\/\*[\s\S]*?\*\//g, '');
  let offender = '';
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (/(?:^|[,\s>+~])\.footer(?:$|[\s,.:{>\s])/.test(selector) && /background/.test(match[2])) {
      offender = selector;
      break;
    }
  }
  assert(!offender, `footer rules never paint a background (offender: ${offender})`);
}

// A hover that paints the same colour as the resting state is not a hover. Two
// rows were doing exactly that, so the highlight the light page shows vanished.
// Every rule hangs off html.stk-dark, so until that class is on the document the
// page renders in Scryfall's own light theme. Setting it from the stored
// preference meant waiting on an asynchronous answer, and Scryfall painted white
// first on every navigation.
function firstPaintTest() {
  console.log('static: the dark class is set before the first paint');
  const js = read('src/core/theme.js');
  const syncDefault = js.indexOf('themeMode(\'auto\') === \'dark\'');
  const storageCall = js.indexOf('chrome.storage.local.get({ darkTheme');
  assert(syncDefault !== -1,
    'theme.js decides the theme from the system without waiting for storage');
  assert(storageCall !== -1, 'theme.js still reads the stored preference');
  assert(syncDefault < storageCall,
    'the synchronous decision comes first, so nothing paints light while storage answers');
  // The repairs run from the stored value only: they walk the DOM and must not
  // be called while the document is still empty.
  assert(/if \(themeMode\('auto'\) === 'dark'\) document\.documentElement\.classList\.add\('stk-dark'\);\s*\n\s*chrome\.storage\.local\.get/.test(js),
    'the synchronous step adds the class and does not run the repairs');
}

// Two rules once painted the same team-page band different colours and gave it
// different inks, so the background came from one and the text from the other:
// dark grey on dark grey. Only the dimmed band may remain.
function noDoublePaintingTest() {
  console.log('static: no surface is painted twice with disagreeing colours');
  const css = themeCss().text.replace(/\/\*[\s\S]*?\*\//g, '');
  const bands = css.match(/[^\n{]*\.team-header[^\n{]*\{[^}]*background[^}]*\}/g) || [];
  const paintsBackground = bands.filter(rule => /background-color:(?!transparent)/.test(rule));
  assertEqual(paintsBackground.length, 1,
    'exactly one rule paints the team header band');
  assert(/background-color:rgba\(255,255,255,0\.82\)/.test(paintsBackground[0] || ''),
    'and it is the dimmed white band the purple field is meant to keep');
}

// The palette has to hold the colours it replaced. Replacing a literal with a
// variable of a different value would change the theme while every rule still
// looked right.
// The theme paints over Scryfall by naming their markup. docs/scryfall-dom.md
// writes down every name it uses and what it is, so a renamed class is one file
// to look in instead of 358 rules. This keeps the two in step: a rule cannot
// quietly reach for a class nobody wrote down.
function domContractTest() {
  console.log('static: the stylesheet stays inside the DOM contract');
  const css = themeCss().text.replace(/\/\*[\s\S]*?\*\//g, '');
  const contract = read('docs/scryfall-dom.md');

  // Class names come out of selectors, not out of rule bodies: a data URI can
  // hold a domain, and .org is not a class name.
  const used = new Set();
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const c of m[1].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
      // The theme's own markers are set by theme.js; Scryfall knows nothing of them.
      if (!c[1].startsWith('stk-')) used.add(c[1]);
    }
  }

  // The contract lists its names in table rows, so that is what is read.
  const documented = new Set();
  for (const m of contract.matchAll(/^\| `\.([a-zA-Z][a-zA-Z0-9_-]*)` \|/gm)) documented.add(m[1]);

  const missing = [...used].filter(name => !documented.has(name));
  assertEqual(missing, [], 'every Scryfall class the theme uses is written down');

  const unused = [...documented].filter(name => !used.has(name));
  assertEqual(unused, [], 'and nothing is written down that the theme stopped using');
  assert(used.size > 200, 'the contract covers the real surface (' + used.size + ' names)');

  // The scripts name Scryfall's markup too. Those selectors are written down in
  // the same file, by name and without the leading dot or hash.
  const ourPrefixes = ['stk-', 'cleanup-improver__', 'modify-cleanup-', 'data-heading-'];
  const isOurs = name => ourPrefixes.some(prefix => name.replace(/^[.#[\]]+/, '').startsWith(prefix));
  const jsUsed = new Set();
  for (const file of ['src/card-page/core.js', 'src/deck-page/clean-up.js', 'src/deck-page/edhrec.js', 'src/deck-page/results.js', 'src/deck-page/search.js', 'src/core/theme.js']) {
    const js = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const m of js.matchAll(/querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]/g)) {
      for (const c of m[1].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) jsUsed.add(c[1]);
      for (const c of m[1].matchAll(/#([a-zA-Z][a-zA-Z0-9_-]*)/g)) jsUsed.add(c[1]);
      for (const c of m[1].matchAll(/\[(data-[a-z-]+)[=~|^$*]?=/g)) jsUsed.add('[' + c[1] + ']');
    }
    for (const m of js.matchAll(/getElementById\(\s*['"`]([a-zA-Z][a-zA-Z0-9_-]*)['"`]/g)) jsUsed.add(m[1]);
  }
  const jsDocumented = new Set();
  for (const m of contract.matchAll(/^\| `([a-zA-Z\[][^`]*)` \| (class|id|attribute) \|/gm)) jsDocumented.add(m[1]);
  const jsMissing = [...jsUsed].filter(name => !isOurs(name) && !jsDocumented.has(name));
  assertEqual(jsMissing, [], 'every Scryfall name the scripts reach for is written down');
  assert(jsDocumented.size > 30, 'the script selectors are inventoried too (' + jsDocumented.size + ' names)');
}

function paletteTest() {
  console.log('static: the palette holds the colours it replaced');
  const css = themeCss().text;
  for (const [name, value] of [
    ['--stk-page', '#1d2021'],
    ['--stk-panel', '#252829'],
    ['--stk-panel-2', '#292b2c'],
    ['--stk-ink', '#e6e3df'],
    ['--stk-link', '#c79ce3'],
    ['--stk-border', '#595c60'],
    ['--stk-border-2', '#414345'],
    ['--stk-hover', '#413949']
  ]) {
    assert(new RegExp(name + '\\s*:\\s*' + value.replace('#', '#') + '(?![0-9a-fA-F])').test(css),
      `${name} is ${value}`);
  }
  // And the roles are used, not just declared.
  for (const name of ['--stk-page', '--stk-panel-2', '--stk-ink']) {
    assert((css.match(new RegExp('var\\(' + name + '\\)', 'g')) || []).length > 3,
      `${name} is what the rules ask for`);
  }
}


// A panel that states its colours but not its surface.
//
// This is a bug a reader found, not one a reader reported: the deck editor's EDHREC
// panel listed its card names in #e6e3df, its type lines in #a29bb0 and its counts in
// #c9c3d4, and all of it was readable — against the dark surface Scryfall's dialog
// happens to have while this extension's dark theme is on. Nothing in our own thirty-
// three rules said "dark", because the background was never among them. Set the theme
// to light, the dialog came out white, and every card name in the list went invisible
// while the percentages stayed legible, which reads as a rendering fault rather than as
// a missing colour.
//
// So: a colour we declare has to come with the thing it sits on. That is checkable, and
// the check is here because nothing else would have caught it — the panel rendered, the
// rows were all there, and every assertion in this file passed.
function panelSurfaceTest() {
  console.log('static: our own panels declare the surface their text sits on');
  const css = themeCss().text;

  // Luminance and contrast, so the check is about whether the pair can be read rather
  // than about whether two strings are present. A check that only asked "is there a
  // background here" passed happily against a white one — which is precisely the bug,
  // in the exact form it was reported in.
  const channel = value => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = hex => {
    const n = parseInt(hex.replace('#', ''), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const hexIn = (text, property) => {
    // The boundary matters: without it "color" matches the tail of "background-color"
    // and the panel comes out with its background reading as its text colour, at a
    // contrast ratio of one to one — which is a check that passes on a broken panel.
    const match = text.match(new RegExp('(?:^|[;{\\s])' + property + '\\s*:\\s*(#[0-9a-fA-F]{3,8})'));
    return match ? match[1] : null;
  };

  const panelRules = [...css.matchAll(/\.modal-dialog\.stk-(?:edhrec|search)-panel[^{]*\{([^}]*)\}/g)]
    .map(match => match[1]);
  // The first rule for these selectors sets the width and no surface, so the one that
  // matters is whichever of them actually paints something behind the text.
  const panels = panelRules.filter(body => /background/.test(body));
  assertEqual(panels.length, 2, 'both of our deck dialogs declare a surface of their own');
  for (const [index, body] of panels.entries()) {
    const surface = hexIn(body, 'background-color');
    assert(surface, `panel ${index + 1} names a background colour`);
    const ink = hexIn(body, 'color') || '#e6e3df';
    assert(contrast(surface, ink) >= 4.5,
      `panel ${index + 1}: its own text reads on its own surface (${surface} vs ${ink}, ` +
      contrast(surface, ink).toFixed(1) + ':1, needs 4.5:1)');
  }

  // The rows sit on that surface, so the row colours are checked against it too. These
  // are the values that vanished in the light theme: the name, the type line, the count.
  const surface = hexIn(panels[0], 'background-color');
  for (const [selector, property] of [
    ['.stk-results-row-name', 'color'],
    ['.stk-results-row-type', 'color'],
    ['.stk-results-row-cost', 'color'],
    ['.stk-results-row-meta', 'color'],
    ['.stk-results-aside', 'color'],
    ['.stk-results-note', 'color'],
    ['.stk-results-group-title', 'color']
  ]) {
    const rule = (css.match(new RegExp('\\' + selector + '[^{]*\\{([^}]*)\\}')) || [])[1] || '';
    const value = hexIn(rule, property);
    assert(value, `${selector} names its text colour`);
    assert(contrast(surface, value) >= 3,
      `${selector} is readable on the panel surface (${surface} vs ${value}, ` +
      contrast(surface, value).toFixed(1) + ':1, needs 3:1)');
  }

  // And the deck editor is dark whatever our setting says, so the clipboard is styled
  // there from Scryfall's own root rather than from the theme switch.
  assert(/body:has\(#deckbuilder\)\s*#scryfall-toolkit-clipboard/.test(css),
    'the clipboard is styled for the deck editor, which Scryfall draws dark itself');
  // The marker must be theirs, not ours: a class of our own would have to be kept in
  // step with their markup, which is the dependency this project has been removing.
  assert(!/stk-deck-page/.test(css), 'and the marker is not a class of ours to keep in step');
}

function hoverStatesTest() {
  console.log('static: hover states differ from the resting state');
  const css = themeCss().text.replace(/\/\*[\s\S]*?\*\//g, '');
  const paint = '(#[0-9a-f]{3,8}|var\\(--stk-[a-z0-9-]+\\))';
  const resting = css.match(new RegExp('\\.faq-link\\{background:' + paint));
  const hovered = css.match(new RegExp('\\.faq-link:is\\(:hover,:active,:focus\\)\\{background:' + paint));
  assert(resting, 'the FAQ row has a resting colour');
  assert(hovered, 'the FAQ row has a hover colour');
  assert(resting[1] !== hovered[1],
    `the FAQ row changes under the pointer (${resting[1]} -> ${hovered[1]})`);
}

function auditGapCheck() {
  console.log('static: dark theme covers the surfaces the audit found');
  const theme = themeCss().text;
  const js = read('src/core/theme.js');
  // Each of these was a light surface on a live page with the dark theme on.
  for (const [what, pattern] of [
    ['the "Jump to" menu of a set page', /html\.stk-dark #main :is\(\.dropdown-menu-items,\.dropdown-menu-items ul/],
    ['the drop-down items themselves', /\.dropdown-menu-items :is\(a,button\)\{background-color:transparent/],
    ['the jump bar icons of the search reference', /\.reference-jump :is\(svg,g,path,circle,rect\):not\(\[fill="none"\]\)/],
    ['the blog index post cards', /\.blog-post-small[^{]*\{[^}]*background-color:var\(--stk-page\)/],
    ['the blog post pills', /\.blog-post-metadata[^{]*\.button-n\.tiny-n/],
    ['the deck list a post can embed', /\.scryfall-decklist-embed[^{]*\{background-color:var\(--stk-page\)/],
    // Three mana symbols are bare black glyphs with no coin behind them in the
    // artwork, so on a dark page they disappeared. They get the coin the other
    // symbols already carry inside their own image.
    ['the three coinless mana symbols', /html\.stk-dark :is\(\.card-symbol-H,\.card-symbol-L,\.card-symbol-D\)\{background-color:#c9c4be/],
    // The docs left column is Scryfall's own purple field. Flattening it to grey
    // took the page's colour with it, so it is left as Scryfall paints it.
    ['the docs left menu keeps Scryfall purple', /html\.stk-dark\.stk-docs-page #main :is\(\.reference-doc-menu,\.reference-doc-menu-expander\)\{background-color:#4f4255/],
    // The narrow-viewport search block kept Scryfall's own light field: a white
    // slab with dark buttons. Its controls are the set header's controls.
    ['the narrow search controls keep no light field', /html\.stk-dark \.search-controls-mobile\{background:var\(--stk-panel\)/],
    ['the narrow search controls match the header controls', /html\.stk-dark \.search-controls-mobile :is\(\.button-n,\.select-n\)\{background-color:rgba\(255,255,255,\.09\)/],
    // The deck tray wrapper held only buttons, and painting it as well left a
    // grey slab beside the backpack button.
    ['the deck tray buttons are not a surface', /html\.stk-dark \.deck-tray-buttons\{background-color:transparent/],
    // The team page's white band is dimmed over the purple field and keeps its
    // dark ink. A second rule painted the same band a dark grey and left the ink
    // dark too, which made the title unreadable.
    ['the team header band agrees with its ink', /html\.stk-dark\.stk-team-page #main \.team-header\{background-color:rgba\(255,255,255,0\.82\)/],
    // A native option list is drawn from the page's own colours, and was the one
    // light rectangle left on a dark page.
    ['the open option list carries no light field', /html\.stk-dark select option,html\.stk-dark select optgroup/],
    // Scryfall paints the blog post a light gradient. Setting only the colour
    // left that gradient painting over the dark field, so the page stayed white.
    // A gradient is a background-image, and reading backgroundColor says nothing.
    ['the blog post gradient is cleared', /html\.stk-dark\.stk-blog-page #main :is\(\.blog-post-large,[^{]*\)\{[^}]*background-image:none!important/],
    // The account forms are panels with a faint black border. On a dark page the
    // panel took the colour of the page and the border stayed a black hairline,
    // so the rectangle vanished on three of the four blocks.
    ['the account panels keep a visible edge', /html\.stk-dark\.stk-account-page #main \.form-n\{background-color:var\(--stk-panel\)!important;border:1px solid rgba\(255,255,255,0\.22\)/],
    // The header's inverted controls carry Scryfall's own translucent look, and
    // the broad button repaint was darkening one of them while the selects beside
    // it stayed translucent.
    ['the inverted controls keep their translucent look', /html\.stk-dark :is\(\.button-n,\.select-n\)\.inverted\{background-color:rgba\(255,255,255,\.09\)/],
    // The deck tray is a wrapper: Scryfall leaves it transparent and only the
    // button shows, so painting it put a grey slab beside the button.
    ['the deck tray is not a surface', /html\.stk-dark \.left-tray \.deck-tray\{background:transparent/],
    ['the bot documentation buttons', /\.marketing-features-item[^{]*:is\(a\.button-n/],
    ['the donation tiles', /\.donation-stripe-amount,\.donation-service\)\{background-color:var\(--stk-panel\)/],
    ['the button on Scryfall error pages', /html\.stk-dark :is\(a\.button,button\.button\)\{background-color:var\(--stk-panel-2\)/],
    ['the keyboard skip links', /a:is\(\[href\$="#main"\],\[href\$="#footer"\]\)\{background-color:var\(--stk-panel-2\)/],
    ['the faint dot in a set card grid header', /\.card-grid-header-dot\{color:#8f8a96/],
    ['the white form wrapper inside a deck menu', /\.dropdown-menu-items form\{background-color:transparent/],
    ['the black curve counts of the deck editor', /deckbuilder-cmc-stat[^{]*:is\(strong,b\)\{color:var\(--stk-ink\)/],
    ['the set code badge of a deck row', /\.deckbuilder-entry-badge,\.stk-deck-set-badge\)\{color:#dcd8e2/],
    ['the lighter band behind a deck column title', /#deckbuilder :is\(\.deckbuilder-section-title-bar,\.deckbuilder-entry\)\{background-color:var\(--stk-panel\)/],
    ['the duplicated panel copy on the bots page', /\.bot-marketing-panel-shadow :is\(\.bot-marketing-panel-desc/],
    ['the white text shadow on the bots page', /stk-bots-page #main :is\(p,h1,h2,h3,h4,h5,h6,a,span,b,li,div\)\{text-shadow:none/],
    ['the account form title band', /\.stk-account-light-bar\.form-n-title/],
    ['the browser autofill paint in the header search', /#header-search-field:-webkit-autofill/],
    ['the light screenshot of a Slack window', /img\.stk-light-screenshot\{filter:invert\(1\) hue-rotate\(180deg\)/],
    ['the light gradient on the page Scryfall builds without a main', /html\.stk-dark body\{background-image:none!important\}/],
    ['the purple drawing on that page', /body>svg :is\(path,g,circle,rect,polygon,ellipse\):not\(\[fill="none"\]\)\{fill:var\(--stk-link-purple\)/],
    ['the lighter box the deck columns made inside the page', /#deckbuilder :is\(\.deckbuilder-section,\.deckbuilder-column\)\{background-color:var\(--stk-page\)/],
    ['the white link button of a page that writes one into its prose', /html\.stk-dark \.button-n:not\(\.inverted\),html\.stk-dark \.select-n:not\(\.inverted\)\{background-color:var\(--stk-panel-2\)!important;color:var\(--stk-link\)/],
    ['the white hover Scryfall paints on every button', /\.button-n:is\(:hover,:active,:focus,:focus-visible\)[^{]*\{background-color:var\(--stk-hover\)!important;color:#fff/],
    ['the black ink a disabled button shows under the pointer', /\.button-n:is\(\.disabled,:disabled\)[^{]*\{background-color:var\(--stk-panel\)!important;color:#6f6b74/],
    ['the lifted purple under the pointer', /a\.stk-brighter-purple:is\(:hover,:active,:focus\)\{color:#d6c2f2/],
    // Scryfall hands the pointer a near-black ink in its prose, its account
    // forms and its checklists, which is where "the text turns black on hover"
    // came from.
    ['the near-black ink Scryfall gives a hovered prose link', /\.prose[^{]*a:is\(:hover,:active,:focus\):not\(\.button-n\)[^{]*\{color:var\(--stk-link-purple\)/],
    ['the white field a focused form input turns', /\.form-input,\.form-n-input,\.form-n-file-input-control[^{]*\{background-color:var\(--stk-panel-2\)/],
    ['the purple Scryfall fills a shape with', /\.prose-complex-h1[^{]*:not\(\[fill="none"\]\)[^{]*\{fill:var\(--stk-link-purple\)/],
    ['the purple notice and warning bar', /\.notification\.purple,\.read-only-warning,\.print-langs-item\.current\)\{background-color:var\(--stk-hover\)/],
    ['the purple curve meter of the deck editor', /cmc-stat-meter::\-webkit-progress-value\{background-color:var\(--stk-link-purple\)/],
    // Tagger marks a panel light and then paints a white of its own on top of
    // two of them: the tag sidebar and the tab it hangs from.
    ['the tag sidebar Tagger paints white inside a panel it calls light', /stk-tagger :is\(\.sidebar-panel,\.tags-menu,\.navigation\.active\)\{background-color:var\(--stk-panel\)/],
    ['the ink of the tag list', /stk-tagger :is\(\.sidebar-panel,\.tags-menu\) :is\(a,span,strong,li,div,p,label,input,button,td,th\)\{color:var\(--stk-ink\)/],
    // The team page is a purple marketing page: the white band is dimmed rather
    // than removed, so Scryfall's purple field behind it survives.
    ['the white band of the team page, dimmed', /stk-team-page #main \.team-header\{background-color:rgba\(255,255,255,0\.82\)/],
    ['the page field behind the team page', /stk-team-page #main \.main\{background-color:transparent/],
    ['the dark ink the dimmed band needs', /stk-team-page #main \.team-header :is\(h1,h2,h3,p,span,strong,em,b\)\{color:#16161d/]
  ]) assert(pattern.test(theme), `dark theme repaints ${what}`);

  // A brand band is a picture, not a surface. The Slack band on the bots page is
  // a white field carrying the Slack logo as its background image; repainting it
  // took the logo with it, and the background shorthand took the image with it
  // even where the colour was set on its own.
  assert(/if \(style\.backgroundImage && style\.backgroundImage !== 'none'\) continue;/.test(js),
    'the light-surface repair never marks a node that paints a picture');
  const shorthand = theme.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter(line => /stk-info-light-surface|stk-account-light-bar|stk-tagger/.test(line) && /\{[^}]*background:/.test(line));
  assert(!shorthand.length,
    `a light surface or a Tagger surface is never painted through the background shorthand (offenders: ${shorthand.join(' | ')})`);

  // Tagger is a separate app: every rule that paints it must be scoped to the
  // host class, and its own light areas have to bring their ink with them.
  const code = theme.replace(/\/\*[\s\S]*?\*\//g, '');
  const taggerRules = code.split('\n').filter(line => /stk-tagger/.test(line));
  assert(taggerRules.length >= 10, 'Tagger has its own block of rules');
  assert(taggerRules.every(line => line.trim().startsWith('html.stk-dark.stk-tagger')),
    'no Tagger rule can reach a Scryfall page');
  assert(/:is\(\.light-mode:not\(\.card-layout\):not\(\.sidebar\),\.sample-tags,\.card-layout--tagging\)\{background-color:var\(--stk-panel\)/.test(theme),
    'Tagger keeps its own dark design and only its light panels are repainted');
  assert(/stk-tagger body\{background-color:#191820/.test(theme) && /stk-tagger #app\{background-color:transparent/.test(theme),
    "Tagger keeps its own page field and a transparent #app, so its soft glow is not painted over");
  assert(!/stk-tagger \.blurry-background-art\{[^}]*background/.test(theme),
    "Tagger's own glow keeps the colour it came with");
  // Scryfall's file-input wrapper is a box the control sits in and paints nothing.
  // A broad [class*="file-input"] match filled it, and the fill was wider than the
  // control it held: a band of dark sticking out from under the button.
  const bareTheme = theme.replace(/\/\*[\s\S]*?\*\//g, '');
  assert(!/\[class\*="file-input"\]/.test(bareTheme),
    'no rule catches every class that merely contains "file-input"');
  assert(/stk-account-page #main \.form-n-file-input\{background-color:transparent!important/.test(theme),
    "Scryfall's file-input wrapper is left unpainted, so nothing sticks out from under the button");
  assert(/stk-account-page #main :is\(\.form-n-file-input-control,\.stk-account-upload-button\)\{background-color:var\(--stk-panel-2\)!important/.test(theme),
    'the file control itself still has a surface of its own on the dark page');
  assert(/stk-tagger :is\(\.sidebar-panel,\.tags-menu,\.navigation\.active\)\{background-color:var\(--stk-panel\)/.test(theme),
    'the tag sidebar and its tab are repainted, not only the panel Tagger marks light');
  // On a card page Tagger puts the light mark on .card-layout, which is the whole
  // layout: the panel, the card and the empty space under both. Filling that took
  // away the blurred card art Tagger shows there.
  assert(/stk-tagger :is\(\.light-mode:not\(\.card-layout\):not\(\.sidebar\),\.sample-tags,\.card-layout--tagging\)\{background-color:var\(--stk-panel\)/.test(theme),
    'the card layout and the sidebar scrim both keep the field Tagger lays over the page');
  assert(/:is\(\.light-mode,\.sample-tags,\.card-layout--tagging\) :is\(a,span,label,li,strong,em,b,i,p,div,section,article,h1,h2,h3,h4,h5,h6,dt,dd,td,th\)\{color:var\(--stk-ink\)/.test(theme),
    'the ink inside a repainted Tagger panel is repainted with it, not left grey');
  assert(/\/\* Tagger is a separate Vue app/.test(theme), 'the Tagger block explains why it stands alone');
}

async function darkThemeRuntime() {
  console.log('theme.js: dark theme and RU site language');
  const page = createPage({
    url: 'https://scryfall.com/',
    html: `<!DOCTYPE html><html><body>
      <div id="main">
        <table class="prints-table"><thead><tr><th>Legal</th></tr></thead></table>
        <a href="/card/x/1">Link</a>
      </div></body></html>`,
    state: { darkTheme: true, hideCasterIndicator: true, siteLanguage: 'ru' }
  });
  page.script('src/core/theme.js');
  await sleep(40);
  const { document, mock } = page;
  const root = document.documentElement;

  assert(root.classList.contains('stk-dark'), 'dark theme class applied');
  assert(root.classList.contains('stk-hide-caster'), 'caster indicator hidden');
  assert(root.classList.contains('stk-site-ru'), 'RU site language class applied');
  assertEqual(root.dataset.stkPurpleRepair, 'true', 'purple repair armed once');
  assert(document.querySelector('#main a').classList.contains('stk-brighter-purple'),
    'purple links repaired for dark theme');
  assertEqual(document.querySelector('.prints-table thead th').textContent, 'Легально',
    'RU site language translates Scryfall table headers');

  mock.fireChanges({
    darkTheme: { newValue: false },
    hideCasterIndicator: { newValue: false },
    siteLanguage: { newValue: 'en' }
  });
  assert(!root.classList.contains('stk-dark'), 'storage change removes dark class');
  assert(!root.classList.contains('stk-hide-caster'), 'storage change restores caster indicator');
  assert(!root.classList.contains('stk-site-ru'), 'storage change restores EN site language');
}

// The repair reads a link's colour to decide whether it is a dark purple. On a
// real page that read has to wait for Scryfall's stylesheet: at DOMContentLoaded
// the stylesheet is still in flight and every link wears the browser's default
// blue, so a scan that stops there finds nothing to lift and the page keeps
// Scryfall's own purple for good. This is that page, in that order.
async function purpleAfterStylesheetTest() {
  console.log('theme.js: the purple repair waits for the stylesheet that carries the purple');
  const page = createPage({
    url: 'https://scryfall.com/docs/api',
    html: `<!DOCTYPE html><html><head>
      <style id="scryfall-css">
        /* Scryfall's own rule. Until this sheet is in, a[href] is the UA blue. */
        .prose a{color:#634496}
      </style></head><body>
      <div id="main"><div class="prose">
        <a href="/docs/api/rate-limits">rate limits</a>
      </div></div></body></html>`,
    state: { darkTheme: 'dark' }
  });
  // The link is blue right now: the stylesheet has not been parsed into the page
  // yet, which is exactly the state the repair first sees.
  const link = page.document.querySelector('.prose a');
  assert(!link.classList.contains('stk-brighter-purple'),
    'before the stylesheet arrives there is no dark purple to lift');

  page.script('src/core/theme.js');
  await sleep(30);
  assertEqual(page.windowListenerCount('load'), 1,
    'the repair is waiting for the load event, since no node will be added');
  // Scryfall's stylesheet lands: the same link is now the site purple. Nothing
  // added a node, so only the load event can make the repair look again.
  page.fireWindow('load');
  await sleep(30);
  assert(page.document.querySelector('.prose a').classList.contains('stk-brighter-purple'),
    'the purple that arrived with the stylesheet is lifted after the load event');
}

async function systemThemeTest() {
  console.log('theme.js: theme follows the system unless it is set by hand');
  const page = createPage({
    url: 'https://scryfall.com/',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {},
    mediaDark: false
  });
  page.script('src/core/theme.js');
  await sleep(30);
  const root = page.document.documentElement;
  assert(!root.classList.contains('stk-dark'), 'a light system leaves Scryfall light while the theme is automatic');

  page.setSystemDark(true);
  assert(root.classList.contains('stk-dark'), 'the system switching to dark switches the page with it');
  page.setSystemDark(false);
  assert(!root.classList.contains('stk-dark'), 'and back again with the system');

  const pinned = createPage({
    url: 'https://scryfall.com/',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: { darkTheme: 'light' },
    mediaDark: true
  });
  pinned.script('src/core/theme.js');
  await sleep(30);
  assert(!pinned.document.documentElement.classList.contains('stk-dark'),
    'a light theme chosen by hand survives a dark system');
}

async function pathClasses() {
  console.log('theme.js: page path classes');
  const cases = [
    ['/profile', ['stk-account-page'], ['stk-info-page', 'stk-team-page']],
    ['/docs', ['stk-info-page', 'stk-docs-page'], ['stk-account-page']],
    ['/blog', ['stk-info-page', 'stk-blog-page'], ['stk-account-page']],
    ['/team', ['stk-team-page'], ['stk-info-page', 'stk-account-page']],
    ['/bots', ['stk-info-page', 'stk-docs-page', 'stk-bots-page'], ['stk-account-page']]
  ];
  for (const [pathname, expected, forbidden] of cases) {
    const page = createPage({
      url: `https://scryfall.com${pathname}`,
      html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
      state: {}
    });
    page.script('src/core/theme.js');
    for (const cls of expected) {
      assert(page.document.documentElement.classList.contains(cls),
        `${pathname} → ${cls}`);
    }
    for (const cls of forbidden) {
      assert(!page.document.documentElement.classList.contains(cls),
        `${pathname} avoids ${cls}`);
    }
  }
  // Tagger is a different host, so it gets its own mark and none of the
  // Scryfall page classes.
  const tagger = createPage({
    url: 'https://tagger.scryfall.com/tags/artwork/tomoya',
    html: '<!DOCTYPE html><html><body><div class="app-wrapper"></div></body></html>',
    state: {}
  });
  tagger.script('src/core/theme.js');
  assert(tagger.document.documentElement.classList.contains('stk-tagger'), 'Tagger host is marked stk-tagger');
  for (const cls of ['stk-account-page', 'stk-info-page', 'stk-team-page', 'stk-bots-page', 'stk-blog-page']) {
    assert(!tagger.document.documentElement.classList.contains(cls), `Tagger avoids ${cls}`);
  }
  const mainSite = createPage({
    url: 'https://scryfall.com/card/lea/54/counterspell',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {}
  });
  mainSite.script('src/core/theme.js');
  assert(!mainSite.document.documentElement.classList.contains('stk-tagger'), 'Scryfall itself is not marked as Tagger');
}

(async () => {
  try {
    await manifestIntegrity();
    firstPaintTest();
    noDoublePaintingTest();
    domContractTest();
    paletteTest();
    panelSurfaceTest();
    hoverStatesTest();
    auditGapCheck();
    syntaxCheck();
    themePartsTest();
    importScriptsCheck();
    iconCheck();
    cssCheck();
    await darkThemeRuntime();
    await purpleAfterStylesheetTest();
    await systemThemeTest();
    await pathClasses();
    summary('test-theme');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
