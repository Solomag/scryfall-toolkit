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
  assert(css.includes('tr:hover .stk-native-print-add'),
    'native print buttons revealed on row hover (tr:hover)');
  assert(css.includes('#stk-all-prints[hidden]{display:none}'),
    'hidden expanded-prints panel is display:none');
  assert(/\.card-grid-item:has\(>\.stk-add\)/.test(css),
    'grid add button anchors its parent item');
  for (const selector of [
    '#scryfall-toolkit-clipboard .stk-toolbar{', '.stk-count{', '.stk-list-row{',
    '.stk-copied', '#stk-tags{', '#stk-tags .stk-card-table',
    '#scryfall-toolkit-clipboard .stk-copy-wrap{',
    '#scryfall-toolkit-clipboard .stk-copy-menu[hidden]{display:none}',
    '#scryfall-toolkit-clipboard .stk-copy-plain',
    '#scryfall-toolkit-clipboard .stk-list-set'
  ]) assert(css.includes(selector), `content.css styles ${selector}`);
  assert(css.includes('.stk-tag-icon.icon-flipped svg{transform:scale(-1,1)}'),
    'flipped tag icons rule exists');
  const flipLine = read('content.js').split('\n').find(line => line.includes('icon-flipped'));
  assert(flipLine && !flipLine.includes('BETTER_THAN'),
    'BETTER_THAN no longer flips the relation icon');

  const theme = read('theme.css');
  assert(theme.includes('html.stk-dark{--stk-link-purple:#9073bf}'),
    'dark theme link purple variable');
  assert(theme.includes('html.stk-dark #main .stk-brighter-purple{color:#9073bf!important}'),
    'brighter purple rule for dark theme');
  assert(theme.includes('html.stk-dark #scryfall-toolkit-clipboard .stk-copy-menu{'),
    'dark styles for the names-only menu');
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
