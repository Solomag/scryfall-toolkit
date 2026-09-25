'use strict';
// options.js tests: format list rendering, visibility, keyboard and drag
// reorder, setting persistence and language switching.
const fs = require('node:fs');
const path = require('node:path');
const {
  assert, assertEqual, summary, createPage, click, keyDown, fireEvent,
  dataTransferObject, ROOT
} = require('./testlib.cjs');

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const REQUIRED_IDS = [
  'status', 'formatList', 'openOptions', 'cardtraderToken', 'tokenStatus',
  'cardtraderTokenLabel', 'saveToken', 'removeToken', 'settingsLanguage',
  'siteLanguage', 'usageColorMetric', 'usageCountThresholds',
  'usagePercentThresholds', 'usageMediumDecks', 'usageHighDecks',
  'usageMediumPercent', 'usageHighPercent', 'saltMediumThreshold',
  'saltHighThreshold', 'clipboard', 'printAddButtons', 'printPageSameTab', 'darkTheme',
  'hideCasterIndicator', 'hideDigitalSets', 'hideNonTournamentSets',
  'hideOversizedSets', 'hideForeignBlackBorder', 'hideNonEnglishPrints',
  'tags', 'cardTags', 'artTags', 'relationships', 'finishBadges',
  'onlyCardmarket', 'cardtraderPrices', 'euroPriceSources', 'edhrecUsage',
  'edhrecSalt', 'showSaltScale', 'edhrecLink', 'edhrecUsageDisplay',
  'legalities', 'exportFormat', 'taggerSearchLinks', 'cardSearchLinks',
  'cardNicknames', 'deckNoPrices', 'stackedDeckCards', 'deckTokens',
  'setPlatformsAll', 'setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo'
];

function htmlIdCheck() {
  console.log('options.html: element ids');
  const html = read('options.html');
  for (const id of REQUIRED_IDS) {
    assert(html.includes(`id="${id}"`), `options.html has #${id}`);
  }
}

function sectionOrderTest() {
  console.log('options.html: section order and grouping');
  const html = read('options.html');
  const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]);
  assertEqual(headings, ['Общее', 'Tags', 'CardClip', 'Скрытие лишнего', 'Дополнительная информация',
    'Легальность', 'Scryfall Deckbuilder', 'Экспериментальное'],
    'sections follow the agreed order with Experimental last');
  // Every control belongs to the section the user asked for.
  const sectionOf = id => {
    const at = html.indexOf(`id="${id}"`);
    const before = html.slice(0, at);
    const heading = [...before.matchAll(/<h2>([^<]+)<\/h2>/g)].pop();
    return heading ? heading[1] : null;
  };
  assertEqual(sectionOf('settingsLanguage'), 'Общее', 'the settings language sits in Общее');
  assertEqual(sectionOf('darkTheme'), 'Общее', 'the theme selector sits in Общее');
  assertEqual(sectionOf('tags'), 'Tags', 'card page tags got their own category');
  assertEqual(sectionOf('cardTags'), 'Tags', 'the tag kinds stay with the tag switch');
  assertEqual(sectionOf('taggerSearchLinks'), 'Tags', 'the Tagger link on search results stays in Tags');
  assertEqual(sectionOf('clipboard'), 'CardClip', 'the shared buffer moved to CardClip');
  assertEqual(sectionOf('exportFormat'), 'CardClip', 'the copy format stays in CardClip');
  assertEqual(sectionOf('printAddButtons'), 'CardClip', 'the per-printing plus button moved to CardClip');
  assertEqual(sectionOf('hideCasterIndicator'), 'Скрытие лишнего', 'the Caster indicator moved to Скрытие лишнего');
  assertEqual(sectionOf('onlyCardmarket'), 'Скрытие лишнего', 'hiding prices moved to Скрытие лишнего');
  assertEqual(sectionOf('hideNonEnglishPrints'), 'Скрытие лишнего', 'the set filters live in one category');
  assertEqual(sectionOf('setPlatformsAll'), 'Скрытие лишнего', 'the platform filter is nested under Скрытие лишнего');
  assert(html.indexOf('id="setPlatformsAll"') > html.indexOf('class="experimental-sub"'),
    'the platform filter sits inside the experimental sub-block');
  assertEqual(sectionOf('finishBadges'), 'Дополнительная информация', 'the finish column moved to Additional info');
  assertEqual(sectionOf('cardSearchLinks'), 'Дополнительная информация', 'type and mana search moved to Additional info');
  assertEqual(sectionOf('cardNicknames'), 'Дополнительная информация', 'card nicknames moved to Additional info');
  assertEqual(sectionOf('edhrecUsage'), 'Дополнительная информация', 'EDHREC is a sub-category of Additional info');
  assertEqual(sectionOf('cardtraderPrices'), 'Дополнительная информация', 'CardTrader is a sub-category of Additional info');
  assertEqual(sectionOf('deckTokens'), 'Scryfall Deckbuilder', 'deck options share one category');
  assertEqual(sectionOf('printPageSameTab'), 'Экспериментальное', 'the same-tab printings switch stays in Experimental');
  assertEqual(sectionOf('siteLanguage'), 'Экспериментальное', 'the site language selector moved to the bottom');
  assert(html.indexOf('id="siteLanguage"') > html.indexOf('id="deckTokens"'),
    'the site language selector is the last control of the page');
  // EDHREC and CardTrader are grouped, not separate sections of their own.
  const additional = html.slice(html.indexOf('<h2>Дополнительная информация</h2>'), html.indexOf('<h2>Легальность</h2>'));
  assertEqual([...additional.matchAll(/<legend>([^<]+)<\/legend>/g)].map(match => match[1]), ['EDHREC', 'CardTrader'],
    'EDHREC and CardTrader are labelled sub-categories inside Additional info');
}

function loadOptions(state) {
  const page = createPage({
    url: 'chrome-extension://scryfall-toolkit/options.html',
    html: read('options.html'),
    state
  });
  // linkedom does not implement <select>.value; give every select a working
  // value accessor so options.js can read and write selections.
  for (const select of page.document.querySelectorAll('select')) {
    let value = select.querySelector('option')?.value ?? '';
    Object.defineProperty(select, 'value', {
      configurable: true,
      get: () => value,
      set: next => { value = String(next); }
    });
  }
  page.script('i18n.js');
  page.script('format-catalog.js');
  page.script('options.js');
  return page;
}

async function formatListTest() {
  console.log('options.js: format list');
  const page = loadOptions({});
  const { document, mock } = page;

  const rows = [...document.querySelectorAll('#formatList .format-item')];
  const { STK_FORMAT_CATALOG } = page.context;
  assertEqual(rows.length, STK_FORMAT_CATALOG.length, 'one row per catalog format');
  assertEqual(rows[0].dataset.key, 'standard', 'first row follows catalog order');
  assert(rows[0].title.includes('Standard'), 'row title names the format');
  assertEqual(rows[0].querySelector('.handle').textContent, '⠿', 'drag handle rendered');
  assertEqual(rows[0].draggable, true, 'row is draggable');
  assertEqual(rows[0].getAttribute('tabindex'), '0', 'row is focusable');

  const standard = rows.find(row => row.dataset.key === 'standard');
  assertEqual(standard.querySelector('input[type="checkbox"]').checked, true,
    'standard is visible by default');
  const premodern = rows.find(row => row.dataset.key === 'premodern');
  assertEqual(premodern.querySelector('input[type="checkbox"]').checked, true,
    'extra formats follow their own setting default');

  // Visibility checkbox persists formatVisibility.
  const standardBox = standard.querySelector('input[type="checkbox"]');
  standardBox.checked = false;
  fireEvent(standardBox, 'change');
  assertEqual(mock.state.formatVisibility, { standard: false },
    'hiding a format persists to formatVisibility');
  assert(standard.classList.contains('is-hidden'), 'hidden row gets is-hidden');
  assertEqual(document.getElementById('status').textContent, 'Порядок и видимость сохранены',
    'status confirms the reorder/visibility save');

  // Re-hide for a deterministic reorder test below.
  standardBox.checked = true;
  fireEvent(standardBox, 'change');
  assert(!standard.classList.contains('is-hidden'), 're-checking shows the row again');

  // ArrowRight swaps with the next row.
  keyDown(standard, 'ArrowRight');
  assertEqual(mock.state.formatOrder.slice(0, 2), ['alchemy', 'standard'],
    'ArrowRight moves the row one slot forward');

  // Drag and drop reorders too.
  const orderAfterKeys = [...mock.state.formatOrder];
  const dt = dataTransferObject();
  const pioneer = document.querySelector('#formatList [data-key="pioneer"]');
  const modern = document.querySelector('#formatList [data-key="modern"]');
  fireEvent(pioneer, 'dragstart', { dataTransfer: dt });
  assertEqual(dt.store['text/plain'], 'pioneer', 'dragstart records the dragged format');
  fireEvent(modern, 'drop', { dataTransfer: dt });
  const expected = [...orderAfterKeys];
  expected.splice(expected.indexOf('pioneer'), 1);
  expected.splice(expected.indexOf('modern'), 0, 'pioneer');
  assertEqual(mock.state.formatOrder, expected, 'drop moves the row next to the target');
  assertEqual(document.getElementById('status').textContent, 'Порядок и видимость сохранены',
    'drop confirms the save');
}

async function settingsTest() {
  console.log('options.js: basic settings');
  const page = loadOptions({});
  const { document, mock } = page;

  const darkTheme = document.getElementById('darkTheme');
  assertEqual(darkTheme.value, 'auto', 'the theme follows the system until it is chosen by hand');
  darkTheme.value = 'dark';
  fireEvent(darkTheme, 'change');
  assertEqual(mock.state.darkTheme, 'dark', 'choosing the dark theme persists the mode as text');
  assertEqual(document.getElementById('status').textContent, 'Сохранено', 'save confirmed in Russian');

  const sameTab = document.getElementById('printPageSameTab');
  assertEqual(sameTab.checked, false, 'printPageSameTab starts unchecked');
  sameTab.checked = true;
  fireEvent(sameTab, 'change');
  assertEqual(mock.state.printPageSameTab, true, 'the same-tab printings link setting persists');

  const exportFormat = document.getElementById('exportFormat');
  assertEqual(exportFormat.value, 'moxfield', 'export format defaults to with-sets');
  exportFormat.value = 'names';
  fireEvent(exportFormat, 'change');
  assertEqual(mock.state.exportFormat, 'names', 'export format persists');

  click(document.getElementById('openOptions'));
  assertEqual(mock.openOptionsPageCalls.length, 1, 'openOptions opens the options page');
}

async function setPlatformsTest() {
  console.log('options.js: platform checkboxes');
  const page = loadOptions({});
  const { document, mock } = page;
  const all = document.getElementById('setPlatformsAll');
  const boxes = ['setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo']
    .map(id => document.getElementById(id));
  assertEqual([all.checked, ...boxes.map(box => box.checked)], [true, true, true, true],
    'every platform starts checked, so All is checked as well');

  boxes[1].checked = false;
  boxes[2].checked = false;
  fireEvent(boxes[1], 'change');
  assertEqual(mock.state.setPlatforms, ['paper'], 'leaving Paper alone is stored as the only platform');
  assertEqual(all.checked, false, 'All is cleared once a platform is dropped');

  all.checked = true;
  fireEvent(all, 'change');
  assertEqual(mock.state.setPlatforms, ['paper', 'arena', 'mtgo'], 'All restores every platform');

  boxes[0].checked = false;
  boxes[1].checked = false;
  boxes[2].checked = false;
  fireEvent(boxes[2], 'change');
  assertEqual(mock.state.setPlatforms, ['paper', 'arena', 'mtgo'],
    'dropping the last platform falls back to All instead of an empty list');
  assertEqual([all.checked, ...boxes.map(box => box.checked)], [true, true, true, true], 'and the boxes show it');

  const stored = loadOptions({ setPlatforms: ['mtgo'] });
  assertEqual(
    [stored.document.getElementById('setPlatformsAll').checked,
      ...['setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo'].map(id => stored.document.getElementById(id).checked)],
    [false, false, false, true],
    'a stored single-platform choice is restored'
  );
}

async function themeModeTest() {
  console.log('options.js: theme mode');
  // Installations from before the three-way choice stored a boolean, so the
  // page has to show what that boolean meant.
  const legacy = loadOptions({ darkTheme: true });
  assertEqual(legacy.document.getElementById('darkTheme').value, 'dark', 'a stored true opens on the dark theme');
  const legacyLight = loadOptions({ darkTheme: false });
  assertEqual(legacyLight.document.getElementById('darkTheme').value, 'light', 'a stored false opens on the light theme');
  const stored = loadOptions({ darkTheme: 'light' });
  assertEqual(stored.document.getElementById('darkTheme').value, 'light', 'a stored mode is shown as it is');
}

async function languageTest() {
  console.log('options.js: settings language');
  const page = loadOptions({});
  const { document, mock } = page;
  assertEqual(document.documentElement.lang, 'ru', 'document language starts Russian');

  const settingsLanguage = document.getElementById('settingsLanguage');
  assertEqual(settingsLanguage.value, 'ru', 'language select starts Russian');
  settingsLanguage.value = 'en';
  fireEvent(settingsLanguage, 'change');
  assertEqual(mock.state.settingsLanguage, 'en', 'language choice persists');
  assertEqual(document.documentElement.lang, 'en', 'document language switches to English');
  assertEqual(document.getElementById('status').textContent, 'Saved', 'status is translated on the fly');
}

async function discoveredFormatsTest() {
  console.log('options.js: discovered formats');
  const page = loadOptions({ discoveredFormats: [{ key: 'myformat', label: 'My Format' }] });
  const { document } = page;
  const rows = [...document.querySelectorAll('#formatList .format-item')];
  const { STK_FORMAT_CATALOG } = page.context;
  assertEqual(rows.length, STK_FORMAT_CATALOG.length + 1, 'discovered formats add a row');
  const extra = rows.find(row => row.dataset.key === 'myformat');
  assert(extra, 'discovered format row rendered');
  assert(extra.textContent.includes('My Format'), 'discovered format shows its label');
}

(async () => {
  try {
    htmlIdCheck();
    sectionOrderTest();
    await formatListTest();
    await settingsTest();
    await setPlatformsTest();
    await themeModeTest();
    await languageTest();
    await discoveredFormatsTest();
    summary('test-options');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
