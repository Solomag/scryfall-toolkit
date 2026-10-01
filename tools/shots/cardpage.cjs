// Building a card page from the real feature files, filled with real data.
//
// It is the same harness the tests use, on purpose. The illustration is a crop of
// what the code actually produced, so it cannot drift into a picture of a panel
// that no longer exists — and if a feature stops working, the crop comes out empty
// rather than stale, which is checked below.
//
// Nothing in here is typed. The card, its names, its set names, its collector
// numbers, its prices, its finishes and its legalities come from Scryfall's API, and
// its tags come from Tagger's registry — the same two sources the worker uses. The
// previous version of this file had a card called "Test Card" in a set whose number
// #6 did not exist and a commander figure of 4,823, and a reader could not tell any
// of that from a picture of a working feature.
//
// Card art is deliberately absent: the panels that matter for these illustrations
// are tables, badges and lists, and shipping Wizards' card images inside a
// distributed extension is a question this project has no need to answer. A crop
// that came out empty fails here rather than shipping as an empty picture.
//
// One thing is still not real and cannot be, from here: the page around the panels.
// A real screenshot needs this extension loaded into a browser, and Chrome 154
// refuses --load-extension, so the stage is a card-page-shaped container of our own
// with our own stylesheets on it. What is inside the panel is real.
const { createPage, sleep, click } = require('../../tests/testlib.cjs');
const path = require('node:path');
const { ROOT, fileUrl } = require('./render.cjs');
const live = require('./live.cjs');

const ORACLE_ID = '00000000-0000-4000-8000-000000000001';

// The page a user lands on, reduced to the parts our features read. The three rows
// the table starts with are real printings of the real card — Scryfall renders those
// rows itself, and the feature adds the rest — because a set header takes its name
// from the API when the set has any added row and out of the card's own link when
// it has none. A fixture whose every printing is native therefore produces a group
// called "<card name> <set name>", which is what the first version did.
function cardHtml(card, rows, oracleId = ORACLE_ID) {
  const rowHtml = rows.map((row, index) =>
    `<tr${index === 0 ? ' class="current"' : ''}><td>` +
    `<a data-card-id="${row.id}" href="${row.uri}">${row.setName} #${row.number}</a></td>` +
    `<td>${row.set.toUpperCase()}</td><td></td>` +
    `<td>${row.prices && row.prices.usd ? `<a class="currency-usd" href="#">$${row.prices.usd}</a>` : ''}</td></tr>`
  ).join('\n      ');
  return `<!DOCTYPE html><html><head>
<meta name="scryfall:card:id" content="11111111-1111-4111-8111-111111111111">
<meta name="scryfall:oracle:id" content="${oracleId}">
<title>${card.name}</title></head><body>
<div id="main"><div class="inner-flex">
  <div class="card-image"><img alt=""></div>
  <div class="card-text">
    <div class="card-text-card-name">${card.name}</div>
    <div class="card-text-type-line">${card.typeLine || ''}</div>
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
      ${rowHtml}
      <tr class="view-all"><td colspan="4"><a class="prints-all" href="https://scryfall.com/search?unique=prints">View all prints</a></td></tr>
    </tbody></table></div>
  <div class="rulings"></div>
</div></div></body></html>`;
}

// The shape the worker sends, which is not the shape Scryfall's API answers in: a
// printing is normalised to `number`, `setName` and `lang` before it reaches the
// page. A fixture that sends the API's own field names produces rows labelled
// "#undefined" and set names read out of the card's link, which looks like a broken
// feature rather than a wrong fixture.
const normalise = printing => ({
  id: printing.id,
  name: printing.name,
  uri: printing.uri,
  set: printing.set,
  setName: printing.setName,
  number: printing.number,
  lang: printing.lang || 'en',
  digital: Boolean(printing.digital),
  finishes: printing.finishes || [],
  promoTypes: printing.promoTypes || [],
  typeLine: printing.typeLine || '',
  prices: printing.prices || {}
});

// Everything a shot needs, gathered once. Fetched rather than written, so a picture
// that names a set cannot name one that does not exist.
async function fixture() {
  const hero = await live.heroCard();
  const cards = await live.clipboardCards();
  const categories = await live.setCategories();

  // A run of printings with something in it, from one set per group: the tables in
  // the illustrations are read by eye, and a hundred near-identical rows make a
  // picture nobody can see. Which sets they are is Scryfall's choice, sorted the way
  // a reader sees them — latest first — and the digital and non-tournament ones are
  // kept in, because the "hide the extra" shot needs rows it can actually remove.
  const prints = hero.prints.map(normalise);
  const bySet = new Map();
  for (const printing of prints) {
    if (!bySet.has(printing.set)) bySet.set(printing.set, []);
    const rows = bySet.get(printing.set);
    if (rows.length < 3) rows.push(printing);
  }
  const group = [...bySet.entries()].slice(0, 14).flatMap(entry => entry[1]);

  // The rows the page starts with are the ones a reader looks at first, so they are
  // picked to show what the panels do rather than to be convenient.
  //
  // Finish badges are one glyph for one finish: a printing with several finishes
  // gets an empty cell on purpose, so three rows that all had two finishes would
  // produce a column of nothing and read as a feature that does not work. One of
  // each kind of finish is the honest way to show the column — each value still
  // comes from Scryfall, which is what decides what a printing has.
  const nativeRows = [];
  for (const wanted of [['nonfoil'], ['foil'], ['etched'], ['special']]) {
    const found = group.find(printing => wanted.every(finish =>
      printing.finishes.includes(finish)) && printing.finishes.length === wanted.length);
    if (found && !nativeRows.includes(found)) nativeRows.push(found);
  }
  // A digital set and a printing in another language, so the "hide the extra"
  // picture has rows that the settings really do remove. Without one of each it
  // comes out as the same three rows as the finish picture next to it, which shows
  // nothing about hiding anything.
  for (const wanted of [printing => printing.digital, printing => printing.lang !== 'en']) {
    const found = group.find(wanted);
    if (found && !nativeRows.includes(found)) nativeRows.push(found);
  }
  for (const printing of group) {
    if (nativeRows.length >= 5) break;
    if (!nativeRows.includes(printing)) nativeRows.push(printing);
  }

  return {
    hero,
    prints,
    categories,
    clipboard: cards,
    nativeRows: nativeRows.slice(0, 5),
    card: {
      name: hero.name,
      typeLine: (nativeRows[0] && nativeRows[0].typeLine) || ''
    }
  };
}

function routesFor(data) {
  const byId = {};
  for (const printing of data.prints) {
    byId[printing.id] = { finishes: printing.finishes, promoTypes: printing.promoTypes };
  }
  return {
    tags: () => ({
      card: data.hero.cardTags,
      art: data.hero.artTags,
      fallback: false
    }),
    finishes: message => {
      const found = {};
      for (const id of message.ids || []) if (byId[id]) found[id] = byId[id];
      return found;
    },
    card: () => ({ oracle_id: data.hero.oracleId, legalities: data.hero.legalities || {} }),
    allPrints: () => ({ prints: data.prints, truncated: false }),
    setCategories: () => data.categories,
    preview: name => ({ name, image: '', uri: 'https://scryfall.com/card/' })
  };
}

// Runs the real files and hands back the page. `storage` is what the extension
// would have stored, so a shot can show a feature switched on rather than the
// first-run state.
//
// `waitFor` is not politeness. Several features finish after a message round trip,
// so a fixed pause photographs the panel mid-build and produces a picture that
// looks like an empty feature. Naming the element the shot is about means the tool
// waits for it or fails: an illustration of a panel that did not render should be
// an error, never a small picture of nothing.
async function buildCardPage({ data, storage = {}, routes: overrides = {}, html = null, waitFor = null } = {}) {
  if (!data) throw new Error('no data was given, so the page would be full of invented text again');
  const routes = { ...routesFor(data), ...overrides };
  const page = createPage({
    url: 'https://scryfall.com/card/frame/1',
    html: html || cardHtml(data.card, data.nativeRows, data.hero.oracleId),
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

// Waits for a number of things, not merely for one.
//
// This exists because of a picture that was wrong rather than empty. The shot
// waited for "a finish badge", the current printing already had one, and the
// photograph was taken while the rest were still on their way round the message
// round trip. The result looked like a feature that only knows one printing.
async function waitForCount(page, selector, min) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const found = page.document.querySelectorAll(selector);
    if (found && found.length >= min) {
      await sleep(80);
      return page;
    }
    await sleep(50);
  }
  throw new Error('the page produced ' +
    (page.document.querySelectorAll(selector) || []).length + ' of ' + min +
    ' ' + selector + ', so the picture would show a half-built feature');
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

module.exports = { buildCardPage, waitForSelector, waitForCount, cropOf, looksEmpty, reveal,
  fillClipboard, fixture, cardHtml, routesFor, ORACLE_ID };