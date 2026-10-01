// Building a card page from the real feature files, with the data a reader needs
// to see a feature rather than an empty shell.
//
// It is the same harness the tests use, on purpose. The illustration is a crop of
// what the code actually produced, so it cannot drift into a picture of a panel
// that no longer exists — and if a feature stops working, the crop comes out empty
// rather than stale, which is checked below.
//
// Nothing here reaches the network. Card art is deliberately absent: the panels
// that matter for these illustrations are tables, badges and lists, and shipping
// Wizards' card images inside a distributed extension is a question this project
// has no need to answer. A crop that came out empty fails here rather than
// shipping as an empty picture.
const { createPage, sleep, click } = require('../../tests/testlib.cjs');
const path = require('node:path');
const { ROOT, fileUrl } = require('./render.cjs');

const ORACLE_ID = '00000000-0000-4000-8000-000000000001';
const REL_ONE = '55555555-5555-4555-8555-555555555555';
const REL_TWO = '77777777-7777-4777-8777-777777777777';

// The card page a user lands on, reduced to the parts our features read. It is not
// Scryfall's markup and does not try to be: the illustrations crop our own
// elements, and the surface around them is a plain card-page-shaped container.
const CARD_HTML = `<!DOCTYPE html><html><head>
<meta name="scryfall:card:id" content="11111111-1111-4111-8111-111111111111">
<meta name="scryfall:oracle:id" content="${ORACLE_ID}">
<title>Test Card</title></head><body>
<div id="main"><div class="inner-flex">
  <div class="card-image"><img alt=""></div>
  <div class="card-text">
    <div class="card-text-card-name">Test Card</div>
    <div class="card-text-type-line">Instant</div>
    <div class="card-text-box"><div class="card-text-mana-cost"></div><div class="card-text"></div></div>
    <div class="card-legality"><div class="card-legality-row">
      <div class="card-legality-item"><dt>Standard</dt><dd class="legal">Legal</dd></div>
      <div class="card-legality-item"><dt>Modern</dt><dd class="legal">Legal</dd></div>
    </div></div>
  </div>
  <div class="toolbox"><div id="stores"><ul class="toolbox-links"></ul></div></div>
  <div class="prints"><table class="prints-table">
    <thead><tr><th>Name</th><th>Set</th><th>Rarity</th><th><span>USD</span></th></tr>
    <tbody>
      <tr class="current"><td><a data-card-id="p1" href="https://scryfall.com/card/m19/1/test-card">Core Set 2019 #1</a></td><td>M19</td><td>R</td><td><a class="currency-usd" href="#">$3.41</a></td></tr>
      <tr><td><a data-card-id="p2" href="https://scryfall.com/card/mh3/2/test-card">Modern Horizons 3 #2</a></td><td>MH3</td><td>U</td><td></td></tr>
      <tr><td><a data-card-id="p3" href="https://scryfall.com/card/znr/3/test-card">Zendikar Rising #3</a></td><td>ZNR</td><td>M</td><td><a class="currency-usd" href="#">$1.20</a></td></tr>
      <tr class="view-all"><td colspan="4"><a class="prints-all" href="https://scryfall.com/search?unique=prints">View all prints</a></td></tr>
    </tbody></table></div>
  <div class="rulings"></div>
</div></div></body></html>`;

// Eight printings across five sets, one of them digital.
//
// Three of them are the rows Scryfall itself renders, and the rest are what the
// feature fetches and adds. That split is not decoration: a set header takes its
// name from the API when the set has any added row and out of the card's own link
// when it has none, so a fixture whose every printing is native produces a group
// called "Test Card Core Set 2019" — the card name glued to the set name, which is
// what the first version of this fixture did.
// The shape the worker sends, which is not the shape Scryfall's API answers in: the
// printing is normalised to `number`, `setName` and `lang` before it reaches the
// page. A fixture that sends the API's own field names produces rows labelled
// "#undefined" and set names read out of the card's link, which looks like a broken
// feature rather than a wrong fixture.
const printing = (id, set, setName, number, prices, finishes, extra = {}) =>
  Object.assign({
    id,
    name: 'Test Card',
    uri: 'https://scryfall.com/card/' + set + '/' + number + '/test-card',
    set,
    setName,
    number,
    lang: 'en',
    digital: false,
    finishes,
    prices
  }, extra);

const PRINTS = [
  printing('p1', 'm19', 'Core Set 2019', '1', { usd: '3.41', eur: '3.02', tix: '2.10' }, ['nonfoil']),
  printing('p2', 'mh3', 'Modern Horizons 3', '2', {}, ['nonfoil']),
  printing('p3', 'znr', 'Zendikar Rising', '3', { usd: '1.20' }, ['foil']),
  printing('p4', 'm19', 'Core Set 2019', '300', { usd: '9.99' }, ['etched']),
  printing('p5', 'mh3', 'Modern Horizons 3', '150', { usd: '4.10' }, ['nonfoil']),
  printing('p6', 'znr', 'Zendikar Rising', '201', { usd: '2.30' }, ['nonfoil']),
  printing('p7', 'ysos', 'Alchemy:Ixalan', '4', {}, ['nonfoil'], { digital: true }),
  printing('p8', 'dom', 'Dominaria', '5', { usd: '0.89', eur: '0.80' }, ['nonfoil'])
];

const DEFAULT_ROUTES = {
  tags: () => ({
    card: [
      { name: 'Removal', slug: 'removal', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Instant', slug: 'instant', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Response', slug: 'response', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Counterspell', targetId: REL_ONE, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' },
      { name: 'Memory Jar', targetId: REL_TWO, tagType: 'IN_OTHERS_BCM', relation: true, targetKind: 'card' }
    ],
    art: [
      { name: 'Symbolic art', slug: 'symbolic-art', tagType: 'ORACLE_ART_TAG' },
      { name: 'Full art', slug: 'full-art', tagType: 'ORACLE_ART_TAG' }
    ],
    fallback: false
  }),
  // EDHREC's usage and salt, in the fields the card-page feature reads. The names
  // are the ones the code asks for, not the ones a person would guess: it wants
  // numDecks against potentialDecks to work out the fraction.
  edhrec: () => ({
    name: 'Test Card',
    numDecks: 4823,
    potentialDecks: 23140,
    salt: 0.31,
    url: 'https://www.edhrec.com/cards/test-card'
  }),
  finishes: message => {
    const byId = {};
    for (const id of message.ids || []) {
      const print = PRINTS.find(p => p.id === id);
      if (print) byId[id] = { finishes: print.finishes, promoTypes: print.promoTypes };
    }
    return byId;
  },
  card: () => ({
    oracle_id: ORACLE_ID,
    legalities: { premodern: 'legal', legacy: 'banned', commander: 'legal', oath: 'legal' }
  }),
  allPrints: () => ({ prints: PRINTS, truncated: false }),
  cardtrader: () => ({ available: true, url: 'https://www.cardtrader.com/en/cards/test', nonfoil: { cents: 1234, currency: 'EUR' } }),
  setCategories: () => ({
    digital: ['ysos'], nonTournament: [], oversized: [], foreignBlackBorder: []
  }),
  setPlatforms: () => ({ ysos: ['arena'], mh3: ['mtgo'], m19: ['paper'], znr: ['paper'], dom: ['paper'] }),
  preview: name => ({ name, image: '', uri: 'https://scryfall.com/card/m19/1/test-card' })
};

// Runs the real files and hands back the page. `storage` is what the extension
// would have stored, so a shot can show a feature switched on rather than the
// first-run state.
//
// `waitFor` is not politeness. Several features finish after a message round trip,
// so a fixed pause photographs the panel mid-build and produces a picture that
// looks like an empty feature. Naming the element the shot is about means the tool
// waits for it or fails: an illustration of a panel that did not render should be
// an error, never a small picture of nothing.
async function buildCardPage({ storage = {}, routes: overrides = {}, html = CARD_HTML, waitFor = null } = {}) {
  const routes = { ...DEFAULT_ROUTES, ...overrides };
  const page = createPage({
    url: 'https://scryfall.com/card/m19/1/test-card',
    html,
    state: { cards: [], ...storage },
    routes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(150);
  if (waitFor) await waitForSelector(page, waitFor);
  await sleep(120);
  return page;
}

// Waits for an element, or says plainly that it never arrived.
//
// Separate from building the page because some features need doing to them before
// they have anything to show: the clipboard is empty until a reader presses the
// button, so waiting for its rows before pressing it waits for a thing that has not
// been asked for yet.
async function waitForSelector(page, selector) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (page.document.querySelector(selector)) {
      await sleep(80);
      return page;
    }
    await sleep(50);
  }
  throw new Error('the page never produced ' + selector +
    ', so there is nothing to photograph. The feature is either off, renamed, or broken.');
}

// A crop of what the code produced, as markup.
//
// The extension's own image URLs are rewritten to absolute paths on disk. They have
// to be absolute: the rendered page is written into dist/, so a relative path
// resolves inside dist/ and every icon in the picture is a broken-image box — which
// is what the first version produced, and it looks like a broken feature rather
// than a broken path.
//
// A crop that came out with no text in it, or with nothing at all, is an error
// rather than a small picture: an illustration that shows an empty panel is worse
// than no illustration, because a reader cannot tell it apart from a working one.
// The extension's own files, as a file:// prefix. The trailing separator is added
// by hand: path.resolve drops it, and without it every icon in the picture resolves
// to "…/scryfall-toolkitassets/icons/clip.svg" and comes out as a broken-image box.
const EXTENSION_FILES = fileUrl(ROOT) + '/';

function cropOf(document, selector) {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error('nothing matched ' + selector + ', so there is nothing to show');
  }
  return el.outerHTML.replace(
    /(["'(])(chrome-extension:\/\/scryfall-toolkit\/)/g,
    (match, quote) => quote + EXTENSION_FILES
  );
}

// Shows what a reader has to press to see. The clipboard's list starts hidden on a
// real page, so an illustration of it taken as it loads is an illustration of a
// collapsed panel.
function reveal(page, selector) {
  const el = page.document.querySelector(selector);
  if (!el) throw new Error('there is no ' + selector + ' to open');
  // The attribute as well as the property. Setting the property is enough for the
  // harness and not for the browser: the markup keeps hidden="", the browser hides
  // the element, and the crop comes out 80 pixels tall.
  el.hidden = false;
  if (typeof el.removeAttribute === 'function') el.removeAttribute('hidden');
  return page;
}

// Whether a crop carries anything a reader could look at.
function looksEmpty(html) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const images = (html.match(/<img\b/gi) || []).length;
  return text.length < 12 && images === 0;
}

// Fills the clipboard by pressing the button a user presses. The clipboard starts
// empty on purpose — a stored list would be a list nobody put there — so an
// illustration of it has to add the cards the way a reader would.
async function fillClipboard(page, count = 3) {
  const add = page.document.querySelector('.card-image .stk-add');
  if (!add) throw new Error('the card image has no add button, so the clipboard cannot be filled');
  for (let i = 0; i < count; i++) {
    click(add);
    await sleep(40);
  }
  const list = page.document.querySelector('.stk-list');
  if (list) list.hidden = false;
  await sleep(60);
  return page;
}

module.exports = { buildCardPage, waitForSelector, cropOf, looksEmpty, reveal, fillClipboard,
  CARD_HTML, PRINTS, ORACLE_ID, REL_ONE, REL_TWO };