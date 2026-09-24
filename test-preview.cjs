'use strict';
// content.js end-to-end: card page and search page over linkedom.
const {
  assert, assertEqual, summary, sleep, waitFor, createPage, click, fireEvent
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
      <thead><tr><th>Name</th><th>Set</th><th><span>USD</span></th><th><span>EUR</span></th><th><span>TIX</span></th></tr></thead>
      <tbody>
        <tr class="current"><td><a data-card-id="${PRINT_CURRENT}" href="https://scryfall.com/card/tst/1/test-card">Test Card (TST) 1</a></td><td>TST</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_TST2}" href="https://scryfall.com/card/tst/2/test-card">Test Card (TST) 2</a></td><td>TST</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_MH3}" href="https://scryfall.com/card/mh3/42/test-card">Test Card (MH3) 42</a></td><td>MH3</td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <div class="prints-all"><a href="https://scryfall.com/card/tst/1/printings">View all prints</a></div>
  </div>
  <div id="stores"><ul class="toolbox-links"></ul></div>
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
  { id: 'p2', name: 'Test Card', uri: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', setName: 'Test Set', number: '3', lang: 'en', digital: false, finishes: ['nonfoil'], prices: { eur: '2.00', usd: '3.50', tix: '0.05' } },
  { id: 'p4', name: 'Test Card', uri: 'https://scryfall.com/card/tst/4/test-card', set: 'tst', setName: 'Test Set', number: '4', lang: 'en', digital: false, finishes: ['foil'], prices: { usd_foil: '9.99' } },
  { id: 'p3', name: 'Test Card', uri: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', setName: 'Modern Horizons 3', number: '42', lang: 'jp', digital: false, finishes: ['foil'], prices: {} },
  { id: 'p5', name: 'Test Card', uri: 'https://scryfall.com/card/mh3/43/test-card', set: 'mh3', setName: 'Modern Horizons 3', number: '43', lang: 'jp', digital: false, finishes: ['foil'], prices: {} }
];

const routes = {
  tags: () => ({
    card: [
      { name: 'Aggro', slug: 'aggro', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Other Card', targetId: REL_ID, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' },
      { name: 'Worse Card', targetId: '66666666-6666-4666-8666-666666666666', tagType: 'WORSE_THAN', relation: true, targetKind: 'card' }
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
  cardtrader: () => ({ available: true, url: 'https://www.cardtrader.com/en/cards/test', nonfoil: { cents: 1234, currency: 'EUR' } }),
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
  const page = await loadCardPage({ cards: [], euroPriceSources: 'both' });
  const { document, mock, location } = page;

  // Clipboard shell.
  const aside = document.getElementById('scryfall-toolkit-clipboard');
  assert(aside, 'clipboard aside is injected');
  assertEqual(aside.querySelector('.stk-toolbar').children.length, 3, 'toolbar has wrapped copy, clear and open buttons');
  const list = aside.querySelector('.stk-list');
  assert(list.hidden, 'clipboard list starts hidden');
  click(aside.querySelector('.stk-icon-clip'));
  assert(!list.hidden, 'clip button reveals the list');

  // Card page scan button.
  const scanButton = document.querySelector('.card-image .stk-add');
  assert(scanButton, 'grid-less card page gets an add button on the card image');
  assertEqual(scanButton.textContent, '+', 'fresh card is not selected yet');

  // Native print buttons live inside the native prints table, current row included.
  const nativeButtons = [...document.querySelectorAll('#main .prints-table .stk-native-print-add')];
  assertEqual(nativeButtons.length, 3, 'every print row gets a native add button');
  assert(document.querySelector('tr.current .stk-native-print-add'),
    'current printing row gets an add button too');

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
  assert(!tagIcon.classList.contains('icon-flipped'), 'better-than icon keeps its original direction');
  const worseLink = tagsPanel.querySelector('.stk-related-table a[title*="worse than"]');
  assert(worseLink, 'worse relation row rendered');
  assertEqual(worseLink.title, 'worse than: Worse Card', 'WORSE_THAN relation tooltip reads worse than');
  const worseIcon = worseLink.closest('tr')?.querySelector('.stk-tag-icon');
  assert(worseIcon && worseIcon.classList.contains('icon-flipped'), 'worse-than icon is inverted');

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
  // after the async add resolves, so wait on the label itself. The first row is
  // the current printing and mirrors the scan button, so it is skipped here.
  click(nativeButtons[1]);
  await waitFor(() => nativeButtons[1].textContent === '✓', 'first native print button selected');
  assertEqual(mock.state.cards.length, 2, 'first native print added');
  assertEqual(mock.state.cards[1], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/2/test-card', set: 'tst', number: '2', forceSet: true
  }, 'native print saved with forceSet');
  click(nativeButtons[2]);
  await waitFor(() => nativeButtons[2].textContent === '✓', 'second native print button selected');
  assertEqual(mock.state.cards.length, 3, 'second native print added');
  assertEqual(mock.state.cards[2], {
    name: 'Test Card', url: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', number: '42', forceSet: true
  }, 'second native print saved with forceSet');

  // Rows display the set code and collector number.
  const setSpans = [...list.querySelectorAll('.stk-list-set')].map(span => span.textContent);
  assertEqual(setSpans, ['(TST) 1', '(TST) 2', '(MH3) 42'], 'buffer rows show set code and number');

  // Copy all: sets by default; the names-only choice lives in the hover menu.
  const copyWrap = aside.querySelector('.stk-copy-wrap');
  assert(copyWrap, 'copy button wrapped in a hover menu');
  const copyMenu = copyWrap.querySelector('.stk-copy-menu');
  assert(copyMenu.hidden, 'names-only menu starts hidden');
  const copyAll = copyWrap.querySelector('.stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'default copy includes set codes');

  fireEvent(copyWrap, 'mouseenter');
  assert(!copyMenu.hidden, 'hovering copy opens the menu above');
  const plain = copyMenu.querySelector('.stk-copy-plain');
  assertEqual(plain.textContent, 'Names only, no sets', 'menu item translated for English site');
  click(plain);
  await waitFor(() => mock.clipboardWrites.length === 2, 'names-only copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[1],
    '1 Test Card\n1 Test Card\n1 Test Card',
    'names-only item drops sets everywhere, including forced ones');
  assert(copyMenu.hidden, 'menu closes after choosing');
  fireEvent(copyWrap, 'mouseleave');
  assert(copyMenu.hidden, 'menu stays closed after leaving');

  // The options setting still picks the default for the plain click.
  mock.state.exportFormat = 'names';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 3, 'setting-driven copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[2],
    '1 Test Card\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'exportFormat setting still honored for the main click');

  // Printings expand directly inside the native prints table.
  const nativeLink = document.querySelector('#main .prints-all a');
  const printTable = document.querySelector('#main .prints > .prints-table');
  const printBody = printTable.tBodies && printTable.tBodies[0] ? printTable.tBodies[0] : printTable.querySelector('tbody');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded starts false');
  assertEqual(printBody.querySelectorAll('.stk-print-extra').length, 0, 'no extra rows before expanding');
  click(nativeLink);
  assert(printTable.classList.contains('stk-prints-expanded'), 'table carries the expanded state');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'true', 'aria-expanded flips to true');
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 2, 'prints grouped by set inside the table');
  const groupTitles = [...printBody.querySelectorAll('.stk-print-group-row td')].map(td => td.textContent);
  assertEqual(groupTitles, ['Test Set (TST) · 2', 'Modern Horizons 3 (MH3) · 1'],
    'group rows carry set name, code and count');
  assert([...printBody.querySelectorAll('.stk-print-group-row td')].every(td => td.querySelector('span')),
    'group headers wrap their label in the native span-in-cell markup');
  assertEqual(printBody.querySelectorAll('.stk-print-entry').length, 3, 'missing printings inserted into the table');
  const entryLinks = [...printBody.querySelectorAll('.stk-print-entry a')].map(link => link.textContent);
  assert(entryLinks.includes('#43 · JP'), 'non-English printing shows its language');
  assertEqual(printBody.querySelectorAll('.stk-native-print-add').length, 6,
    'every printing row, native and extra, has an add button');
  const newPageLink = document.querySelector('#main .prints-all .stk-print-new-page');
  assert(newPageLink && newPageLink.closest('.stk-print-new-page-line'),
    'new-page link sits in a line wrapper with the native link');
  assert(newPageLink && newPageLink.previousElementSibling === nativeLink,
    'new-page link is the second half of the native printings line');
  assertEqual(newPageLink.getAttribute('href'), nativeLink.getAttribute('href'),
    'new-page link keeps the native printings URL');

  // Expanded rows carry the same price fills as the native ones.
  const entryOf = suffix => [...printBody.querySelectorAll('.stk-print-entry')]
    .find(row => row.querySelector('a').getAttribute('href').includes(suffix));
  const fullPriceRow = entryOf('/tst/3/');
  assertEqual(fullPriceRow.querySelector('.currency-usd')?.textContent, '$3.50', 'expanded row fills the USD price');
  assertEqual(fullPriceRow.querySelector('.currency-eur')?.textContent, '€2.00', 'expanded row fills the EUR price');
  assertEqual(fullPriceRow.querySelector('.currency-tix')?.textContent, '0.05', 'expanded row fills the TIX price');
  const foilRow = entryOf('/tst/4/');
  assertEqual(foilRow.querySelector('.currency-usd')?.textContent, '✶ $9.99', 'foil-only price falls back to the foil value');
  assert(!foilRow.querySelector('.currency-eur'), 'missing prices leave the cell empty');
  const emptyRow = entryOf('/mh3/43/');
  assert(!emptyRow.querySelector('.currency-usd') && !emptyRow.querySelector('.currency-eur'),
    'row without any price has no price cells');
  const nativeCtLink = await waitFor(
    () => printBody.querySelector('tr:not(.stk-print-extra) .stk-ct-price-cell a'),
    'CardTrader price for a native row'
  );
  assertEqual(nativeCtLink.textContent, '€12.34', 'native row priced by CardTrader');
  const expandedCtLink = await waitFor(
    () => fullPriceRow.querySelector('.stk-ct-price-cell a'),
    'CardTrader price for an expanded row'
  );
  assertEqual(expandedCtLink.textContent, '€12.34', 'expanded row joins the shared CardTrader queue');

  // Sets with several missing printings start collapsed and toggle on header click.
  const tstGroup = [...printBody.querySelectorAll('.stk-print-group-row')]
    .find(row => row.textContent.includes('(TST)'));
  const tstEntries = [...printBody.querySelectorAll('.stk-print-entry')]
    .filter(row => /\/card\/tst\//.test(row.querySelector('a').getAttribute('href')));
  assertEqual(tstEntries.length, 2, 'two missing TST printings under one header');
  assert(tstEntries.every(row => row.hidden), 'multi-printing set starts collapsed');
  click(tstGroup);
  assert(tstEntries.every(row => !row.hidden), 'clicking the group header reveals its printings');
  click(tstGroup);
  assert(tstEntries.every(row => row.hidden), 'clicking again collapses the group');
  click(tstGroup);

  // Toggle a printing inside the expanded table.
  const thirdPrintAdd = await waitFor(
    () => [...printBody.querySelectorAll('.stk-print-entry .stk-native-print-add')].find(button =>
      button.closest('.stk-print-entry').querySelector('a').textContent === '#3'),
    'add button for printing #3'
  );
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '✓', 'expanded print button selected');
  assertEqual(mock.state.cards.length, 4, 'printing added from expanded table');
  assertEqual(mock.state.cards[3], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', number: '3', forceSet: true
  }, 'expanded print saved with forceSet');
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '+', 'expanded print button deselected');
  assertEqual(mock.state.cards.length, 3, 'printing removed again');

  click(nativeLink);
  assert(!printTable.classList.contains('stk-prints-expanded'), 'second click collapses the table again');
  assertEqual(printBody.querySelectorAll('.stk-print-extra').length, 0, 'extra rows leave the table when collapsed');
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
  assertEqual(mock.clipboardWrites[0], '1 Grid Card (GRID) 9', 'default format includes set and number');

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
