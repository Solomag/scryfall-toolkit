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
// The card page end to end: the core and the nine feature files over linkedom.
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
          #1</a></td><td>TST</td><td><a class="currency-usd" href="https://partner.tcgplayer.com/x">✶$7.82</a></td><td></td><td></td></tr>
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
  preview: () => ({ name: 'Other Card', image: 'https://cards.scryfall.io/normal/o.jpg', uri: 'https://scryfall.com/card/oth/1/other-card' }),
  setCategories: () => ({ digital: ['ysos', 'me2'], nonTournament: [], oversized: [], foreignBlackBorder: [] }),
  setPlatforms: () => ({ ysos: ['arena'], me2: ['mtgo'] })
};

async function loadCardPage(state, pageRoutes = routes) {
  const page = createPage({ url: 'https://scryfall.com/card/tst/1/test-card', html: CARD_HTML, state, routes: pageRoutes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  return page;
}

async function cardPageTest() {
  console.log('content scripts: card page');
  // The Prints group is off by default now, so this test turns it on to check
  // what it does when a user enables it.
  const page = await loadCardPage({
    cards: [], euroPriceSources: 'both',
    printGrouping: true, printFoldGroups: true, printFullPageLink: true
  });
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

  // Native print buttons live inside the prints table. Grouping is off by
  // default now, so this test turns it on and checks that Scryfall's rows and
  // the added printings all get one.
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
  assertEqual(document.querySelector('.currency-usd').textContent, '$7.82',
    'Scryfall’s star in a price is dropped, the finish column carries it');

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
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'true', 'a table that fits into ten rows starts unfolded');
  const heads = () => [...printBody.querySelectorAll('.stk-print-group-row')];
  const allRows = () => [...printBody.querySelectorAll('tr:not(.stk-print-group-row):not(.view-all):not(.stk-print-status)')];
  assertEqual(heads().map(row => row.querySelector('span').textContent), ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2'],
    'the full print list is grouped on load, native and added printings counted together');
  assert(heads()[0].classList.contains('stk-current-group'), 'the set of the card being viewed is highlighted');
  assert(heads().every(row => !row.classList.contains('stk-group-collapsed')),
    'groups start open when the whole table fits into ten rows');
  assert(allRows().every(row => !row.hidden), 'so every printing is on the page right away');
  assertEqual([...printBody.querySelectorAll('a[href*="/card/tst/"]')].slice(0, 2).map(a => a.textContent), ['#1', '#2'],
    'grouped native rows keep the bare collector number');
  assertEqual(printBody.querySelectorAll('.stk-print-entry').length, 3, 'the added printings are already on the page');
  assert(heads().every(row => !row.classList.contains('stk-group-folded-end')),
    'an open group leaves the header without a closing stripe');
  assert([...printBody.querySelectorAll('tr.stk-group-end')]
    .some(row => /\/card\/tst\/4\//.test(row.querySelector('td:first-child a[href]').getAttribute('href'))),
    'the open group closes the stripe under its last row');

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

  // Nothing is left behind the cap and every group is open, so the line folds the
  // groups instead of unfolding them.
  const pageLine = document.querySelector('.stk-print-new-page-line');
  assertEqual(nativeLink.textContent, 'Collapse all groups', 'with every group open the line offers to fold them');
  assertEqual(nativeLink.hidden, false, 'the fold action stays visible');
  assertEqual(document.querySelector('#main .prints .stk-print-new-page').textContent, 'Open on a new page',
    'the full-page link keeps its wording while the line has two halves');
  assert(!pageLine.classList.contains('stk-print-line-end'), 'the full-page link stays on the right side');

  click(nativeLink);
  assert(heads().every(row => row.classList.contains('stk-group-collapsed')), 'pressing the line folds every group');
  assert(allRows().every(row => row.hidden), 'and the folded groups hide their rows');
  assert(heads().every(row => row.classList.contains('stk-group-folded-end')), 'a folded group closes the stripe at its header');
  assertEqual(nativeLink.textContent, 'Expand all groups', 'the line then offers to unfold them again');
  assertEqual(nativeLink.getAttribute('aria-expanded'), 'false', 'aria-expanded reflects the folded state');
  click(nativeLink);
  assert(allRows().every(row => !row.hidden), 'pressing it again unfolds every group');
  assertEqual(nativeLink.textContent, 'Collapse all groups', 'and the line offers to fold them once more');
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
  assertEqual(foilRow.querySelector('.currency-usd')?.textContent, '$9.99',
    'foil-only price falls back to the foil value without a second star');
  assert(!foilRow.querySelector('.currency-eur'), 'missing prices leave the cell empty');
  const emptyRow = entryOf('/mh3/43/');
  assert(!emptyRow.querySelector('.currency-usd') && !emptyRow.querySelector('.currency-eur'),
    'row without any price has no price cells');
  // The EUR column heads. Cardmarket's mark is a mask filled with the ink of
  // the heading, not an image chosen by looking for a class on <html>: that is
  // what keeps it the same colour as CardTrader's heading on either theme, and
  // there is no variant that can be picked wrongly.
  const cmMark = printBody.parentNode.querySelector('.stk-price-heading .stk-brand-mark');
  assert(cmMark, 'the Cardmarket column is headed by their mark');
  assertEqual(cmMark.getAttribute('aria-label'), 'Cardmarket', 'and it says whose mark it is');
  const mask = cmMark.style.getPropertyValue('mask-image') || cmMark.style.webkitMaskImage;
  assert(/cardmarket-white\.png/.test(mask), 'drawn from the file they publish for dark backgrounds');
  assert(!cmMark.querySelector('img') && cmMark.tagName === 'SPAN',
    'and it is not an <img>, so there is no black file to show by mistake');
  const cmHeading = cmMark.parentNode;
  assertEqual(cmHeading.textContent, 'EUR', 'beside the currency it is the price of');
  const ctHeading = [...cmHeading.closest('table').querySelectorAll('.stk-price-heading')]
    .find(h => h !== cmHeading);
  assert(ctHeading && ctHeading.textContent === 'EUR', 'and CardTrader\'s column is headed the same way');
  assert(ctHeading.querySelector('img[src*="cardtrader"]'),
    'with their own mark, so the two columns are headed the same way rather than one being an exception');

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
  assertEqual(nativeLink.textContent, 'Expand all groups', 'the line offers to unfold the groups again');

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

  // The line unfolds everything again, groups included, without dropping them.
  click(nativeLink);
  assert(tstRows.every(row => !row.hidden), 'the line unfolds the folded group again');
  assertEqual(heads().length, 2, 'the groups stay on the page');
  assertEqual(nativeLink.textContent, 'Collapse all groups', 'with every group open the line offers to fold them');
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
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 2, 'the groups are still there');
  const reExpandedAdd = printBody.querySelector('tr.current .stk-native-print-add');
  assertEqual(reExpandedAdd, firstNativeAdd, 'the regrouped rows keep the same buttons');
  assertEqual(reExpandedAdd.textContent, '✓', 'the check mark survives regrouping');

  // Clear the clipboard.
  click(aside.querySelector('.stk-icon-trash'));
  await waitFor(() => mock.state.cards.length === 0, 'clipboard cleared');
  assert(aside.querySelector('.stk-count').hidden, 'badge hidden for an empty clipboard');
}

async function searchPageTest() {
  console.log('content scripts: search page');
  const html = `<!DOCTYPE html><html><body><div id="main" class="card-grid">
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/grid/9/grid-card"></a>
      <span class="card-grid-item-invisible-label">Grid Card</span><img alt="Grid Card (GRID) 9"></div>
    <div class="card-grid-item" aria-hidden="true"><a class="card-grid-item-card" href="https://scryfall.com/card/hidden/1/hidden"></a>
      <span class="card-grid-item-invisible-label">Hidden Card</span><img alt="Hidden Card"></div>
  </div></body></html>`;
  const page = createPage({ url: 'https://scryfall.com/search?q=grid', html, state: { cards: [] }, routes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
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
  console.log('content scripts: clipboard disabled');
  const page = await loadCardPage({ clipboard: false, cards: [] });
  const { document } = page;
  assert(!document.getElementById('scryfall-toolkit-clipboard'), 'no clipboard when disabled');
  assert(!document.querySelector('.stk-native-print-add'), 'no native print buttons when clipboard disabled');
  assertEqual(page.context.STK_ADD_PRINT, undefined, 'no STK_ADD_PRINT handler when clipboard disabled');
}

async function printsGroupsEdgeTest() {
  console.log('content scripts: print group edge cases');
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
        <tr><td><a data-card-id="b1" href="/card/bbb/1/edge-card">Set BBB ★
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
  const page = createPage({ url: 'https://scryfall.com/card/aaa/1/edge-card', html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, routes: edgeRoutes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  // The complete list is grouped on load, no click required.
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 2, 'two set groups are built on load');

  const heads = [...printBody.querySelectorAll('.stk-print-group-row span')].map(node => node.textContent);
  assertEqual(heads, ['Set AAA (AAA) · 3', 'Set BBB (BBB) · 2'],
    'a native-only group takes its set name from the row without the star or the number, and the promo set joins its parent');
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

  // Beyond ten entries the line offers the rest, and the groups stay as they are.
  const nativeLink = document.querySelector('.stk-print-new-page-line > a');
  assertEqual(nativeLink.textContent, 'View all prints →', 'the line offers the printings behind the cap');
  click(nativeLink);
  assertEqual(nativeLink.textContent, 'Show fewer prints ↑', 'after revealing them it offers to fold back');
  assert([...printBody.querySelectorAll('.stk-print-entry')].length > 10, 'the capped printings join the table');
  assert(aaaRows.every(row => !row.hidden), 'revealing the rest leaves the opened group open');
  assert([...printBody.querySelectorAll('.stk-print-group-row')][1].classList.contains('stk-group-collapsed'),
    'and the folded ones stay folded');
  click(nativeLink);
  assertEqual(nativeLink.textContent, 'View all prints →', 'folding back restores the offer');
  assertEqual([...printBody.querySelectorAll('.stk-print-entry')].length, 10, 'the ten-entry cap returns');
}

async function printsSameTabTest() {
  console.log('content scripts: printings link in the same tab');
  const page = await loadCardPage({ cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true, printPageSameTab: true });
  const { document } = page;
  const link = document.querySelector('#main .prints .stk-print-new-page');
  assertEqual(link.textContent, 'Open on this page', 'the full-page link says on this page when the setting is on');
  assertEqual(link.getAttribute('target'), null, 'the same-tab link opens no new tab');
  assertEqual(link.getAttribute('rel'), null, 'and needs no noopener');
}

async function promoParentMergeTest() {
  console.log('content scripts: promo set merges into a parent with one native printing');
  // Scryfall lists a single printing of the parent set; the promo set is only
  // known after loading. The parent still has to adopt the promo group.
  const native = `
        <tr class="current"><td><a data-card-id="s1" href="/card/abc/7/edge-card">Set ABC
          #7</a></td><td>ABC</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr>`;
  const html = CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${native}</tbody>`);
  const promoRoutes = {
    ...routes,
    finishes: () => ({}),
    allPrints: () => ({
      prints: [
        { id: 'abc7', name: 'Edge Card', uri: 'https://scryfall.com/card/abc/7/edge-card', set: 'abc', setName: 'Set ABC', number: '7', lang: 'en', digital: false, finishes: ['nonfoil'], prices: {} },
        { id: 'abcp1', name: 'Edge Card', uri: 'https://scryfall.com/card/abcp/1/edge-card', set: 'abcp', setName: 'Set ABC Promos', number: '1', lang: 'en', digital: false, finishes: ['foil'], prices: {} },
        { id: 'abcp2', name: 'Edge Card', uri: 'https://scryfall.com/card/abcp/2/edge-card', set: 'abcp', setName: 'Set ABC Promos', number: '2', lang: 'en', digital: false, finishes: ['foil'], prices: {} }
      ],
      truncated: false
    })
  };
  const page = createPage({ url: 'https://scryfall.com/card/abc/7/edge-card', html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, routes: promoRoutes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length === 1, 'one merged group');
  const head = printBody.querySelector('.stk-print-group-row');
  assertEqual(head.querySelector('span').textContent, 'Set ABC (ABC) · 3',
    'the parent set adopts the promo printings into one group of three');
  const labels = [...printBody.querySelectorAll('tr:not(.stk-print-group-row):not(.view-all) td:first-child a[href]')]
    .map(a => a.textContent.replace(/^Set ABC Promos |^Set ABC /, ''));
  assertEqual(labels, ['#7', '#1 (ABCP)', '#2 (ABCP)'],
    'the native parent row and both promo rows share the group, promo rows keep their code');
  assert(head.classList.contains('stk-current-group'), 'the merged group is the one holding the current card');
}

async function printsOrderTest() {
  console.log('content scripts: printings follow the page order');
  const print = (set, setName, number) => ({
    id: `o-${set}-${number}`, name: 'Order Card', uri: `https://scryfall.com/card/${set}/${number}/order-card`,
    set, setName, number, lang: 'en', digital: false, finishes: ['nonfoil'], prices: {}
  });
  const first = print('old', 'Set Old', '1');
  const second = print('old', 'Set Old', '2');
  const third = print('old', 'Set Old', '3');
  const midOld = print('mid', 'Set Mid', '1');
  const midNew = print('mid', 'Set Mid', '2');
  const fresh = print('new', 'Set New', '1');
  // The API always answers newest first, no matter which order the page shows.
  // Only the rows Scryfall renders itself reveal the order the visitor reads.
  const apiOrder = [fresh, midNew, midOld, third, second, first];
  const build = nativeOrder => {
    const rows = nativeOrder.map((card, index) => `<tr${index === 0 ? ' class="current"' : ''}><td><a data-card-id="n${index}" href="/card/${card.set}/${card.number}/order-card">${card.setName}
          #${card.number}</a></td><td>${card.set.toUpperCase()}</td><td></td><td></td><td></td></tr>`).join('');
    return {
      html: CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${rows}
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr></tbody>`),
      routes: { ...routes, finishes: () => ({}), allPrints: () => ({ prints: apiOrder, truncated: false }) }
    };
  };
  const load = async setup => {
    const page = createPage({ url: 'https://scryfall.com/card/old/1/order-card', html: setup.html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, routes: setup.routes });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.script('assets/data/shambleshark-nicknames.js');
    await page.cardPage();
    await sleep(60);
    return page.document.querySelector('#main .prints .prints-table tbody');
  };
  const layout = body => [...body.children].filter(row => !row.classList.contains('view-all')).map(row => {
    if (row.classList.contains('stk-print-group-row')) return 'H:' + row.querySelector('span').textContent;
    const link = row.querySelector('td:first-child a[href]');
    return link ? link.textContent : row.className;
  });

  // The API answers with every printing, newest first, including the ones
  // Scryfall already lists; the added ones are what we have to order. The rows
  // Scryfall itself renders speak for the page, the API never lies about its
  // own order.
  const oldestFirst = await load(build([first, second, third]));
  await waitFor(() => oldestFirst.querySelectorAll('.stk-print-group-row').length === 2, 'oldest page: groups built');
  assertEqual(layout(oldestFirst), [
    'H:Set Old (OLD) · 3', '#1', '#2', '#3', 'H:Set Mid (MID) · 2', '#1', '#2', 'Set New #1'
  ], 'with the oldest printing on top the whole table, native rows included, runs from oldest to newest');

  const newestFirst = await load(build([third, second, first]));
  await waitFor(() => newestFirst.querySelectorAll('.stk-print-group-row').length === 2, 'newest page: groups built');
  assertEqual(layout(newestFirst), [
    'Set New #1', 'H:Set Mid (MID) · 2', '#2', '#1', 'H:Set Old (OLD) · 3', '#3', '#2', '#1'
  ], 'with the newest printing on top the whole table runs from newest to oldest, Scryfall rows keep their own order');
}

async function printsWindowTest() {
  console.log('content scripts: the ten-entry window keeps the printing being viewed on screen');
  const print = (set, number) => ({
    id: `w-${set}-${number}`, name: 'Window Card', uri: `https://scryfall.com/card/${set}/${number}/window-card`,
    set, setName: `Set ${set.toUpperCase()}`, number, lang: 'en', digital: false, finishes: ['nonfoil'], prices: {}
  });
  // The API answers newest first: twelve sets from this year, then an old trio.
  const recent = [];
  for (let index = 12; index >= 1; index--) recent.push(print(`n${String(index).padStart(2, '0')}`, '1'));
  const old = [print('old', '3'), print('old', '2'), print('old', '1')];
  const apiOrder = [...recent, ...old];
  // Scryfall's own table is a window around the printing being viewed; here it
  // holds the current set plus the three old rows, which fall outside ours.
  const native = `
        <tr class="current"><td><a data-card-id="n06" href="/card/n06/1/window-card">Set N06
          #1</a></td><td>N06</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="o1" href="/card/old/1/window-card">Set OLD
          #1</a></td><td>OLD</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="o2" href="/card/old/2/window-card">Set OLD
          #2</a></td><td>OLD</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="o3" href="/card/old/3/window-card">Set OLD
          #3</a></td><td>OLD</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr>`;
  const html = CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${native}</tbody>`);
  const page = createPage({
    url: 'https://scryfall.com/card/n06/1/window-card', html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true },
    routes: { ...routes, finishes: () => ({}), allPrints: () => ({ prints: apiOrder, truncated: false }) }
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  const nativeLink = document.querySelector('.stk-print-new-page-line > a');
  await waitFor(() => printBody.querySelectorAll('.stk-print-entry').length, 'the printings are placed');
  const rows = () => [...printBody.querySelectorAll('tr:not(.stk-print-group-row):not(.view-all):not(.stk-print-status)')];
  const visible = () => rows().filter(row => !row.hidden);
  const codes = () => visible().map(row => (row.querySelector('a[href]')?.getAttribute('href') || '').match(/\/card\/([^/]+)\//)?.[1]);

  assertEqual(rows().length, 13, 'the window takes ten of the thirteen sets; the two it skips never reach the page');
  assertEqual(visible().length, 10, 'ten entries are on the page');
  assert(printBody.querySelector('tr.current') && !printBody.querySelector('tr.current').hidden,
    'the printing being viewed stays on screen');
  assertEqual(codes()[0], 'n02', 'the window opens four entries above the current one instead of at the newest');
  assert(!codes().includes('n12'), 'the newest printing is behind the window');
  assert(rows().filter(row => /\/card\/old\//.test(row.querySelector('a[href]')?.getAttribute('href') || '')).every(row => row.hidden),
    'native rows the window skipped wait off screen');
  assertEqual(nativeLink.textContent, 'View all prints →', 'the line offers the rest');

  click(nativeLink);
  assertEqual(rows().length, 15, 'revealing all puts every printing on the page');
  assertEqual(visible().length, 12, 'the three old rows now wait inside their own closed group, which counts as one entry');
  assert(printBody.querySelector('tr.current') && !printBody.querySelector('tr.current').hidden,
    'and the viewed printing is still there');
  const oldHead = [...printBody.querySelectorAll('.stk-print-group-row')].find(head => head.textContent.includes('(OLD)'));
  assert(oldHead, 'the old set gets a group header of its own');
  const oldRows = () => rows().filter(row => /\/card\/old\//.test(row.querySelector('a[href]')?.getAttribute('href') || ''));
  click(oldHead);
  assert(oldRows().every(row => !row.hidden), 'opening the group brings the native rows the window skipped back');
  assertEqual(nativeLink.textContent, 'Show fewer prints ↑', 'the line then offers to fold back');
}

async function starNumberTest() {
  console.log('content scripts: a foil-only collector number loses its star');
  const print = (set, setName, number, finishes) => ({
    id: `s-${set}-${number}`, name: 'Star Card', uri: `https://scryfall.com/card/${set}/${encodeURIComponent(number)}/star-card`,
    set, setName, number, lang: 'en', digital: false, finishes, prices: {}
  });
  // Scryfall keeps the star inside the collector number, both in its own table
  // and in the API answer.
  const native = `
        <tr class="current"><td><a data-card-id="s1" href="/card/7ed/67%E2%98%85/star-card">Seventh Edition
          #67 ★</a></td><td>7ED</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="s2" href="/card/7ed/12/star-card">Seventh Edition
          #12</a></td><td>7ED</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr>`;
  const html = CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${native}</tbody>`);
  const prints = [
    print('7ed', 'Seventh Edition', '67★', ['foil']),
    print('7ed', 'Seventh Edition', '12', ['nonfoil']),
    print('xyz', 'Set XYZ', '12★', ['foil'])
  ];
  const page = createPage({
    url: 'https://scryfall.com/card/7ed/67%E2%98%85/star-card', html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true },
    routes: { ...routes, finishes: () => ({}), allPrints: () => ({ prints, truncated: false }) }
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  await waitFor(() => printBody.querySelectorAll('.stk-print-group-row').length, 'the groups are built');
  const head = printBody.querySelector('.stk-print-group-row span');
  const starred = printBody.querySelector('tr.current td:first-child a');
  const lone = printBody.querySelector('.stk-print-entry a');

  assertEqual(head.textContent, 'Seventh Edition (7ED) · 2', 'the group header names the set without a star');
  assertEqual(starred.textContent, '#67', 'a foil-only number reads as a plain number in the group');
  assertEqual(lone.textContent, 'Set XYZ #12', 'and a lone foil-only printing drops the star too');
  assertEqual(printBody.textContent.includes('★'), false, 'no star is left anywhere in the table');
}

async function singlePrintingTest() {
  console.log('content scripts: a card with one printing needs no groups');
  // Scryfall marks a foil-only printing with a star behind its number.
  const native = `<tr class="current"><td><a data-card-id="u1" href="/card/uni/1/only">Set Uni
          #1 ★</a></td><td>UNI</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints">View all prints →</a></td></tr>`;
  const html = CARD_HTML.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${native}</tbody>`);
  const onlyRoutes = {
    ...routes,
    finishes: () => ({}),
    allPrints: () => ({
      prints: [{ id: 'u1', name: 'Only', uri: 'https://scryfall.com/card/uni/1/only', set: 'uni', setName: 'Set Uni', number: '1', lang: 'en', digital: false, finishes: ['nonfoil'], prices: {} }],
      truncated: false
    })
  };
  const page = createPage({ url: 'https://scryfall.com/card/uni/1/only', html, state: { cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, routes: onlyRoutes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  const { document } = page;
  const printBody = document.querySelector('#main .prints .prints-table tbody');
  const line = document.querySelector('.stk-print-new-page-line');
  await waitFor(() => printBody.querySelector('.stk-print-new-page')?.textContent, 'the printings line is ready');
  assertEqual(printBody.querySelectorAll('.stk-print-group-row').length, 0, 'a lone printing gets no header');
  assertEqual(line.firstElementChild.hidden, true, 'with no groups to fold the left half disappears');
  assertEqual(line.querySelector('.stk-print-new-page').textContent, 'View all prints on a new page →',
    'the right half becomes the full-page action');
  assert(line.classList.contains('stk-print-line-end'), 'and it sits on the right of the line');
  assertEqual(printBody.querySelector('tr.current td:first-child a').textContent, 'Set Uni #1',
    "the star behind a foil-only number is gone, the finish column says it instead");
}

async function legacyMigrationTest() {
  console.log('content scripts: legacy cardClipboard migration');
  const page = createPage({
    url: 'https://scryfall.com/search?q=x',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {},
    localStorage: { cardClipboard: JSON.stringify([{ cardName: 'Old Card', cardLink: 'https://scryfall.com/card/lea/1/old' }]) },
    routes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  assertEqual(page.mock.state.cards, [
    { name: 'Old Card', url: 'https://scryfall.com/card/lea/1/old', set: '', number: '' }
  ], 'legacy localStorage entries migrated into storage.cards');
}

async function advancedPriceFilterTest() {
  console.log('content scripts: advanced search price filter follows the hidden columns');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="form-row-content-band">
      <select name="price_1" id="price_1">
        <option value="usd">USD</option><option value="eur">Euros</option><option value="tix">MTGO Tickets</option>
      </select>
      <select name="price_1_mode" id="price_1_mode">
        <option value="&lt;">less than</option><option value="&gt;">greater than</option>
      </select>
    </div>
  </div></body></html>`;
  const load = async (state, url) => {
    const page = createPage({ url, html, state, routes });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.script('assets/data/shambleshark-nicknames.js');
    await page.cardPage();
    await sleep(60);
    return page;
  };

  const on = await load({ onlyCardmarket: true, clipboard: false }, 'https://scryfall.com/advanced');
  const { document } = on;
  const options = () => [...document.querySelectorAll('#price_1 option')].map(option => `${option.value}:${option.textContent}`);
  assertEqual(options(), ['eur:Cardmarket (€)'], 'with dollar and ticket columns hidden only the Cardmarket search remains');
  assertEqual(document.querySelectorAll('#price_1_mode option').length, 2, 'the comparison select is left alone');

  const off = await load({ onlyCardmarket: false, clipboard: false }, 'https://scryfall.com/advanced');
  assertEqual([...off.document.querySelectorAll('#price_1 option')].map(option => option.value), ['usd', 'eur', 'tix'],
    'with every column visible the currency choices stay as Scryfall made them');
}

async function setPlatformTest() {
  console.log('content scripts: platform filter decides which sets are shown');
  const load = async (state, url, html, pageRoutes = routes) => {
    const page = createPage({ url, html, state, routes: pageRoutes });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.script('assets/data/shambleshark-nicknames.js');
    await page.cardPage();
    await sleep(80);
    return page;
  };

  const setsHtml = `<!DOCTYPE html><html><body><div id="main">
    <div class="search-controls"><label for="order">3 of 3 sets in</label><select id="order"><option>Name</option></select></div>
    <table id="js-checklist"><tbody>
      <tr><td><a href="https://scryfall.com/sets/mh3">Modern Horizons 3</a></td><td>MH3</td></tr>
      <tr><td><a href="https://scryfall.com/sets/ysos">Alchemy: Secrets of Strixhaven</a></td><td>YSOS</td></tr>
      <tr><td><a href="https://scryfall.com/sets/me2">Magic Online</a></td><td>ME2</td></tr>
    </tbody></table>
  </div></body></html>`;
  const hidden = document => [...document.querySelectorAll('#js-checklist tbody tr')]
    .filter(row => row.classList.contains('stk-digital-set-hidden'))
    .map(row => row.querySelector('a').textContent);

  const paper = await load({ clipboard: false, setPlatforms: ['paper'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(paper.document), ['Alchemy: Secrets of Strixhaven', 'Magic Online'],
    'with only Paper kept the digital sets are hidden from the set list');
  assertEqual(paper.document.querySelector('.search-controls label[for="order"]').textContent, '1 of 3 sets in',
    'the set counter follows the platform filter');

  const arena = await load({ clipboard: false, setPlatforms: ['arena'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(arena.document), ['Modern Horizons 3', 'Magic Online'],
    'with only Arena kept the paper set and the Magic Online set are hidden');

  const all = await load({ clipboard: false, setPlatforms: ['paper', 'arena', 'mtgo'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(all.document), [], 'with every platform kept no set is hidden');

  // The same choice decides which printings join the grouped table.
  const digitalPrint = {
    id: 'p9', name: 'Test Card', uri: 'https://scryfall.com/card/ysos/7/test-card', set: 'ysos',
    setName: 'Alchemy: Secrets of Strixhaven', number: '7', lang: 'en', digital: true,
    finishes: ['nonfoil'], prices: {}
  };
  const printRoutes = { ...routes, allPrints: () => ({ prints: [...prints, digitalPrint], truncated: false }) };
  const groups = page => [...page.document.querySelectorAll('.stk-print-group-row')].map(row => row.textContent);
  const paperPrints = await loadCardPage({ cards: [], setPlatforms: ['paper'], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, printRoutes);
  assertEqual(groups(paperPrints), ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2'],
    'an Arena printing gets no group while only Paper is kept');
  const arenaPrints = await loadCardPage({ cards: [], setPlatforms: ['arena'], printGrouping: true, printFoldGroups: true, printFullPageLink: true }, printRoutes);
  assertEqual(groups(arenaPrints), ['Test Set (TST) · 2'],
    'with only Arena kept the paper set keeps nothing but the rows Scryfall itself showed');
  assert([...arenaPrints.document.querySelectorAll('.prints-table tbody tr')]
    .some(row => /Alchemy: Secrets of Strixhaven/.test(row.textContent)),
    'the Arena printing is the one added printing the table still holds');
  const hiddenPrints = await waitFor(() => {
    const rows = [...arenaPrints.document.querySelectorAll('.prints-table tbody tr')]
      .filter(row => row.classList.contains('stk-digital-set-hidden'));
    return rows.length
      ? rows.map(row => row.querySelector('td:first-child a[href]')?.getAttribute('href') || '') : null;
  }, 'native paper printings hidden');
  assert(hiddenPrints.every(href => /\/card\/(?:tst|mh3)\//.test(href)),
    'the native paper printings are hidden on the card page');
  assert(!arenaPrints.document.querySelector('.prints-table tbody tr.current').classList.contains('stk-digital-set-hidden'),
    'the printing being viewed stays visible even when its platform is not kept');
}

async function advancedSetFilterTest() {
  console.log('content scripts: advanced search set field follows Games and the platform filter');
  const html = `<!DOCTYPE html><html><body><div id="main"><form class="form-layout">
    <div class="form-row"><div class="form-row-content-band">
      <label><input type="checkbox" name="games[]" value="paper" checked> Paper</label>
      <label><input type="checkbox" name="games[]" value="arena"> Arena</label>
      <label><input type="checkbox" name="games[]" value="mtgo"> Magic Online</label>
    </div></div>
    <div class="form-row">
      <div class="inner-flex">
        <select name="set[]" id="set" multiple>
          <option value="mh3">Modern Horizons 3 (MH3)</option>
          <option value="ysos" selected>Alchemy: Secrets of Strixhaven (YSOS)</option>
          <option value="me2">Magic Online (ME2)</option>
        </select>
      </div>
      <span class="select2 select2-container select2-container--default">
        <span class="select2-results"><ul class="select2-results__options" id="select2-set-results">
        <li class="select2-results__option" role="group"><strong class="select2-results__group">Expansions</strong>
          <ul class="select2-results__options select2-results__options--nested">
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-mh3-svg"></use></svg><span>Modern Horizons 3 (MH3)</span></li>
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-ysos-svg"></use></svg><span>Alchemy: Secrets of Strixhaven (YSOS)</span></li>
          </ul>
        </li>
        <li class="select2-results__option" role="group"><strong class="select2-results__group">Online</strong>
          <ul class="select2-results__options select2-results__options--nested">
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-me2-svg"></use></svg><span>Magic Online (ME2)</span></li>
          </ul>
        </li>
      </ul></span>
    </span>
    </div>
  </form></div></body></html>`;
  const load = async (state, pageHtml = html, pageOptions = {}) => {
    const page = createPage({ url: 'https://scryfall.com/advanced', html: pageHtml, state, routes, ...pageOptions });
    // linkedom keeps the checked attribute out of the property Scryfall's own
    // markup would set, so the fixture states it before the script reads it.
    for (const box of page.document.querySelectorAll('#main input[name="games[]"]')) {
      box.checked = box.hasAttribute('checked');
    }
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.script('assets/data/shambleshark-nicknames.js');
    await page.cardPage();
    await sleep(80);
    return page;
  };
  // Sets are hidden rather than removed, so a wider platform choice can bring
  // them back; only the ones on screen count.
  const selectValues = page => [...page.document.querySelectorAll('select[name="set[]"] option')]
    .filter(option => !option.hidden).map(option => option.value);
  const listValues = page => [...page.document.querySelectorAll('.select2-results__option[role="treeitem"]')]
    .filter(item => !item.hidden)
    .map(item => (item.querySelector('use').getAttribute('xlink:href') || '').replace('#sets-', '').replace('-svg', ''));
  const groups = page => [...page.document.querySelectorAll('.select2-results__option[role="group"]')]
    .filter(group => !group.hidden).map(group => group.querySelector('strong').textContent);
  const tick = (page, value, on) => {
    const box = [...page.document.querySelectorAll('#main input[name="games[]"]')]
      .find(input => input.value === value);
    box.checked = on;
    fireEvent(box, 'change');
  };

  // The Games field above the set field is what the user works with: with only
  // Paper ticked, only paper sets stay in the list.
  const paper = await load({ clipboard: false });
  assertEqual(selectValues(paper), ['mh3', 'ysos'], 'with only Paper ticked in Games the Arena and Magic Online sets are hidden');
  assertEqual(listValues(paper), ['mh3'], 'the rendered dropdown follows the same choice');
  assertEqual(groups(paper), ['Expansions'], 'a group that loses every set is hidden with it');

  // Ticking another platform there brings its sets back, both ways.
  tick(paper, 'arena', true);
  tick(paper, 'paper', false);
  assertEqual(selectValues(paper), ['ysos'], 'switching Games to Arena shows the Arena set again');
  assertEqual(listValues(paper), ['ysos'], 'in the dropdown as well');
  tick(paper, 'mtgo', true);
  assertEqual(selectValues(paper), ['ysos', 'me2'], 'and so does the next platform ticked');
  assertEqual(groups(paper), ['Expansions', 'Online'], 'both groups are on screen again');
  tick(paper, 'paper', true);
  assertEqual(selectValues(paper), ['mh3', 'ysos', 'me2'], 'ticking Paper back restores the paper set');
  tick(paper, 'arena', false);
  tick(paper, 'mtgo', false);

  // The settings choice narrows the same field further.
  const arena = await load({ clipboard: false, setPlatforms: ['arena'] });
  assertEqual(selectValues(arena), ['mh3', 'ysos'], 'with Games on Paper the Arena-only setting has nothing to show, so Games wins');
  tick(arena, 'paper', false);
  tick(arena, 'arena', true);
  assertEqual(selectValues(arena), ['ysos'], 'with Arena ticked in Games the setting takes over');
  assertEqual(listValues(arena), ['ysos'], 'and so does the dropdown');

  // With every Games box ticked the field is Scryfall's own again.
  const all = await load({ clipboard: false });
  tick(all, 'arena', true);
  tick(all, 'mtgo', true);
  assertEqual(selectValues(all), ['mh3', 'ysos', 'me2'], 'with every platform ticked in Games the select is untouched');
  assertEqual(listValues(all), ['mh3', 'ysos', 'me2'], 'and so is the rendered dropdown');
  assertEqual(groups(all), ['Expansions', 'Online'], 'no group disappears without a platform filter');

  // Scryfall only builds the dropdown when the field is opened, so the list
  // arrives long after the script has run.
  const closedHtml = html.replace(/<span class="select2 select2-container[\s\S]*?\n    <\/span>\n/, '');
  const late = await load({ clipboard: false }, closedHtml, { mutationObserver: true });
  assertEqual(late.document.querySelectorAll('.select2-results__option').length, 0, 'the field starts without a rendered list');
  late.document.querySelector('.form-row:last-child').insertAdjacentHTML('beforeend', html.match(/<span class="select2 select2-container[\s\S]*?\n    <\/span>\n/)[0]);
  late.flushObservers();
  assertEqual(listValues(late), ['mh3'], 'a list that appears later is filtered as soon as it is rendered');
  assertEqual(groups(late), ['Expansions'], 'and its empty group is hidden with it');
}

async function cardNicknameTest() {
  console.log('content scripts: historical card nicknames');
  const load = async (url, state) => {
    const page = createPage({ url, html: CARD_HTML, state, routes });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.script('assets/data/shambleshark-nicknames.js');
    await page.cardPage();
    await sleep(60);
    return page;
  };
  const on = await load('https://scryfall.com/card/iko/19/lavabrink-venturer', { cards: [], cardNicknames: true });
  const note = on.document.querySelector('.stk-card-nickname');
  assert(note, 'a card Scryfall previewed under another name gets the nickname line');
  assertEqual(note.textContent, 'Scryfall Preview Name: “Professional Stunt Performer”',
    'the line names the source and the nickname under the prints table');
  assert(note.closest('#main .prints'), 'the nickname sits inside the prints block');

  const off = await load('https://scryfall.com/card/iko/19/lavabrink-venturer', { cards: [], cardNicknames: false });
  assert(!off.document.querySelector('.stk-card-nickname'), 'the line stays away while the setting is off');

  const plain = await load('https://scryfall.com/card/tst/1/test-card', { cards: [], cardNicknames: true });
  assert(!plain.document.querySelector('.stk-card-nickname'), 'a card without a nickname gets no line');
}

async function printsSettingsTest() {
  console.log('content scripts: grouped prints can be switched off and trimmed');
  const heads = page => [...page.document.querySelectorAll('.stk-print-group-row')].map(row => row.textContent);
  const foldArrow = page => Boolean(page.document.querySelector('.prints-table.stk-fold-groups'));

  const off = await loadCardPage({ cards: [], printGrouping: false });
  assertEqual(off.document.querySelectorAll('.stk-print-group-row, .stk-print-entry, .stk-print-new-page').length, 0,
    'with grouping off nothing of the rework is added to the table');
  assert(off.document.querySelector('.view-all a'), 'Scryfall’s own View all prints link stays in place');
  assertEqual(off.document.querySelectorAll('.view-all a').length, 1, 'and it is the only link left on the line');
  assertEqual(foldArrow(off), false, 'and no folding is offered');

  const noFold = await loadCardPage({ cards: [], printGrouping: true, printFoldGroups: false, printFullPageLink: true });
  assertEqual(heads(noFold).length, 2, 'groups are still built when only folding is off');
  assertEqual(foldArrow(noFold), false, 'without folding the headers are not marked as toggles');
  assertEqual(noFold.document.querySelectorAll('.stk-group-collapsed').length, 0, 'and no group starts folded');
  const line = noFold.document.querySelector('.stk-print-new-page');
  assertEqual(line.textContent, 'View all prints on a new page →', 'the line falls back to the full-page link only');
  assertEqual(noFold.document.querySelector('.stk-print-new-page-line .prints-all a, .view-all a').textContent, '',
    'without folding there is nothing to expand or fold, so the native label is cleared');
  click(line);
  assertEqual(heads(noFold).length, 2, 'the full page opens in a new tab, so the table stays as it is');

  const noPageLink = await loadCardPage({ cards: [], printGrouping: true, printFullPageLink: false });
  assertEqual(noPageLink.document.querySelectorAll('.stk-print-new-page').length, 0,
    'the full-page link is not added when the setting is off');
  const native = noPageLink.document.querySelector('.prints-all a') || noPageLink.document.querySelector('.view-all a');
  assert(native && !native.closest('.stk-print-new-page-line'), 'the native expand link is left where Scryfall put it');
  assertEqual(native.closest('tr').className, 'view-all', 'and keeps its own row');
  click(native);
  assert(heads(noPageLink).length, 'pressing it still expands the printings in place');

  const all = await loadCardPage({ cards: [] });
  assertEqual(heads(all).length, 0, 'the default leaves Scryfall’s table alone');
  assertEqual(foldArrow(all), false, 'and offers no folding');
  assertEqual(all.document.querySelectorAll('.stk-print-new-page').length, 0, 'and adds no full-page link');

  const on = await loadCardPage({ cards: [], printGrouping: true, printFoldGroups: true, printFullPageLink: true });
  assertEqual(heads(on).length, 2, 'switching the group on builds the groups');
  assertEqual(foldArrow(on), true, 'with folding offered');
  assertEqual(on.document.querySelectorAll('.stk-print-new-page').length, 1, 'and the full-page link on the line');
}

(async () => {
  try {
    await cardPageTest();
    await printsGroupsEdgeTest();
    await promoParentMergeTest();
    await printsOrderTest();
    await printsWindowTest();
    await starNumberTest();
    await singlePrintingTest();
    await printsSameTabTest();
    await searchPageTest();
    await clipboardDisabledTest();
    await legacyMigrationTest();
    await advancedPriceFilterTest();
    await setPlatformTest();
    await advancedSetFilterTest();
    await cardNicknameTest();
    await printsSettingsTest();
    summary('test-preview');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
