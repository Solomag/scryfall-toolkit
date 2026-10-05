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
  finishes: message => Object.fromEntries(message.ids.map((id, index) =>
    [id, { finishes: [['nonfoil'], ['foil'], ['etched']][index % 3], promoTypes: [] }])),
  card: () => ({ oracle_id: ORACLE_ID, legalities: { premodern: 'legal', legacy: 'banned' } }),
  allPrints: () => ({ prints, truncated: false }),
  cardtrader: () => ({ available: true, url: 'https://www.cardtrader.com/en/cards/test', nonfoil: { cents: 1234, currency: 'EUR' } }),
  preview: () => ({ name: 'Other Card', image: 'https://cards.scryfall.io/normal/o.jpg', uri: 'https://scryfall.com/card/oth/1/other-card' }),
  // Per category, as the worker answers it now: the settings page has a list under each
  // of the two rules and a flat list of codes cannot be narrowed by one.
  setCategories: () => ({
    digital: ['ysos', 'me2'], nonTournament: [], oversized: [],
    // The measured list, as the worker answers it. `por` is in it because the fixture's own
    // route says Portal is a foreign-only set, which is a fiction — on Scryfall Portal has 215
    // English printings and is not in the list. It is here so the test can watch the list
    // being acted on, and the real file is checked against a real sweep by
    // `npm run set-rules`, which is where the truth about `por` is settled.
    foreignOnly: ['por', 'wmkm'],
    foreignBlackBorder: { '4bb': ['4bb'], fbb: ['fbb'], bchr: ['bchr'] },
    nonEnglish: { portal: ['por', 'p02', 'ptk'], 'secret-lair': ['sld'] }
  }),
  setPlatforms: () => ({ ysos: ['arena'], me2: ['mtgo'] })
};

// The deck page, for the features that only exist there. It is the same card-page scripts
// over different markup and a different address, which is all a deck page is.
//
// `before` runs after the document exists and before any feature file does, which is the
// only place a stand-in for something the document has to answer can go. A feature that
// asks a question at load time cannot be given that answer afterwards: the question has
// already been answered wrongly and the page is already built.
async function loadDeckPage(state, pageRoutes = routes, html = DECK_HTML, before = null) {
  const page = createPage({
    url: 'https://scryfall.com/@reader/decks/abc123/build', html, state, routes: pageRoutes
  });
  if (before) await before(page);
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(60);
  return page;
}

// The deck legality check, which is the one deck feature that asks a question.
//
// What is being asserted is not only that it lists the cards Scryfall calls not legal:
// it is that the panel says which rules it did **not** apply. A legality check that
// reports a deck as fine after asking about each card in turn is the check that guesses,
// and the guess is the part this project has refused three times over.
async function deckLegalityTest() {
  console.log('deck page: the legality check lists what Scryfall says and names its own limits');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="deck-list">
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/mh3/42/test-card">Test Card</a></span></div>
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/penny/1/nineteen-dollar-card">Nineteen Dollar Card</a></span></div>
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/dom/126/dark-ritual">Dark Ritual</a></span></div>
    </div>
    <div class="sidebar"></div>
  </div></body></html>`;
  const answer = {
    format: 'commander', checked: 3, unknown: 1,
    notLegal: [
      { name: 'Nineteen Dollar Card', set: 'penny', collector_number: '1', verdict: 'not_legal',
        uri: 'https://scryfall.com/card/penny/1/nineteen-dollar-card' },
      { name: 'Ancestral Recall', set: 'vma', collector_number: '1', verdict: 'banned',
        uri: 'https://scryfall.com/card/vma/1/ancestral-recall' }
    ]
  };
  const sent = [];
  const page = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: message => { sent.push(message); return answer; } }, html);

  const button = page.document.querySelector('.stk-legality-button');
  assert(button, 'the deck page has a button for it');
  assertEqual(button.textContent, 'Check legality',
    'and it says what it does, in the page language rather than the one it was written in');
  button.dispatchEvent(new page.window.Event('click'));
  await sleep(60);

  assertEqual(sent.length, 1, 'pressing it asks the worker once');
  assertEqual(sent[0].entries, [
    { set: 'mh3', collector_number: '42' },
    { set: 'penny', collector_number: '1' },
    { set: 'dom', collector_number: '126' }
  ], 'and the deck is read off the page as set and collector number, not names');

  const dialog = page.document.getElementById('stk-deck-legality');
  assert(dialog, 'the answer opens in a dialog');
  const text = dialog.textContent;
  assert(/Nineteen Dollar Card/.test(text), 'the card Scryfall calls not legal is named');
  assert(/PENNY #1/.test(text), 'with its set and number, so two printings of one name are told apart');
  // Scryfall has four verdicts, not two, and a banned card is a different problem from a
  // card that was simply never legal here. Paraphrasing both as "not legal" would throw
  // away a distinction Scryfall took the trouble to make - and a reader who was told only
  // "not legal" about Ancestral Recall would go looking for a different printing of it.
  assert(/Ancestral Recall/.test(text) && /VMA #1/.test(text), 'a banned card is named too');
  assert(/banned in Commander/.test(text), 'and says Scryfall called it banned, in the reader\'s words');
  // Per row, not across the dialog: the two cards are both on the list and one row after
  // another, so a whole-dialog match would pair every card with every verdict.
  const rows = [...page.document.querySelectorAll('.stk-legality-list li')];
  const rowFor = needle => rows.find(row => row.textContent.includes(needle));
  assert(!/banned/.test(rowFor('Nineteen Dollar Card').textContent),
    'and a card that is merely not legal is not given the banned wording');
  assert(!/Test Card(?![^\n]*#42)|Test Card —/.test(text.replace(/\s+/g, ' ')) || /mh3|MH3/.test(text),
    'and a card Scryfall calls legal is not on the list');
  // The limits, which is the half a list of card names cannot give. In the page's own
  // language: these are strings written in Russian and translated, and a panel whose
  // warnings are the only part not translated is the worst place for that to show.
  assert(/commander.{0,3}s colour identity/i.test(text),
    'the panel names the commander colour identity it did not check');
  assert(/hundred-card limit/i.test(text), 'and the hundred-card limit');
  assert(/one-copy rule/i.test(text), 'and the one-copy rule');
  assert(/said nothing about/i.test(text), 'and says that one card had no answer, apart from not-legal');
  assert(/Commander/.test(text), 'and says which format it judged');

  const ru = await loadDeckPage({ deckLegality: true, clipboard: false, siteLanguage: 'ru' },
    { ...routes, deckLegality: () => answer }, html);
  ru.document.querySelector('.stk-legality-button').dispatchEvent(new ru.window.Event('click'));
  await sleep(60);
  const ruText = ru.document.getElementById('stk-deck-legality').textContent;
  assertEqual(ru.document.querySelector('.stk-legality-button').textContent, 'Проверить легальность',
    'the button is Russian when the page is');
  assert(/цветовая идентичность командира/i.test(ruText),
    'and the limits are named in Russian too, not left in English');
  assert(/одной копии/i.test(ruText), 'all three of them');

  // The note is last on purpose and the stylesheet pins it there: a hundred-card deck
  // puts it 2,276 pixels down a 1,018-pixel window otherwise. The two halves are one
  // arrangement, so both are asserted — what the panel builds, and what keeps it there.
  const result = page.document.querySelector('.stk-legality-result');
  const last = result.lastElementChild;
  assert(last && last.className === 'stk-legality-note' && last.parentElement === result,
    'the note is the last thing in the panel, so a scrollbar has nothing to hide it behind');
  assert(/hundred-card limit/.test(last.textContent) && /one-copy rule/.test(last.textContent),
    'and the last thing in it is the paragraph that names the limits, not the line about the cards Scryfall would not answer for');

  // The other answers, because a check that only ever has one result is not a check.
  const clean = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: () => ({ format: 'commander', checked: 3, unknown: 0, notLegal: [] }) }, html);
  clean.document.querySelector('.stk-legality-button')
    .dispatchEvent(new clean.window.Event('click'));
  await sleep(60);
  assert(/every card in the deck/i.test(clean.document.getElementById('stk-deck-legality').textContent),
    'a clean deck says so rather than showing an empty list');
  assert(/colour identity/i.test(clean.document.getElementById('stk-deck-legality').textContent),
    'and still names what it did not check, because a clean answer is the one most worth qualifying');

  const silent = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: () => ({ format: 'commander', checked: 0, unknown: 0, notLegal: [] }) }, html);
  silent.document.querySelector('.stk-legality-button')
    .dispatchEvent(new silent.window.Event('click'));
  await sleep(60);
  assert(/did not answer about a single card/i.test(silent.document.getElementById('stk-deck-legality').textContent),
    'and a deck Scryfall said nothing about is not reported as a clean deck');

  // The switch, because a feature that cannot be turned off is a feature everybody has.
  const off = await loadDeckPage({ deckLegality: false, clipboard: false }, routes, html);
  assert(!off.document.querySelector('.stk-legality-button'),
    'with the switch off the button is not on the page at all');
  // And only on a deck, not on a card page that happens to have the markup.
  const elsewhere = await loadDeckPage({ deckLegality: true, clipboard: false }, routes,
    html.replace('https://scryfall.com/@reader/decks/abc123/build', ''));
  assert(elsewhere, 'a deck page built at another address still loads');
}

// Where the deck buttons go, which is the one decision on this page that depends on
// something a test has to supply.
//
// Scryfall's stylesheet shows `.sidebar` only from 800px up and keeps one on a narrow
// screen with the class `always-visible`, so below that the sidebar is `display:none`:
// present in the markup, zero pixels on screen. Both buttons used to be prepended into it
// whenever it existed, and it exists at every width — so on a phone the token dialog and
// the legality check were 0x0 controls and neither could be opened. The fix asks the
// browser whether the sidebar is on screen and puts the button beside the deck list when it
// is not; the second container was already named in the old fallback and was simply never
// reached, because the test was whether the sidebar was *absent* rather than *shown*.
//
// `getClientRects()` is the browser's own answer and the reason this is testable here: an
// element with `display:none` produces no boxes. linkedom has no layout and no
// `getClientRects` at all, so the harness has to say which way the answer goes — and that
// is the whole content of this test. It cannot be checked by `npm run render`, which is
// where that limitation is written down: the features run in the harness and the browser
// only draws what they left behind, so a decision made here cannot be revisited there.
async function deckButtonPlacementTest() {
  console.log('deck page: the buttons go where a reader can see them, not into a hidden box');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="deck-list">
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/mh3/42/test-card">Test Card</a></span></div>
    </div>
    <div class="sidebar"></div>
  </div></body></html>`;

  // What the browser says about the sidebar, given as an argument rather than as a stub on
  // the prototype: two pages, two answers, and the page is otherwise identical.
  const pageWhereSidebarHas = boxes => loadDeckPage(
    { deckTokens: true, deckLegality: true }, routes, html,
    page => {
      // One box per element that is on screen. `display:none` produces none, which is the
      // answer the feature reads and the only thing this test varies.
      page.document.querySelector('#main .sidebar').getClientRects =
        () => boxes.map(() => ({ width: 540, height: 900 }));
    });

  // One box: the sidebar is on screen, which is the desktop.
  const shown = await pageWhereSidebarHas([{}]);
  assert(shown.document.querySelector('#main .sidebar .stk-token-button'),
    'a sidebar that is on screen is where the token button goes');
  assert(shown.document.querySelector('#main .sidebar .stk-legality-button'),
    'and the legality button with it, so the two are never in different places');

  // No boxes: `display:none`, which is every width below 800px — the phone.
  const hidden = await pageWhereSidebarHas([]);
  const main = hidden.document.getElementById('main');
  const tokenButton = hidden.document.querySelector('.stk-token-button');
  const legalityButton = hidden.document.querySelector('.stk-legality-button');
  assert(tokenButton, 'a sidebar with no boxes still gets a button — beside the deck list');
  assert(!hidden.document.querySelector('#main .sidebar .stk-token-button'),
    'and not the unreachable one inside the hidden sidebar');
  assert(!hidden.document.querySelector('#main .sidebar .stk-legality-button'),
    'the legality button too');
  assert(tokenButton && tokenButton.parentElement === main,
    'the token button is in the deck list\'s own container, which is on screen at every width');
  assert(legalityButton && legalityButton.parentElement === main,
    'and the legality button in the same place');
  assert(main.contains(hidden.document.querySelector('.deck-list')),
    'which is the container the deck list is in, so there is something to sit above');

  // The degradation, pinned because the rest of this file depends on it: with no
  // `getClientRects` at all — linkedom's own state — the sidebar is used, which is what the
  // code did before there was a question to ask. Guessing "hidden" would move the buttons
  // somewhere these tests never look and fail for a reason that is not a defect.
  const silent = await loadDeckPage({ deckTokens: true }, routes, html);
  assertEqual(typeof silent.document.querySelector('#main .sidebar').getClientRects,
    'undefined', 'the harness has no getClientRects of its own, so the tests supply it');
  assert(silent.document.querySelector('#main .sidebar .stk-token-button'),
    'and with no answer available the sidebar is used, as it was before');
}

// The sets index, which is the other surface the set filters act on.
//
// It is built the way the extension builds it — the same scripts, over Scryfall's own row
// markup, at Scryfall's own address — because the rule is decided by what a row's link says
// and a fixture that did not look like the page could not tell a working filter from a broken
// one. `#js-checklist` and `/sets/<code>` are the page's own names, not this file's.
const SETS_HTML = `<!DOCTYPE html><html><body><div id="main">
  <div class="search-controls"><label for="order">1059 of 1064 sets in</label></div>
  <table class="checklist" id="js-checklist"><tbody>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/mh3">Modern Horizons 3</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/por">Portal</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/wmkm">MKM Japanese Promo Tokens</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/sld">Secret Lair Drop</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/ysos">Alchemy: Innistrad</a></td></tr>
  </tbody></table>
</div></body></html>`;

async function loadSetsPage(state, pageRoutes = routes, html = SETS_HTML) {
  const page = createPage({ url: 'https://scryfall.com/sets', html, state, routes: pageRoutes });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(80);
  return page;
}

// The set codes of the rows the page has marked, read out of each row's own link. The link is
// a full address on this page, and the code is the last segment, so it is read from there
// rather than from a path this file assumes.
const hiddenSets = page => [...page.document.querySelectorAll('#js-checklist tbody tr')]
  .filter(row => row.classList.contains('stk-digital-set-hidden'))
  .map(row => (/\/sets\/([^/?#]+)/.exec(
    row.querySelector('td:first-child a[href]')?.getAttribute('href') || '') || [])[1])
  .filter(Boolean);

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

  // Copy all: the settings' format on a plain click; the other format in the hover
  // menu. The menu names whichever format the setting is NOT using, so the two buttons
  // can never do the same thing.
  const copyWrap = aside.querySelector('.stk-copy-wrap');
  assert(copyWrap, 'copy button wrapped in a hover menu');
  const copyMenu = copyWrap.querySelector('.stk-copy-menu');
  assert(copyMenu.hidden, 'alternative-format menu starts hidden');
  const copyAll = copyWrap.querySelector('.stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'default copy includes set codes');

  // The menu reads the setting when it opens, so it appears a turn later than the hover.
  fireEvent(copyWrap, 'mouseenter');
  await waitFor(() => !copyMenu.hidden, 'hovering copy opens the menu above');
  const plain = copyMenu.querySelector('.stk-copy-plain');
  // With moxfield chosen, the menu offers the other format, by its own name. It used
  // to say "Names only, no sets" always, which meant that whoever had chosen names in
  // the settings had two buttons doing the same thing and could not reach the set
  // format from here at all.
  assertEqual(plain.textContent, '1 Card name', 'menu offers the format the setting is not using');
  click(plain);
  await waitFor(() => mock.clipboardWrites.length === 2, 'alternative-format copy wrote to clipboard');
  // Three printings of one card, and no set on any line to tell them apart, so they
  // are counted instead. Writing "1 Test Card" three times says the same thing more
  // slowly and pastes into a deck list as three copies.
  assertEqual(mock.clipboardWrites[1], '3 Test Card',
    'without a set on the line, repeat names are counted rather than repeated');
  assert(copyMenu.hidden, 'menu closes after choosing');
  fireEvent(copyWrap, 'mouseleave');
  assert(copyMenu.hidden, 'menu stays closed after leaving');

  // The options setting still picks the default for the plain click. Two of the three
  // entries carry forceSet, which used to be enough on its own to print a set whatever
  // format was asked for — so this one line was '1 Test Card' and the next two carried
  // sets, under a setting whose name promised one or the other.
  mock.state.exportFormat = 'names';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 3, 'setting-driven copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[2], '3 Test Card',
    'the names format means names, including for printings added one by one');

  // And the other way round: with names chosen, the menu offers the set format and
  // gives the sets, because asked for moxfield is asked for moxfield.
  fireEvent(copyWrap, 'mouseenter');
  await waitFor(() => plain.textContent === '1 Card name (SET) number',
    'the menu follows the setting instead of being fixed');
  assertEqual(plain.textContent, '1 Card name (SET) number',
    'the menu follows the setting instead of being fixed');
  click(plain);
  await waitFor(() => mock.clipboardWrites.length === 4, 'the set format is reachable from the menu');
  assertEqual(mock.clipboardWrites[3],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'the alternative is the set format, and it carries sets');

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
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/14/janeway-borderless"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/15/janeway-showcase"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/22/janeway-autograph"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
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
  assertEqual(addButtons.length, 4, 'only visible grid items get add buttons');
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

  // One name, three printings. This is the set-page case: a card is legitimately shown
  // as an alternate borderless, a showcase and an autograph, all three carrying the same
  // name. The selection used to be keyed on the name, so adding the first ticked all
  // three, and adding a second removed the first instead of adding it.
  const janeway = addButtons.slice(1);
  click(janeway[0]);
  await waitFor(() => mock.state.cards.length === 1, 'first printing added');
  assertEqual(janeway[0].textContent, '✓', 'the printing that was clicked is ticked');
  assertEqual([janeway[1].textContent, janeway[2].textContent], ['+', '+'],
    'the other printings of the same card are not ticked along with it');
  assertEqual(mock.state.cards[0].number, '14', 'the set and number name the printing, not the name');

  click(janeway[1]);
  await waitFor(() => mock.state.cards.length === 2,
    'a second printing of the same card can be added as well');
  assertEqual([janeway[0].textContent, janeway[1].textContent, janeway[2].textContent], ['✓', '✓', '+'],
    'each printing carries its own tick');

  // And removing one leaves the others alone.
  click(janeway[0]);
  await waitFor(() => mock.state.cards.length === 1, 'clicking a tick removes only its own printing');
  assertEqual([janeway[0].textContent, janeway[1].textContent], ['+', '✓'],
    'the other printing is still selected');

  // Two printings of one card, and no set to tell the lines apart, so the export counts
  // them rather than writing the name twice.
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 2, 'repeat-name copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[1], '1 Captain Janeway (TRK) 15', 'a single printing is still one of it');
  click(janeway[2]);
  await waitFor(() => mock.state.cards.length === 2, 'third printing added');
  mock.state.exportFormat = 'names';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 3, 'names-only copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[2], '2 Captain Janeway',
    'two printings of one card copy as a count, not as the name twice');
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

  // The four switches are independent, which is the whole point of having four of them.
  // `onlyCardmarket` was one switch hiding both currencies and both shops together, so a
  // reader who wanted no TCGplayer links but kept the dollar column had no way to say so.
  const withPrices = async prices => {
    const page = await load({ clipboard: false, setFilters: { prices }, setFiltersMigrated: true },
      'https://scryfall.com/advanced');
    return [...page.document.querySelectorAll('#price_1 option')].map(option => option.value);
  };
  assertEqual(await withPrices({ tix: true }), ['usd', 'eur'],
    'hiding only MTGO Tickets leaves the dollar search alone');
  assertEqual(await withPrices({ usd: true }), ['eur', 'tix'],
    'and hiding only the dollar column leaves the ticket search alone');
  assertEqual(await withPrices({}), ['usd', 'eur', 'tix'],
    'an empty prices object is no prices hidden, not all of them');
  // Euros is never dropped: it is how a Cardmarket result is filtered on, and Cardmarket
  // is the one price this extension has a reason to add.
  for (const prices of [{ usd: true }, { tix: true }, { usd: true, tix: true }]) {
    assert((await withPrices(prices)).includes('eur'),
      `the euro option survives with prices ${JSON.stringify(prices)}`);
  }
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

  // The mode, on the grouped table prints.js builds itself. This is the second prints
  // surface and it has its own `needsCategories` and its own excluded set, so a check
  // over the native rows alone passes with every mutation of that path applied.
  //
  // Two printings per extra set, and that is not decoration. A set with a single printing
  // gets no group header at all — the row repeats the set name instead, which is what the
  // table does on purpose — so a fixture with one printing each measures nothing at all.
  // The first version of this test asked for groups that can never be there, and spent a
  // long time failing on a table that was behaving exactly as written.
  const borderPrinting = {
    id: 'p4bb', name: 'Test Card', uri: 'https://scryfall.com/card/4bb/1/test-card', set: '4bb',
    setName: 'Border Set', number: '1', lang: 'en',
    digital: false, finishes: ['nonfoil'], prices: {}
  };
  const secondBorderPrinting = {
    ...borderPrinting, id: 'p4bb2', number: '2', uri: 'https://scryfall.com/card/4bb/2/test-card'
  };
  const japanesePortal = {
    id: 'ppor', name: 'Test Card', uri: 'https://scryfall.com/card/por/1/test-card', set: 'por',
    setName: 'Portal', number: '1', lang: 'ja',
    digital: false, finishes: ['nonfoil'], prices: {}
  };
  const englishPortal = {
    ...japanesePortal, id: 'ppor2', number: '2', lang: 'en',
    uri: 'https://scryfall.com/card/por/2/test-card'
  };
  // Nine units, under the table's cap of ten: past it the table stops placing groups and
  // offers the rest behind a link, so a test reading group headers would be reading a
  // rendering rule rather than the filter.
  const modeRoutes = {
    ...routes,
    allPrints: () => ({ prints: [...prints, borderPrinting, secondBorderPrinting, japanesePortal, englishPortal], truncated: false })
  };
  const modePage = (paper = {}, areas) => loadCardPage({
    cards: [],
    // Without this flag the stored object goes through the migration, which would translate
    // it from a shape this build does not use, and the cases that hide nothing would pass
    // without their settings ever having been set. Which is what they did, the first time
    // this ran.
    setFiltersMigrated: true,
    setFilters: {
      platforms: { paper: true, arena: true, mtgo: true },
      areas: areas || { prints: true, search: true, sets: true },
      paper: {
        nonTournament: true, oversized: true, noEnglishSets: true,
        foreignBlackBorder: { '4bb': true, fbb: true, bchr: true },
        nonEnglish: 'all',
        ...paper
      },
      prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
      tokens: true, caster: false
    },
    printGrouping: true, printFoldGroups: true, printFullPageLink: true
  }, modeRoutes);
  const modeGroups = async (paper, areas, count) => {
    const page = await modePage(paper, areas);
    // The count is waited for rather than read once, because the table builds itself from an
    // API answer and the rows land after the page does. Reading once would test the timing of
    // the test rather than the filter, and this fixture has needed both directions of that
    // lesson.
    await waitFor(() => page.document.querySelectorAll('.stk-print-group-row').length === count
      ? true : null, `${count} print groups`);
    return groups(page);
  };
  // The rows the built table added, found by the class prints.js puts on them and not by the
  // text: the page also holds Scryfall's own prints table and a tags table, and a selector
  // loose enough to catch those counts rows this filter never touched.
  const addedRows = page => [...page.document.querySelectorAll('#main .prints-table tbody tr')]
    .filter(row => row.classList.contains('stk-print-entry') || row.classList.contains('stk-print-extra'))
    .map(row => ({ text: row.textContent, href: row.querySelector('a[href]')?.getAttribute('href') || '' }));
  const everySetHere = ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2',
    'Border Set (4BB) · 2', 'Portal (POR) · 2'];
  const withoutBorder = ['Test Set (TST) · 4'];

  assertEqual(await modeGroups({}, null, 4), everySetHere,
    'the grouped table keeps every set with nothing switched off');
  // The border rule removes a whole set, so its group goes with both of its printings —
  // including an English one, which is the difference from the rule below.
  assertEqual(await modeGroups({ foreignBlackBorder: { '4bb': false, fbb: false, bchr: false } }, null, 3),
    ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2', 'Portal (POR) · 2'],
    'switching the border category off takes its set out of the table, English printing included');
  // The language rule removes printings, and what that does to a group depends on what is in
  // it. This fixture is arranged so both answers appear: MH3 holds two Japanese printings and
  // no English one, so the group goes; Portal holds a Japanese and an English printing, so
  // the group stays with one row. That is the whole difference between a rule about a set and
  // a rule about a printing, and it is why they are not one switch.
  // A group of one gets no header, so Portal disappearing from the list of groups here is the
  // English printing still being there — the row simply stops having a header to sit under.
  // That is the table behaving as written, which is the second time this fixture has had to
  // be arranged around it, and it is checked by counting the rows rather than the groups.
  assertEqual(await modeGroups({ nonEnglish: 'none' }, null, 2),
    ['Test Set (TST) · 4', 'Border Set (4BB) · 2'],
    'the language rule at None takes out MH3 whole, since all it has is Japanese, and takes ' +
    'one row out of Portal, which still has an English printing');
  const languagePage = await modePage({ nonEnglish: 'none' });
  // Nine printings in the fixture, three of them non-English, so six rows are left. The count
  // is a floor rather than an exact figure because the table also marks its own group rows,
  // and a group row is not a printing.
  await waitFor(() => addedRows(languagePage).length >= 6, 'six added rows left');
  const kept = addedRows(languagePage).map(row => row.href);
  assert(kept.includes('/card/por/2/test-card'),
    'and Portal is not merely a group of one: its English row is still in the table');
  assert(!kept.some(href => /\/card\/mh3\//.test(href)),
    'while MH3, whose printings were all Japanese, is gone from the rows as well');
  assert(kept.includes('/card/tst/3/test-card') && kept.includes('/card/4bb/1/test-card'),
    'and the language rule touched neither an English TST row nor an English border row');
  // Both together. MH3 loses its only language, the border set loses both of its printings.
  // Both rules at once. What is left is TST, whose four rows are all English, and Portal's
  // one English row, which has lost its group header along with its Japanese printing. So
  // one group and five rows: the two rules between them removed the border set, the Japanese
  // printings and MH3, which had nothing else.
  assertEqual(await modeGroups({
    foreignBlackBorder: { '4bb': false, fbb: false, bchr: false }, nonEnglish: 'none'
  }, null, 1), withoutBorder,
  'both rules at once, and each still does its own kind of removing');

  // The area answer, asked of the surface it governs. This is one list for every rule rather
  // than a selector per rule, so it is asked once and the table obeys. The rule used is the
  // border one, because this fixture has a set for it and no oversized set at all — a check
  // against a rule this card has nothing for measures nothing, which is why the earlier
  // version of this block had to be replaced rather than reworded.
  assertEqual(await modeGroups({ foreignBlackBorder: { '4bb': false, fbb: false, bchr: false } },
    { prints: false, search: false, sets: true }, 4),
    everySetHere, 'a rule that is on with the prints area off removes nothing from the table');
  assertEqual(await modeGroups({ foreignBlackBorder: { '4bb': false, fbb: false, bchr: false } },
    { prints: true, search: false, sets: true }, 3),
    ['Test Set (TST) · 4', 'Modern Horizons 3 (MH3) · 2', 'Portal (POR) · 2'],
    'and with the area on it removes exactly the set it was aimed at');
}

// The mode, on both surfaces, in all three positions.
//
// This is the test 1.1.0 needed and did not have. The mode shipped, the migration
// mapped onto it, and no check ever asked what 'prints' did as opposed to 'sets-prints' —
// so a version that looked like it worked did not work anywhere: `needsSetIndex` and
// `needsCategories` both read a boolean alias that was false for 'prints', so the set
// index was never fetched and the rule did nothing on either surface.
//
// So each position is asked of each surface separately, and the two surfaces are told
// apart: a set row in the index, and a printing row in a prints table on the same page.
async function setSurfaceModeTest() {
  console.log('set filters: the mode decides per surface, and each surface decides for itself');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="search-controls"><label for="order">0 of 0 sets in</label><select id="order"><option>Name</option></select></div>
    <table id="js-checklist"><tbody>
      <tr><td><a href="https://scryfall.com/sets/mh3">Modern Horizons 3</a></td><td>MH3</td></tr>
      <tr><td><a href="https://scryfall.com/sets/4bb">Fourth Edition Foreign Black Border</a></td><td>4BB</td></tr>
      <tr><td><a href="https://scryfall.com/sets/por">Portal</a></td><td>POR</td></tr>
    </tbody></table>
    <table class="prints-table"><tbody>
      <tr><td><a href="/card/mh3/1/test-card">Test Card</a></td><td>MH3</td></tr>
      <tr><td><a href="/card/4bb/1/test-card">Test Card</a></td><td>4BB</td></tr>
      <tr><td><a href="/card/por/1/ja/test-card">Test Card</a></td><td>POR</td><td>JA</td></tr>
    </tbody></table>
  </div></body></html>`;
  const hiddenSets = page => [...page.document.querySelectorAll('#js-checklist tbody tr')]
    .filter(row => row.classList.contains('stk-digital-set-hidden'))
    .map(row => row.querySelector('a').textContent);
  const hiddenPrints = page => [...page.document.querySelectorAll('.prints-table tbody tr')]
    .filter(row => row.classList.contains('stk-digital-set-hidden'))
    .map(row => row.querySelector('a').getAttribute('href'));
  const load = (areas, paper = {}) => {
    const state = {
      clipboard: false, setFiltersMigrated: true,
      setFilters: {
        platforms: { paper: true, arena: true, mtgo: true },
        areas: areas || { prints: true, search: true, sets: true },
        paper: {
          nonTournament: true, oversized: true, noEnglishSets: true,
          foreignBlackBorder: { '4bb': false, fbb: false, bchr: false },
          nonEnglish: 'none',
          ...paper
        },
        prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
        tokens: true, caster: false
      }
    };
    return (async () => {
      const page = createPage({ url: 'https://scryfall.com/sets', html, state, routes });
      await page.cardPage();
      await sleep(80);
      return page;
    })();
  };

  // Nothing switched off. Every rule is at its default, so nothing is hidden anywhere, and
  // this is the state every reader starts in — which is the first thing to be sure of after
  // a change of shape, because a default that hides something is a default that takes rows
  // away from somebody who never asked.
  const off = await load(null, {
    nonEnglish: 'all',
    foreignBlackBorder: { '4bb': true, fbb: true, bchr: true }
  });
  assertEqual(hiddenSets(off), [], 'with nothing switched off nothing is hidden from the sets index');
  assertEqual(hiddenPrints(off), [], 'nor from the prints table on the same page');

  // The rule on, both areas in force: it removes a set from the index and a printing from
  // the table, which are two different acts done by one switch.
  const both = await load(null);
  assertEqual(hiddenSets(both), ['Fourth Edition Foreign Black Border'],
    'the border rule hides its set from the index');
  assertEqual(hiddenPrints(both), ['/card/4bb/1/test-card', '/card/por/1/ja/test-card'],
    'and both rules hide a printing from the table — the border one and the Japanese one');

  // The distinction the redesign is built on: a set rule removes a set, a printing rule
  // removes a printing. Portal has an English printing, so hiding the Japanese one does not
  // hide Portal, and a set is not hidden because some of its printings are.
  assertEqual(hiddenSets(both).includes('Portal'), false,
    'the language rule does not remove the set that holds a translated printing');
  assertEqual(hiddenPrints(both).includes('/card/por/2/test-card'), false,
    'nor the English printing of the same set');

  // One area off, and the other still on. This is what "where to apply" now means: a single
  // shared answer rather than a per-rule selector, so the same rule reaches one surface and
  // leaves the other alone.
  const printsOnly = await load({ prints: true, search: true, sets: false });
  assertEqual(hiddenSets(printsOnly), [], 'leaving the sets index off leaves it alone');
  assertEqual(hiddenPrints(printsOnly), ['/card/4bb/1/test-card', '/card/por/1/ja/test-card'],
    'while the prints table, which was asked for, still loses both rows');

  const setsOnly = await load({ prints: false, search: true, sets: true });
  assertEqual(hiddenSets(setsOnly), ['Fourth Edition Foreign Black Border'],
    'the other way round, the sets index still loses the border set');
  assertEqual(hiddenPrints(setsOnly), [],
    'and the prints table keeps every row, English and translated alike');

  // A rule on with nowhere to act. The pair is the whole of the requirement: neither half
  // removes anything on its own.
  const nowhere = await load({ prints: false, search: false, sets: false });
  assertEqual(hiddenSets(nowhere), [], 'a rule that is on with every area off removes nothing');
  assertEqual(hiddenPrints(nowhere), [], 'on either surface');

  // Narrowing a category rather than switching it. Foreign Black Border is per family, so
  // leaving 4BB on keeps its sets and its printings while the other two families are off —
  // which is the requirement about unticking one having to mean something.
  const narrow = await load(null, {
    foreignBlackBorder: { '4bb': true, fbb: false, bchr: false },
    nonEnglish: 'none'
  });
  assertEqual(hiddenSets(narrow), [], 'showing 4BB keeps it in the sets index');
  assertEqual(hiddenPrints(narrow), ['/card/por/1/ja/test-card'],
    'and keeps its printing on the card page too, while the language rule takes only its own row');

  // The language rule's three positions, each asked of the one surface that can act on it.
  // The middle one is not a boolean and cannot be reached by flipping the third, so it gets
  // its own case rather than being folded into the other two.
  const all = await load(null, {
    nonEnglish: 'all',
    foreignBlackBorder: { '4bb': false, fbb: false, bchr: false }
  });
  assertEqual(hiddenPrints(all), ['/card/4bb/1/test-card'],
    'All hides nothing by language, while the border rule still hides its own row');
  assertEqual(hiddenSets(all), ['Fourth Edition Foreign Black Border'],
    'and the sets index loses only the border set, since the language rule is about printings');

  // The grouped table — the other prints surface, built by prints.js out of the API's
// answer with its own needsCategories and its own excluded set — is checked in
// setPlatformTest, next to the pages that demonstrably render one. Two things about it
// are worth knowing before writing a check against it, because both cost an afternoon:
//
//   A set with a single printing gets no group header at all; the row repeats the set
//   name instead. That is the table behaving as written, not a fault, and a fixture with
//   one printing per extra set measures nothing.
//   Past ten units the table stops placing groups and offers the rest behind a link, so
//   a check reading group headers has to keep the table short.
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

// The clipboard's identity and formatting rules, on their own.
//
// They were moved out of the two page scripts precisely so they could be tested without
// a page, and because the card page and the Tagger page had each grown their own copy of
// them and the copies had already disagreed. A rule that only has a copy is a rule with
// no owner; these are checked here so neither page can drift away from them again.
function clipboardFormatTest() {
  console.log('clipboard: one set of rules, shared by both pages');
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const context = { window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'clipboard-format.js'), 'utf8'), context);
  const F = context.window.STK_CLIPBOARD_FORMAT;

  assert(F, 'the module publishes its rules on the window the page scripts read');
  for (const name of ['printKey', 'entryKey', 'formatCard', 'clipboardText', 'otherFormat']) {
    assert(typeof F[name] === 'function', `${name} is published`);
  }

  // Identity. Two printings of one card are two entries; the same printing reached by
  // a differently-cased set code is one.
  assert(F.printKey('TRK', '14') === F.printKey('trk', '14'), 'a set code is not case sensitive');
  assert(F.printKey('trk', '14') !== F.printKey('trk', '22'), 'the collector number is part of the identity');
  assert(F.entryKey({ name: 'Janeway', set: 'trk', number: '14' }) !== F.entryKey({ name: 'Janeway', set: 'trk', number: '22' }),
    'two printings of one card are two entries');
  assertEqual(F.entryKey({ name: 'Janeway' }), F.entryKey({ name: 'janeway' }),
    'an entry with no set falls back to its name, and case does not split it');

  // The format that carries sets. forceSet is no longer a way to force one, which is
  // what used to make 'names only' produce some lines with a set and some without.
  const forced = { name: 'Test Card', set: 'tst', number: '2', forceSet: true };
  assertEqual(F.formatCard(forced, 'names', false), '1 Test Card',
    'the names format means names, even for a printing added one at a time');
  assertEqual(F.formatCard(forced, 'moxfield', false), '1 Test Card (TST) 2',
    'the set format carries the set');
  assertEqual(F.formatCard(forced, 'moxfield', true), '1 Test Card',
    'stripping sets still strips them');

  // Grouping, which happens only where the lines could not be told apart.
  const list = [
    { name: 'Mana Drain', set: 'dom', number: '15' },
    { name: 'Mana Drain', set: 'dom', number: '16' },
    { name: 'Mana Drain', set: 'sta', number: '68' },
    { name: 'Island', set: 'dom', number: '51' }
  ];
  assertEqual(F.clipboardText(list, 'names', false), '3 Mana Drain\n1 Island',
    'repeat names are counted when there is no set to tell them apart');
  assertEqual(F.clipboardText(list, 'moxfield', false),
    '1 Mana Drain (DOM) 15\n1 Mana Drain (DOM) 16\n1 Mana Drain (STA) 68\n1 Island (DOM) 51',
    'with a set on the line, printings stay apart and the count is one');
  assertEqual(F.clipboardText(list, 'names', false).split('\n')[0], '3 Mana Drain',
    'the count leads the name, which is what a deck list wants');

  // Case-insensitive grouping: Magic card names are unique that way, so two spellings
  // differing only in case are one card and one count. The spelling kept is the one that
  // arrived first, so the output is not reshuffled into whatever case came last.
  assertEqual(F.clipboardText([
    { name: 'mana drain', set: 'dom', number: '15' },
    { name: 'Mana Drain', set: 'sta', number: '68' }
  ], 'names', false), '2 mana drain',
    'two spellings differing only in case are one card and one count, in the first spelling seen');

  assertEqual(F.clipboardText([], 'names', false), '', 'an empty clipboard copies nothing, not a blank line');
  assertEqual(F.clipboardText(undefined, 'names', false), '', 'a missing clipboard is treated as empty');

  // The alternative button, and the guarantee it rests on: with two formats the
  // alternative is always the other one, so the two buttons cannot do the same thing.
  assertEqual(F.otherFormat('moxfield'), 'names', 'the alternative to the set format is names');
  assertEqual(F.otherFormat('names'), 'moxfield', 'and the other way round');
  assertEqual(F.otherFormat(F.otherFormat('moxfield')), 'moxfield', 'so there are exactly two');
  assertEqual(F.FORMATS.names.withSets, false, 'the names format has no set on it');
  assertEqual(F.FORMATS.moxfield.withSets, true, 'the set format has one');
}

// The foreign-only rule on the sets index: a plain switch over a measured list, and the one
// rule in the group whose list is dated rather than fetched.
//
// What matters here is that the page asks the worker for the list and acts on the answer. The
// list itself is not this test's business — whether `por` belongs in it is settled against
// Scryfall by `npm run set-rules`, and settled wrongly on purpose in the route above so that a
// page which stopped reading the list could be caught. A rule that reads `undefined` and hides
// nothing looks exactly like a rule switched off, which is why the mutation list has one for
// it.
async function foreignOnlySetsTest() {
  console.log('sets index: the foreign-only switch hides the measured list and nothing else');
  const base = { setFiltersMigrated: true, setFilters: {
    setsEnabled: true,
    platforms: { paper: true, arena: true, mtgo: true },
    sets: { nonTournament: false, oversized: false, foreignOnly: true,
      foreignBlackBorder: { surfaces: 'off', which: [] },
      nonEnglish: { surfaces: 'off', which: [] } },
    prices: {}, tokens: false, caster: false
  } };

  const on = await loadSetsPage(base);
  assertEqual(hiddenSets(on), ['por', 'wmkm'],
    'both sets the worker names as foreign-only are marked, and in page order');

  const off = await loadSetsPage({ ...base, setFilters: { ...base.setFilters,
    sets: { ...base.setFilters.sets, foreignOnly: false } } });
  assertEqual(hiddenSets(off), [],
    'with the switch off nothing is hidden, so the two are not the same page');

  // The gate. A rule that answered the question itself instead of asking would keep hiding
  // rows behind a closed master switch, which is the whole thing the gate is for.
  const gated = await loadSetsPage({ ...base, setFilters: { ...base.setFilters,
    setsEnabled: false } });
  assertEqual(hiddenSets(gated), [],
    'and with the master switch off the rule does nothing, without losing the choice');

  // A worker that answers without the list — an older build's cache, or the failure path.
  // The page must not treat a missing list as a reason to hide everything.
  const empty = await loadSetsPage(base, { ...routes, setCategories: () => ({
    digital: [], nonTournament: [], oversized: [], foreignOnly: [],
    foreignBlackBorder: {}, nonEnglish: {}
  }) });
  assertEqual(hiddenSets(empty), [],
    'a worker that answers with an empty list hides nothing rather than everything');

  // And the counter, which the reader quotes.
  const counter = on.document.querySelector('#main .search-controls label[for="order"]');
  assert(counter && /3 of 5/.test(counter.textContent),
    'the counter above the list counts what is left, not what the page holds ("' +
    (counter ? counter.textContent.trim() : 'absent') + '")');
}

(async () => {
  try {
    clipboardFormatTest();
    await foreignOnlySetsTest();
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
    await deckLegalityTest();
await deckButtonPlacementTest();
await setSurfaceModeTest();
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
