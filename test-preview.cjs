'use strict';
// content.js end-to-end: card page and search page over linkedom.
const {
  assert, assertEqual, summary, sleep, waitFor, createPage, click
} = require('./testlib.cjs');

const ORACLE_ID = '00000000-0000-4000-8000-000000000001';
const REL_ID = '55555555-5555-4555-8555-555555555555';
const PRINT_CURRENT = '22222222-2222-4222-8222-222222222222';
const PRINT_TST2 = '33333333-3333-4333-8333-333333333333';
const PRINT_MH3 = '44444444-4444-4444-8444-444444444444';

const CARD_HTML = `<!DOCTYPE html><html><head>
<meta name="scryfall:card:id" content="11111111-1111-4111-8111-111111111111">
<meta name="scryfall:oracle:id" content="${ORACLE_ID}">
<title>Test Card</title></head><body>
<div id="main"><div class="inner-flex">
  <div class="card-image"><img src="https://cards.scryfall.io/normal/x.jpg" alt=""></div>
  <div class="card-text"><div class="card-text-card-name">Test Card</div></div>
  <div class="prints">
    <table class="prints-table">
      <thead><tr><th>Name</th><th>Set</th></tr></thead>
      <tbody>
        <tr class="current"><td><a data-card-id="${PRINT_CURRENT}" href="https://scryfall.com/card/tst/1/test-card">Test Card (TST) 1</a></td><td>TST</td></tr>
        <tr><td><a data-card-id="${PRINT_TST2}" href="https://scryfall.com/card/tst/2/test-card">Test Card (TST) 2</a></td><td>TST</td></tr>
        <tr><td><a data-card-id="${PRINT_MH3}" href="https://scryfall.com/card/mh3/42/test-card">Test Card (MH3) 42</a></td><td>MH3</td></tr>
      </tbody>
    </table>
    <div class="prints-all"><a href="https://scryfall.com/card/tst/1/printings">View all prints</a></div>
  </div>
  <div class="card-legality">
    <div class="card-legality-row">
      <div class="card-legality-item"><dt>Standard</dt><dd class="legal">Legal</dd></div>
      <div class="card-legality-item"><dt>Modern</dt><dd class="legal">Legal</dd></div>
    </div>
  </div>
</div></div>
</body></html>`;

const prints = [
  { id: 'p1', name: 'Test Card', uri: 'https://scryfall.com/card/tst/1/test-card', set: 'tst', setName: 'Test Set', number: '1', lang: 'en', digital: false, finishes: ['nonfoil'], prices: { eur: '1.00' } },
  { id: 'p2', name: 'Test Card', uri: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', setName: 'Test Set', number: '3', lang: 'en', digital: false, finishes: ['nonfoil'], prices: {} },
  { id: 'p3', name: 'Test Card', uri: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', setName: 'Modern Horizons 3', number: '42', lang: 'jp', digital: false, finishes: ['foil'], prices: {} }
];

const routes = {
  tags: () => ({
    card: [
      { name: 'Aggro', slug: 'aggro', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Other Card', targetId: REL_ID, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' }
    ],
    art: [],
    fallback: false
  }),
  finishes: message => ({
    [message.ids[0]]: { finishes: ['nonfoil'], promoTypes: [] },
    [message.ids[1]]: { finishes: ['foil'], promoTypes: [] },
    [message.ids[2]]: { finishes: ['etched'], promoTypes: [] }
  }),
  card: () => ({ oracle_id: ORACLE_ID, legalities: { premodern: 'legal', legacy: 'banned' } }),
  allPrints: () => ({ prints, truncated: false }),
  preview: () => ({ name: 'Other Card', image: 'https://cards.scryfall.io/normal/o.jpg', uri: 'https://scryfall.com/card/oth/1/other-card' })
};

async function loadCardPage(state) {
  const page = createPage({ url: 'https://scryfall.com/card/tst/1/test-card', html: CARD_HTML, state, routes });
  await page.script('i18n.js');
  await page.script('format-catalog.js');
  await page.script('tag-icons.js');
  await page.script('data/shambleshark-nicknames.js');
  await page.script('content.js');
  await sleep(60);
  return page;
}

async function cardPageTest() {
  console.log('content.js: card page');
  const page = await loadCardPage({ cards: [] });
  const { document, mock, location } = page;

  // Clipboard shell.
  const aside = document.getElementById('scryfall-toolkit-clipboard');
  assert(aside, 'clipboard aside is injected');
  assertEqual(aside.querySelector('.stk-toolbar').children.length, 3, 'toolbar has copy, clear and open buttons');
  const list = aside.querySelector('.stk-list');
  assert(list.hidden, 'clipboard list starts hidden');
  click(aside.querySelector('.stk-icon-clip'));
  assert(!list.hidden, 'clip button reveals the list');

  // Card page scan button.
  const scanButton = document.querySelector('.card-image .stk-add');
  assert(scanButton, 'grid-less card page gets an add button on the card image');
  assertEqual(scanButton.textContent, '+', 'fresh card is not selected yet');

  // Native print buttons live inside the native prints table.
  const nativeButtons = [...document.querySelectorAll('#main .prints-table .stk-native-print-add')];
  assertEqual(nativeButtons.length, 2, 'only non-current print rows get native add buttons');
  assert(!document.querySelector('tr.current .stk-native-print-add'), 'current printing row stays untouched');

  // Finish badges from the finishes response.
  assert(document.querySelector('.stk-finish-header'), 'finish column header is added');
  assertEqual(document.querySelectorAll('.stk-finish-badge').length, 3, 'every print link gets a finish badge');
  assertEqual(document.querySelectorAll('.stk-finish-nonfoil').length, 1, 'nonfoil badge rendered');
  assertEqual(document.querySelectorAll('.stk-finish-foil').length, 1, 'foil badge rendered');
  assertEqual(document.querySelectorAll('.stk-finish-etched').length, 1, 'etched badge rendered');

  // Tags panel.
  const tagsPanel = await waitFor(
    () => (document.getElementById('stk-tags') && !document.getElementById('stk-tags').classList.contains('stk-loading')
      ? document.getElementById('stk-tags') : null),
    '#stk-tags to load'
  );
  assert(tagsPanel.querySelector('.stk-card-table'), 'card tags table rendered');
  const relationLink = await waitFor(
    () => tagsPanel.querySelector('.stk-related-table a[title*="better than"]'),
    'relation link with correct tooltip'
  );
  assertEqual(relationLink.title, 'better than: Other Card', 'BETTER_THAN relation tooltip reads better than');
  assertEqual(
    relationLink.getAttribute('href'),
    `/search?q=${encodeURIComponent(`oracleid:${REL_ID}`)}`,
    'relation link falls back to an oracle search URL'
  );
  const tagIcon = relationLink.closest('tr').querySelector('.stk-tag-icon');
  assert(tagIcon, 'relation row has a tag icon');
  assert(tagIcon.title.toLowerCase().includes('better'), 'icon tooltip says better, not worse');

  // Related card click opens its real card page via preview.
  click(relationLink);
  await waitFor(() => location.assigned.includes('https://scryfall.com/card/oth/1/other-card'), 'relation navigation');

  // Legalities: extra premodern row from the card response.
  await waitFor(() => /Premodern/.test(document.querySelector('#main .card-legality').textContent), 'premodern legality cell');
  const legalityTable = document.querySelector('#main .card-legality');
  assertEqual(legalityTable.querySelectorAll('dt').length, 3, 'catalog rows plus Premodern row are present');
  const premodernCell = [...legalityTable.querySelectorAll('.card-legality-item')]
    .find(cell => cell.querySelector('dt').textContent === 'Premodern');
  assertEqual(premodernCell.querySelector('dd').textContent, 'Legal', 'Premodern legality is Legal');

  // Add the current printing through the scan button.
  click(scanButton);
  await waitFor(() => scanButton.textContent === '✓', 'scan button selected');
  assertEqual(mock.state.cards.length, 1, 'card added through scan button');
  assertEqual(mock.state.cards[0], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/1/test-card', set: 'tst', number: '1'
  }, 'scan card saved with set and number, without forceSet');

  // Native print buttons add printings with forceSet. Their label updates only
  // after the async add resolves, so wait on the label itself.
  click(nativeButtons[0]);
  await waitFor(() => nativeButtons[0].textContent === '✓', 'first native print button selected');
  assertEqual(mock.state.cards.length, 2, 'first native print added');
  assertEqual(mock.state.cards[1], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/2/test-card', set: 'tst', number: '2', forceSet: true
  }, 'native print saved with forceSet');
  click(nativeButtons[1]);
  await waitFor(() => nativeButtons[1].textContent === '✓', 'second native print button selected');
  assertEqual(mock.state.cards.length, 3, 'second native print added');
  assertEqual(mock.state.cards[2], {
    name: 'Test Card', url: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', number: '42', forceSet: true
  }, 'second native print saved with forceSet');

  // Copy all: default names format keeps set for forceSet cards only.
  const copyAll = aside.querySelector('.stk-toolbar .stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0],
    '1 Test Card\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'names format: plain card plain, forceSet cards with set code');

  // Moxfield format adds the set to every card.
  mock.state.exportFormat = 'moxfield';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 2, 'second copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[1],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'moxfield format: every card carries its set code');

  // Expanded prints inside the native "View all prints" link.
  const nativeLink = document.querySelector('#main .prints-all a');
  const panel = document.getElementById('stk-all-prints');
  assert(panel, 'native prints panel injected after the table');
  assert(panel.hidden, 'native prints panel starts hidden');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded starts false');
  click(nativeLink);
  assert(!panel.hidden, 'clicking View all prints reveals the panel');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'true', 'aria-expanded flips to true');
  await waitFor(() => panel.querySelectorAll('.stk-print-group').length === 2, 'prints grouped by set');
  const summaries = [...panel.querySelectorAll('summary')].map(node => node.textContent);
  assertEqual(summaries, ['Test Set (TST) · 2', 'Modern Horizons 3 (MH3) · 1'], 'group summaries carry set name, code and count');
  assertEqual(panel.querySelectorAll('.stk-print-add').length, 3, 'every printing row gets an add button');
  assert(
    panel.querySelector('.stk-prints-new-page').href === nativeLink.href,
    'new-page link keeps the native printings URL'
  );
  assert([...panel.querySelectorAll('.stk-print-entry a')].some(link => link.textContent === '#42 · JP'),
    'non-English printing shows its language');

  // Toggle a printing inside the expanded panel.
  const thirdPrintAdd = await waitFor(
    () => [...panel.querySelectorAll('.stk-print-add')].find(button =>
      button.closest('.stk-print-entry').querySelector('a').textContent === '#3'),
    'add button for printing #3'
  );
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '✓', 'expanded print button selected');
  assertEqual(mock.state.cards.length, 4, 'printing added from expanded panel');
  assertEqual(mock.state.cards[3], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', number: '3', forceSet: true
  }, 'expanded print saved with forceSet');
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '+', 'expanded print button deselected');
  assertEqual(mock.state.cards.length, 3, 'printing removed again');

  click(nativeLink);
  assert(panel.hidden, 'second click hides the panel again');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded resets to false');

  // Clear the clipboard.
  click(aside.querySelector('.stk-icon-trash'));
  await waitFor(() => mock.state.cards.length === 0, 'clipboard cleared');
  assert(aside.querySelector('.stk-count').hidden, 'badge hidden for an empty clipboard');
}

async function searchPageTest() {
  console.log('content.js: search page');
  const html = `<!DOCTYPE html><html><body><div id="main" class="card-grid">
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/grid/9/grid-card"></a>
      <span class="card-grid-item-invisible-label">Grid Card</span><img alt="Grid Card (GRID) 9"></div>
    <div class="card-grid-item" aria-hidden="true"><a class="card-grid-item-card" href="https://scryfall.com/card/hidden/1/hidden"></a>
      <span class="card-grid-item-invisible-label">Hidden Card</span><img alt="Hidden Card"></div>
  </div></body></html>`;
  const page = createPage({ url: 'https://scryfall.com/search?q=grid', html, state: { cards: [] }, routes });
  await page.script('i18n.js');
  await page.script('format-catalog.js');
  await page.script('tag-icons.js');
  await page.script('data/shambleshark-nicknames.js');
  await page.script('content.js');
  await sleep(60);
  const { document, mock } = page;

  assert(!document.getElementById('stk-tags'), 'search page does not build a tag panel');
  const addButtons = [...document.querySelectorAll('.card-grid-item:not([aria-hidden="true"]) .stk-add')];
  assertEqual(addButtons.length, 1, 'only visible grid items get add buttons');
  assertEqual(addButtons[0].getAttribute('aria-label'), 'Add Grid Card', 'button label names the card');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 1, 'grid card added');
  assertEqual(mock.state.cards[0], {
    name: 'Grid Card', url: 'https://scryfall.com/card/grid/9/grid-card', set: 'grid', number: '9'
  }, 'grid card saved with set and number');

  const copyAll = document.querySelector('#scryfall-toolkit-clipboard .stk-toolbar .stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'grid copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0], '1 Grid Card', 'default names format copies names only');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 0, 'grid card toggled off');
}

async function clipboardDisabledTest() {
  console.log('content.js: clipboard disabled');
  const page = await loadCardPage({ clipboard: false, cards: [] });
  const { document } = page;
  assert(!document.getElementById('scryfall-toolkit-clipboard'), 'no clipboard when disabled');
  assert(!document.querySelector('.stk-native-print-add'), 'no native print buttons when clipboard disabled');
  assertEqual(page.context.STK_ADD_PRINT, undefined, 'no STK_ADD_PRINT handler when clipboard disabled');
}

async function legacyMigrationTest() {
  console.log('content.js: legacy cardClipboard migration');
  const page = createPage({
    url: 'https://scryfall.com/search?q=x',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {},
    localStorage: { cardClipboard: JSON.stringify([{ cardName: 'Old Card', cardLink: 'https://scryfall.com/card/lea/1/old' }]) },
    routes
  });
  await page.script('i18n.js');
  await page.script('format-catalog.js');
  await page.script('tag-icons.js');
  await page.script('data/shambleshark-nicknames.js');
  await page.script('content.js');
  await sleep(60);
  assertEqual(page.mock.state.cards, [
    { name: 'Old Card', url: 'https://scryfall.com/card/lea/1/old', set: '', number: '' }
  ], 'legacy localStorage entries migrated into storage.cards');
}

(async () => {
  try {
    await cardPageTest();
    await searchPageTest();
    await clipboardDisabledTest();
    await legacyMigrationTest();
    summary('test-preview');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
