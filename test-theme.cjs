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
  const taggerGroups = manifest.content_scripts.filter(group => group.matches.some(host => host.includes('tagger.scryfall.com')));
  assert(taggerGroups.length >= 1, 'manifest keeps a Tagger content script');
  assert(taggerGroups.some(group => group.js.includes('theme.js') && group.css.includes('theme.css')),
    'the theme is injected on Tagger as well, so the setting reaches it');
  assert(taggerGroups.some(group => group.run_at === 'document_start'), 'the Tagger theme runs at document_start');
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
  assert(theme.includes('html.stk-dark body > h1{color:#e6e3df!important}'),
    'the "Nothing Here" heading of a dead link is not left black');
  assert(theme.includes('html.stk-dark #main .card-legality dd{color:#16161d!important}'),
    'the legality pills keep dark ink on Scryfall light status fills');
  assert(theme.includes('html.stk-dark #main .reference-jump a.button-n'),
    'the jump bar button is repainted with the bar around it');
  assert(theme.includes('html.stk-dark.stk-bots-page #main :is(.bot-marketing-panel,.bot-marketing-panel-shadow) :is(p,span,div){background-color:transparent!important}'),
    'the bot panels lose their own light text surfaces');
  assert(theme.includes('html.stk-dark.stk-bots-page #main :is(.bot-marketing-panel,.bot-marketing-panel-shadow) .bot-marketing-panel-footer .button-n{'),
    'and the button inside a panel footer is repainted too, ahead of the transparent rule');
  assert(theme.includes('html.stk-dark #main .advanced-search-checkbox input[type="checkbox"]:checked{background-color:#756287!important;background-image:none!important;color:#e6e3df!important}'),
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
    'html.stk-dark.stk-tagger :is(.sample-tags,.light-mode){background:#252829!important',
    'html.stk-dark.stk-tagger .blurry-background-art{background:#3a3247!important',
    'html.stk-dark.stk-tagger .tag-input-field{background:#292b2c!important',
    'html.stk-dark.stk-tagger .dialog :is(h1,p){color:#e6e3df!important'
  ]) assert(theme.includes(rule), `Tagger rule present: ${rule.slice(0, 52)}`);
  const js = read('theme.js');
  assert(js.includes("tagger\\.scryfall\\.com"), 'theme.js marks the Tagger host');
  assert(!/repairSetSymbols|stk-light-set-symbol/.test(js),
    'the set symbols need no per-symbol repair, the stylesheet filter repaints them all');
  assert(/const selector = '[^']*strong/.test(js), 'the purple repair also looks at strong and the other text tags');
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

async function systemThemeTest() {
  console.log('theme.js: theme follows the system unless it is set by hand');
  const page = createPage({
    url: 'https://scryfall.com/',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {},
    mediaDark: false
  });
  page.script('theme.js');
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
  pinned.script('theme.js');
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
  // Tagger is a different host, so it gets its own mark and none of the
  // Scryfall page classes.
  const tagger = createPage({
    url: 'https://tagger.scryfall.com/tags/artwork/tomoya',
    html: '<!DOCTYPE html><html><body><div class="app-wrapper"></div></body></html>',
    state: {}
  });
  tagger.script('theme.js');
  assert(tagger.document.documentElement.classList.contains('stk-tagger'), 'Tagger host is marked stk-tagger');
  for (const cls of ['stk-account-page', 'stk-info-page', 'stk-team-page', 'stk-bots-page', 'stk-blog-page']) {
    assert(!tagger.document.documentElement.classList.contains(cls), `Tagger avoids ${cls}`);
  }
  const mainSite = createPage({
    url: 'https://scryfall.com/card/lea/54/counterspell',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {}
  });
  mainSite.script('theme.js');
  assert(!mainSite.document.documentElement.classList.contains('stk-tagger'), 'Scryfall itself is not marked as Tagger');
}

(async () => {
  try {
    await manifestIntegrity();
    syntaxCheck();
    importScriptsCheck();
    iconCheck();
    cssCheck();
    await darkThemeRuntime();
    await systemThemeTest();
    await pathClasses();
    summary('test-theme');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
