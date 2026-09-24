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
        <tr class="current"><td><a data-card-id="${PRINT_CURRENT}" href="https://scryfall.com/card/tst/1/test-card">Test Set
          #1</a></td><td>TST</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_TST2}" href="https://scryfall.com/card/tst/2/test-card">Test Set
          #2</a></td><td>TST</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_MH3}" href="https://scryfall.com/card/mh3/42/test-card">Modern Horizons 3
          #42</a></td><td>MH3</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints&amp;include=extras">View all prints →</a></td></tr>
      </tbody>
    </table>
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
  { id: 'p2', name: 'Test Card', uri: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', setName: 'Test Set', number: '3', lang: 'en', digital: false, finishes: ['foil', 'nonfoil'], prices: { eur: '2.00', usd: '3.50', tix: '0.05' } },
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

  // Native print buttons live inside the prints table. The full print list is
  // grouped on load, so Scryfall's rows and the added printings all have one.
  const buttonOf = href => [...document.querySelectorAll('#main .prints-table .stk-native-print-add')]
    .find(button => button.closest('tr').querySelector('a[href]')?.getAttribute('href').includes(href));
  assert(buttonOf('/tst/1/'), 'current printing row gets an add button');
  assert(buttonOf('/tst/2/'), 'second native row gets an add button');
  assert(buttonOf('/mh3/42/'), 'third native row gets an add button');
  assertEqual(document.querySelectorAll('#main .prints-table .stk-native-print-add').length, 6,
    'every printing row, native and added, has an add button');

  // Finish badges from the finishes response.
  assert(document.querySelector('.stk-finish-header'), 'finish column header is added');
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
  const tst2Add = buttonOf('/tst/2/');
  click(tst2Add);
  await waitFor(() => tst2Add.textContent === '✓', 'first native print button selected');
  assertEqual(mock.state.cards.length, 2, 'first native print added');
  assertEqual(mock.state.cards[1], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/2/test-card', set: 'tst', number: '2', forceSet: true
  }, 'native print saved with forceSet');
  const mh3Add = buttonOf('/mh3/42/');
  click(mh3Add);
  await waitFor(() => mh3Add.textContent === '✓', 'second native print button selected');
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

  // The prints table is grouped from the complete print list on load.
  const nativeLink = document.querySelector('#main .prints .prints-table .stk-print-new-page-line > a');
  const viewAllRow = document.querySelector('#main .prints .prints-table tbody tr.view-all');
  const printTable = document.querySelector('#main .prints > .prints-table');
  const printBody = printTable.tBodies && printTable.tBodies[0] ? printTable.tBodies[0] : printTable.querySelector('tbody');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded starts false');
  const heads = () => [...printBody.querySelectorAll('.stk-print-group-row')];
  const allRows = () => [...printBody.querySelectorAll('tr:not(.stk-print-group-row):not(.view-all):not(.stk-print-status)')];
  assertEqual(heads().map(row => row.querySelector('span').textContent), ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2'],
    'the full print list is grouped on load, native and added printings counted together');
  assert(heads()[0].classList.contains('stk-current-group'), 'the set of the card being viewed is highlighted');
  assert(heads().every(row => row.classList.contains('stk-group-collapsed')), 'groups start folded by default');
  assert(allRows().every(row => row.hidden), 'the folded groups hide their rows by default');
  assertEqual([...printBody.querySelectorAll('a[href*="/card/tst/"]')].slice(0, 2).map(a => a.textContent), ['#1', '#2'],
    'grouped native rows keep the bare collector number');
  assertEqual(printBody.querySelectorAll('.stk-print-entry').length, 3, 'the added printings are already on the page');

  const rowOrder = [...printBody.children].map(row => {
    if (row.classList.contains('stk-print-group-row')) return `group:${row.textContent.split('(')[0].trim()}`;
    if (row.classList.contains('view-all')) return 'view-all';
    const link = row.querySelector('td:first-child a[href]');
    return link ? new URL(link.getAttribute('href'), 'https://scryfall.com').pathname : row.className;
  });
  assertEqual(rowOrder, [
    'group:Test Set', '/card/tst/1/test-card', '/card/tst/2/test-card', '/card/tst/3/test-card', '/card/tst/4/test-card',
    'group:Modern Horizons 3', '/card/mh3/42/test-card', '/card/mh3/43/test-card', 'view-all'
  ], 'each set keeps Scryfall rows and added printings under one header, view-all last');

  // "View all prints" unfolds the groups.
  click(nativeLink);
  assert(printTable.classList.contains('stk-prints-expanded'), 'table carries the expanded state');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'true', 'aria-expanded flips to true');
  assertEqual(nativeLink.textContent, 'Show fewer prints ↑', 'expanded link offers to collapse');
  assert(heads().every(row => !row.classList.contains('stk-group-collapsed')), 'opening unfolds every group');
  assert(allRows().every(row => !row.hidden), 'the unfolded groups reveal their rows');
  assert([...printBody.querySelectorAll('.stk-print-group-row td')].every(td => td.querySelector('span')),
    'group headers wrap their label in the native span-in-cell markup');
  const entryLinks = [...printBody.querySelectorAll('.stk-print-entry a')].map(link => link.textContent);
  assert(entryLinks.includes('#43 · JP'), 'non-English printing shows its language');
  const newPageLink = document.querySelector('#main .prints .stk-print-new-page');
  assert(newPageLink && newPageLink.closest('.stk-print-new-page-line'),
    'new-page link sits in a line wrapper with the native link');
  assert(newPageLink && newPageLink.previousElementSibling === nativeLink,
    'new-page link is the second half of the native printings line');
  assertEqual(newPageLink.getAttribute('href'), nativeLink.getAttribute('href'),
    'new-page link keeps the native printings URL');
  assertEqual(newPageLink.textContent, 'Open on a new page', 'new-page link dropped the arrow glyph');
  assert(viewAllRow.lastElementChild.contains(newPageLink), 'the printings line is the last row of the table');

  // Expanded rows carry the same price fills as the native ones.
  const entryOf = suffix => [...printBody.querySelectorAll('.stk-print-entry')]
    .find(row => row.querySelector('a').getAttribute('href').includes(suffix));
  const fullPriceRow = entryOf('/tst/3/');
  assertEqual(fullPriceRow.querySelector('.currency-usd')?.textContent, '$3.50', 'expanded row fills the USD price');
  assertEqual(fullPriceRow.querySelector('.currency-eur')?.textContent, '€2.00', 'expanded row fills the EUR price');
  assertEqual(fullPriceRow.querySelector('.currency-tix')?.textContent, '0.05', 'expanded row fills the TIX price');
  assert(!fullPriceRow.querySelector('.stk-finish-cell'), 'a printing with both finishes gets no finish badge');
  const foilRow = entryOf('/tst/4/');
  assertEqual(foilRow.querySelector('.stk-finish-cell')?.textContent, '✶', 'a foil-only printing gets a single finish glyph');
  assertEqual(foilRow.querySelector('.stk-finish-badge')?.textContent.length, 1, 'never more than one finish glyph in a cell');
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

  // A single group still toggles on its own header.
  const tstGroup = heads().find(row => row.textContent.includes('(TST)'));
  const tstRows = [...printBody.querySelectorAll('tr:not(.stk-print-group-row):not(.stk-print-status)')]
    .filter(row => /\/card\/tst\//.test(row.querySelector('td:first-child a[href]').getAttribute('href')));
  assertEqual(tstRows.length, 4, 'two native and two added TST printings under one header');
  assert(tstRows.every(row => !row.hidden), 'the expanded table shows every TST printing');
  assertEqual(tstRows.filter(row => row.classList.contains('stk-print-entry'))
    .map(row => row.querySelector('td:first-child a').textContent), ['#3', '#4'],
    'rows under a group header keep the bare collector number');
  click(tstGroup);
  assert(tstRows.every(row => row.hidden), 'clicking a header folds just that group');
  click(tstGroup);
  assert(tstRows.every(row => !row.hidden), 'clicking again unfolds it');

  // Toggle a printing inside the expanded table.
  const thirdPrintAdd = await waitFor(
    () => [...printBody.querySelectorAll('.stk-print-entry .stk-native-print-add')].find(button =>
      button.closest('.stk-print-entry').querySelector('a').textContent === '#3'),
    'add button for printing #3'
  );
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '✓', 'expanded print button selected');
  assert(thirdPrintAdd.classList.contains('stk-print-selected'), 'selected print button is marked for the always-visible rule');
  assertEqual(mock.state.cards.length, 4, 'printing added from expanded table');
  assertEqual(mock.state.cards[3], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', number: '3', forceSet: true
  }, 'expanded print saved with forceSet');
  click(thirdPrintAdd);
  await waitFor(() => thirdPrintAdd.textContent === '+', 'expanded print button deselected');
  assert(!thirdPrintAdd.classList.contains('stk-print-selected'), 'deselected print button loses the always-visible mark');
  assertEqual(mock.state.cards.length, 3, 'printing removed again');

  // "Show fewer prints" folds the groups again without dropping the grouping.
  click(nativeLink);
  assert(!printTable.classList.contains('stk-prints-expanded'), 'second click folds the table again');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded resets to false');
  assertEqual(nativeLink.textContent, 'View all prints →', 'collapsed link gets the native label back');
  assertEqual(heads().length, 2, 'the groups stay when the table folds');
  assert(allRows().every(row => row.hidden), 'folding hides the rows again');
  assertEqual(printBody.querySelectorAll('.stk-print-entry').length, 3, 'the added printings remain on the page');

  // A printing that is already in the clipboard shows a permanent check mark:
  // the current printing was added through the scan button earlier.
  const firstNativeAdd = printBody.querySelector('tr.current .stk-native-print-add');
  assertEqual(firstNativeAdd.textContent, '✓', 'a buffered printing shows a check mark right away');
  assert(firstNativeAdd.classList.contains('stk-print-selected'), 'the buffered printing is marked as selected');
  click(firstNativeAdd);
  await waitFor(() => firstNativeAdd.textContent === '+', 'the check mark clears when the printing is removed');
  click(firstNativeAdd);
  await waitFor(() => firstNativeAdd.textContent === '✓', 'the check mark comes back when it is added again');
  click(nativeLink);
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 2, 'table expands again');
  const reExpandedAdd = printBody.querySelector('tr.current .stk-native-print-add');
  assertEqual(reExpandedAdd, firstNativeAdd, 'the cached rows keep the same buttons');
  assertEqual(reExpandedAdd.textContent, '✓', 're-expanded table still shows the check mark');
  click(nativeLink);
  assert(!printTable.classList.contains('stk-prints-expanded'), 'table is collapsed again');

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

async function printsGroupsEdgeTest() {
  console.log('content.js: print group edge cases');
  const mkPrint = (set, number) => ({
    id: `e-${set}-${number}`, name: 'Edge Card', uri: `https://scryfall.com/card/${set}/${number}/edge-card`,
    set, setName: `Set ${set.toUpperCase()}`, number, lang: 'en', digital: false, finishes: ['nonfoil'], prices: {}
  });
  // Scryfall keeps the collector number on its own line inside the link.
  const native = `
        <tr><td><a data-card-id="a1" href="/card/aaa/1/edge-card">Set AAA
          #1</a></td><td>AAA</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="a2" href="/card/aaa/2/edge-card">Set AAA
          #2</a></td><td>AAA</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="b1" href="/card/bbb/1/edge-card">Set BBB
          #1</a></td><td>BBB</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr>`;
  const html = CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${native}</tbody>`);
  const many = [];
  for (let index = 1; index <= 12; index++) many.push(mkPrint(`c${String(index).padStart(2, '0')}`, '1'));
  const promo = { ...mkPrint('aaap', '7'), setName: 'Set AAA Promos' };
  const edgeRoutes = {
    ...routes,
    finishes: () => ({}),
    allPrints: () => ({
      prints: [mkPrint('aaa', '1'), mkPrint('aaa', '2'), mkPrint('bbb', '1'), mkPrint('bbb', '2'), promo, ...many],
      truncated: false
    })
  };
  const page = createPage({ url: 'https://scryfall.com/card/aaa/1/edge-card', html, state: { cards: [] }, routes: edgeRoutes });
  await page.script('i18n.js');
  await page.script('format-catalog.js');
  await page.script('tag-icons.js');
  await page.script('data/shambleshark-nicknames.js');
  await page.script('content.js');
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  // The complete list is grouped on load, no click required.
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 2, 'two set groups are built on load');

  const heads = [...printBody.querySelectorAll('.stk-print-group-row span')].map(node => node.textContent);
  assertEqual(heads, ['Set AAA (AAA) · 3', 'Set BBB (BBB) · 2'],
    'a native-only group takes its set name from the row, and the promo set joins its parent');
  const promoRow = printBody.querySelector('.stk-print-entry a[href*="/card/aaap/"]');
  assertEqual(promoRow.textContent, '#7 (AAAP)', 'a promo row inside the parent group shows its own set code');
  let enclosingHead = promoRow.closest('tr').previousElementSibling;
  while (enclosingHead && !enclosingHead.classList.contains('stk-print-group-row')) {
    enclosingHead = enclosingHead.previousElementSibling;
  }
  assert(enclosingHead && enclosingHead.textContent.includes('(AAA)'),
    'the promo row belongs to the parent set group, not to a set of its own');
  assert(promoRow.closest('tr').hidden, 'the promo row is folded away with its group');
  // A closed group counts as one entry, so fourteen entries collapse to ten.
  const entries = [...printBody.querySelectorAll('.stk-print-entry')];
  assertEqual(entries.length, 10, 'ten added printings made it into the ten-entry cap');
  assertEqual(entries.map(row => row.querySelector('td:first-child a').textContent),
    ['#7 (AAAP)', '#2', 'Set C01 #1', 'Set C02 #1', 'Set C03 #1', 'Set C04 #1', 'Set C05 #1', 'Set C06 #1', 'Set C07 #1', 'Set C08 #1'],
    'rows inside a group keep the bare number, rows outside repeat the set name');
  assert(!printBody.querySelector('a[href*="/card/c09/"]'), 'the printings behind the cap stay off the page');
  const aaaRows = [...printBody.querySelectorAll('a[href*="/card/aaa/"]')].map(link => link.closest('tr'));
  assertEqual(aaaRows.length, 2, 'both native AAA rows belong to the group');
  assert(aaaRows.every(row => row.hidden), 'a closed group hides its native rows');
  const aaaHead = printBody.querySelector('.stk-print-group-row');
  click(aaaHead);
  assert(aaaRows.every(row => !row.hidden), 'opening a group only reveals its own rows');
  assert(!printBody.querySelector('a[href*="/card/c09/"]'), 'opening a group does not bring the capped printings back');
  assertEqual(printBody.querySelectorAll('.stk-print-entry').length, 10, 'opening a group adds no other rows');
  assert(promoRow.closest('tr').hidden === false, 'the promo row opens together with its parent group');
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
    await printsGroupsEdgeTest();
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
