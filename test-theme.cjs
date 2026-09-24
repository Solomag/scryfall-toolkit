'use strict';
// theme.js and stylesheet tests: static integrity of manifest, styles and
// icons, plus dark/locale class handling at runtime.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  assert, assertEqual, summary, sleep, createPage, ROOT
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
    for (const file of group.js) referenced.add(file);
    for (const file of group.css) referenced.add(file);
  }
  referenced.add(manifest.options_page);
  referenced.add(manifest.action.default_popup);
  for (const value of Object.values(manifest.icons || {})) referenced.add(value);
  for (const file of referenced) assert(exists(file), `manifest references existing file: ${file}`);

  const readmeFirstLine = read('README.md').split('\n')[0];
  assertEqual(readmeFirstLine, `# Scryfall Toolkit — preview ${manifest.version}`,
    'README version matches manifest');
  const pkg = JSON.parse(read('package.json'));
  assertEqual(pkg.version, manifest.version, 'package.json version matches manifest');
}

function syntaxCheck() {
  console.log('static: syntax check');
  const files = [
    'background.js', 'content.js', 'theme.js', 'i18n.js', 'options.js',
    'format-catalog.js', 'format-overrides.js', 'tag-icons.js',
    'tagger-clipboard.js',
    'data/oracle-tags.js', 'data/illustration-tags-1.js',
    'data/illustration-tags-2.js', 'data/shambleshark-nicknames.js'
  ];
  const failures = [];
  for (const file of files) {
    try { new vm.Script(read(file), { filename: file }); }
    catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  assertEqual(failures, [], 'all extension scripts compile');
}

function importScriptsCheck() {
  console.log('static: importScripts targets');
  const background = read('background.js');
  const targets = [...background.matchAll(/importScripts\(([^)]*)\)/g)]
    .flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(hit => hit[1]));
  assert(targets.length > 0, 'background declares importScripts');
  for (const file of targets) assert(exists(file), `importScripts target exists: ${file}`);
}

function iconCheck() {
  console.log('static: bundled icons');
  for (const icon of ['clip', 'duplicate', 'trash', 'cardmarket', 'cardtrader']) {
    assert(exists(`icons/${icon}.svg`), `icons/${icon}.svg bundled`);
  }
  assert(exists('icons/edhrec.png'), 'icons/edhrec.png bundled');
}

function cssCheck() {
  console.log('static: stylesheets');
  const css = read('content.css');
  assert(css.includes('#main .prints > .prints-table .stk-native-print-add{'),
    'native print button styles exist');
  assert(css.includes('tbody tr:hover .stk-native-print-add'),
    'print buttons appear when their own printing is hovered');
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
  assert(css.includes('.stk-tag-icon.icon-flipped svg{transform:scale(-1,1)}'),
    'flipped tag icons rule exists');
  const flipLine = read('content.js').split('\n').find(line => line.includes('icon-flipped'));
  assert(flipLine && !flipLine.includes('BETTER_THAN'),
    'BETTER_THAN no longer flips the relation icon');
  assert(flipLine && flipLine.includes('WORSE_THAN'),
    'WORSE_THAN flips the relation icon');

  const theme = read('theme.css');
  assert(theme.includes('html.stk-dark{--stk-link-purple:#9073bf}'),
    'dark theme link purple variable');
  assert(theme.includes('html.stk-dark #main .stk-brighter-purple{color:#9073bf!important}'),
    'brighter purple rule for dark theme');
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
  assert(theme.includes('html.stk-dark .prints-table :is(a,span).currency-eur{'),
    'dark theme recolors generated price spans too');
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
  page.script('theme.js');
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
    page.script('theme.js');
    for (const cls of expected) {
      assert(page.document.documentElement.classList.contains(cls),
        `${pathname} → ${cls}`);
    }
    for (const cls of forbidden) {
      assert(!page.document.documentElement.classList.contains(cls),
        `${pathname} avoids ${cls}`);
    }
  }
}

(async () => {
  try {
    await manifestIntegrity();
    syntaxCheck();
    importScriptsCheck();
    iconCheck();
    cssCheck();
    await darkThemeRuntime();
    await pathClasses();
    summary('test-theme');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
