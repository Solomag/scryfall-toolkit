// Real data for the illustrations, fetched when the shots are made.
//
// The first version of these pictures was full of invented text: a card called
// "Test Card", a commander figure of 4,823, a printing numbered #6 in a set that had
// no such printing. A reader cannot tell that from a picture of a real feature,
// which is exactly why it is wrong.
//
// Nothing here is typed. Every name, number and price comes from one of the two
// sources the extension itself uses:
//
//   Tagger's registry (tagger.scryfall.com/graphql) for tags and related cards —
//     the same query the worker sends, so a tag in a picture is a tag with a name a
//     user will see, and the related-cards table is the real one;
//   Scryfall's public API for printings, set names, collector numbers, finishes,
//     prices and legalities.
//
// Responses are cached under dist/, because a build tool that re-downloads on every
// run is a tool nobody runs, and because a screenshot that changes when a third party
// changes is not reproducible either.
//
// What is still not real, and is recorded in the tool that makes the shots:
//
//   The page. A real screenshot needs this extension loaded into a browser, and
//   Chrome 154 refuses --load-extension, so the panels hang off a reduced card-page
//   container of our own. Everything inside the panel is real.
//
//   EDHREC's deck counts. json.edhrec.com answers 403 to anything that is not their
//   own site, so a real number cannot be put in a picture from here. The settings
//   section that would have shown it is illustrated with what the extension computes
//   itself instead, rather than with a number that would have to be invented.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..') + path.sep;
const CACHE = path.join(ROOT, 'dist', 'live-data');
const AGENT = 'Scryfall Toolkit build tool (pictures for the settings page)';

// Candidates in order; the first one that satisfies every requirement below wins. A
// card with no tags gives an empty panel, and one that is legal nowhere in the
// formats this extension adds gives a picture of Scryfall's own rows and nothing of
// ours — both are failures a reader could not tell from a working feature.
const CANDIDATES = [
  { set: 'm21', number: '57', name: 'Counterspell' },
  { set: 'lea', number: '168', name: 'Dark Ritual' },
  { set: 'm19', number: '170', name: 'Lightning Bolt' },
  { set: 'lea', number: '1', name: 'Sol Ring' },
  { set: 'm19', number: '1', name: 'Aegis of the Heavens' }
];

// The four formats the extension adds to the legality block, from its own format
// catalog. The legality picture is about them, so the card has to be legal — or
// illegal — somewhere in them, which is a fact about the card rather than a fact
// about the picture.
const EXTRA_FORMATS = ['premodern', 'heritage', 'classic', 'peak'];

function cacheFile(key) {
  // The whole key, hashed. An earlier version kept only the last 110 characters of
  // it, which is not long enough to tell two different POST bodies apart, so a
  // request could be answered with another's cached response — including a GraphQL
  // reply offered to the card collection endpoint.
  const digest = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
  const tail = key.replace(/[^a-z0-9]+/gi, '_').slice(-40);
  return path.join(CACHE, digest + '_' + tail + '.json');
}

async function cachedGet(url) {
  const file = cacheFile('get ' + url);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
  const data = await readOrFail(response, url);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return data;
}

async function cachedPost(url, body) {
  const file = cacheFile('post ' + url + ' ' + body);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Scryfall answers 400 to a POST without one, with a rule name rather than
      // anything that points at the header.
      'User-Agent': AGENT
    },
    body
  });
  const data = await readOrFail(response, url);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return data;
}

// The reason travels with the failure. A bare status number is the kind of message
// that costs an afternoon: "400 from ..." says nothing about which of the request,
// the address or the body was wrong.
async function readOrFail(response, url) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(response.status + ' from ' + url + ': ' + text.slice(0, 200).replace(/\s+/g, ' '));
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(url + ' answered with something that is not JSON: ' + text.slice(0, 120));
  }
}

// The query the worker sends. Edges are what the tag tables and the related-cards
// table are built from, so asking for them here means the picture is built from the
// same data the panel is.
async function taggerEdges({ set, number, name }) {
  const query = '{ card(name:' + JSON.stringify(name) + ', set:' + JSON.stringify(set) +
    ', number:' + JSON.stringify(String(number)) + '){ name oracleId illustrationId edges { tag { name slug type namespace } } } }';
  const url = 'https://tagger.scryfall.com/graphql/registry?name=shambleshark_card_edges' +
    '&set=' + encodeURIComponent(set) + '&number=' + encodeURIComponent(number);
  const answer = await cachedPost(url, JSON.stringify({ query }));
  return readEdges(answer);
}

// The same edges, asked for by oracle id rather than by printing — which is how a
// picture gets the tags of the card its page is actually showing. The tag names come
// from here, and a name that belongs to a different card is a picture of a card that
// does not exist.
async function taggerEdgesByOracle(oracleId) {
  const query = '{ cardOracle(oracleId:' + JSON.stringify(oracleId) +
    '){ name oracleId illustrationId edges { tag { name slug type namespace } } } }';
  const url = 'https://tagger.scryfall.com/graphql/registry?name=shambleshark_oracle_edges';
  return readEdges(await cachedPost(url, JSON.stringify({ query })));
}

function readEdges(answer) {
  const card = answer && answer.data && (answer.data.card || answer.data.cardOracle);
  if (!card || !Array.isArray(card.edges)) return null;

  const tags = { card: [], art: [] };
  for (const edge of card.edges) {
    const tag = edge && edge.tag;
    // Relation edges answer with no name and no namespace — the relation is on the
    // edge itself, not on the tag — so they are left out rather than guessed at.
    // The picture shows the two tag tables, which is where the names are.
    if (!tag || !tag.name || !tag.namespace) continue;
    const row = { name: tag.name, slug: tag.slug, tagType: tag.type };
    if (tag.namespace === 'artwork' && tag.type === 'ILLUSTRATION_TAG') tags.art.push(row);
    else if (tag.namespace === 'card' && tag.type === 'ORACLE_CARD_TAG') tags.card.push(row);
  }
  return {
    name: card.name,
    oracleId: card.oracleId,
    illustrationId: card.illustrationId,
    cardTags: dedupe(tags.card),
    artTags: dedupe(tags.art)
  };
}

const dedupe = rows => {
  const seen = new Set();
  return rows.filter(row => {
    const key = row.slug || row.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Every printing of the card — the address the worker builds, exactly.
//
// It was `name:"X"&unique=prints` here first, and that is a different list: 73
// printings of Counterspell by name against 88 by oracle id. The picture is meant to be
// what the extension puts on a screen, and the extension asks Scryfall by oracle id.
//
// Three of the four obvious addresses do not give the list at all, which is worth
// knowing because each of them looks like "this card has one printing": /cards/named
// with all_printings=true answers with a single printing; /cards/collection with `id`
// means one printing, so an oracle id in that field comes back as not found; and a
// search by oracle id *without* unique=prints indexes one printing as well. That last
// one is what made it look like the extension's own query had stopped working.
async function allPrintings(oracleId) {
  const list = [];
  let page = null;
  for (let guard = 0; guard < 9 && (guard === 0 || page); guard++) {
    const query = 'https://api.scryfall.com/cards/search?q=' +
      encodeURIComponent('oracleid:' + oracleId) + '&unique=prints&order=released&dir=desc' +
      (page ? '&page=' + page : '');
    const answer = await cachedGet(query);
    if (!answer || !Array.isArray(answer.data)) break;
    list.push(...answer.data);
    page = answer.has_more ? list.length : 0;
  }
  return list.filter(p => p && p.set);
}

// One real card, with everything a shot needs.
//
// `printing` asks for a particular card, by the set and number of the printing a
// picture is cut from: the data in the panel has to be that card's data, or the tag
// panel shows one card's tags beside another card's name. Tagger answers by printing
// and not by oracle id — it has no query of the kind that takes one — so the page's own
// printing is the only handle there is, which is also the honest one: it is the
// printing whose artwork the tags describe.
async function heroCard(printing = null) {
  const wanted = printing ? [printing] : CANDIDATES;
  for (const candidate of wanted) {
    const tags = await taggerEdges(candidate);
    if (!tags || tags.cardTags.length < 2) continue;

    // The card itself, from Scryfall. Tagger's answer carries an identifier of its own
    // that the card endpoint does not know, so the id comes from Scryfall, where it is
    // a real, resolvable reference.
    const card = await cachedGet('https://api.scryfall.com/cards/named?exact=' +
      encodeURIComponent(candidate.name));
    if (!card || !card.oracle_id) continue;

    const list = await allPrintings(card.oracle_id);
    if (list.length < 4) continue;

    const legalities = card.legalities || {};
    const extra = EXTRA_FORMATS.filter(format => legalities[format]);
    if (!extra.length) continue;

    return Object.assign(tags, {
      name: card.name,
      oracleId: card.oracle_id,
      legalities,
      extraFormats: extra,
      prints: list.map(printing => ({
        id: printing.id,
        name: printing.name,
        // scryfall_uri, and not the object's own `uri`: the worker's row for a
        // printing carries the page address, and that is the address the table compares
        // a printing Scryfall already listed against. An API address here matches no row
        // on the page, so every printing Scryfall had already drawn is added a second
        // time — ten duplicated rows in one group, in a picture of a defect the
        // extension does not have.
        uri: printing.scryfall_uri,
        set: printing.set,
        setName: printing.set_name,
        number: printing.collector_number,
        lang: printing.lang,
        digital: printing.digital,
        finishes: printing.finishes || [],
        promoTypes: printing.promo_types || [],
        typeLine: printing.type_line || '',
        prices: printing.prices || {}
      }))
    });
  }
  throw new Error('no candidate card came back with tags, so there is nothing real to show');
}

// Three real cards for the clipboard. They cannot come from the hero's own
// printings: those are one card under 139 different names of sets, so a clipboard
// built from them would show the same name three times. These are three different
// real cards, each looked up by name, so every line is one Scryfall answered.
const CLIPBOARD_NAMES = ['Sol Ring', 'Counterspell', 'Lightning Bolt'];

async function clipboardCards(count = 3) {
  const cards = [];
  for (const name of CLIPBOARD_NAMES) {
    if (cards.length === count) break;
    const card = await cachedGet('https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(name));
    // A name that no longer exists is skipped rather than shown as one: the picture
    // must hold real cards or fail, not hold a plausible-looking line.
    if (!card || !card.set || card.object !== 'card') continue;
    cards.push({
      name: card.name,
      set: card.set,
      number: card.collector_number,
      uri: card.scryfall_uri,
      finishes: card.finishes || []
    });
  }
  if (cards.length < count) {
    throw new Error('only ' + cards.length + ' of ' + count + ' clipboard cards came back real');
  }
  return cards;
}

// Which sets the extension classifies as digital, oversized, non-tournament or
// foreign-black-border, so the "hide the extra" picture removes what it would
// really remove.
//
// The classification is not Scryfall's to ask for: the category endpoints answer
// 404 now. It is the worker's own reading of /sets — a name pattern for the
// oversized and black-border sets, a code list for the non-tournament ones, and
// Scryfall's own `digital` flag. The rules below are copied from
// src/background/worker.js on purpose: a second, slightly different copy here would
// quietly show a picture of a filter that does not exist.
async function setCategories() {
  const data = await cachedGet('https://api.scryfall.com/sets');
  if (!Array.isArray(data.data)) throw new Error('the list of sets came back without one');
  const categories = { digital: [], nonTournament: [], oversized: [], foreignBlackBorder: [] };
  for (const set of data.data) {
    if (!/^[a-z0-9_-]+$/i.test(set.code || '')) continue;
    const code = set.code.toLowerCase();
    const oversized = /oversiz/i.test(set.name || '') || /^o(?:cmd|cd|pr|pd)/i.test(code);
    if (set.digital === true) categories.digital.push(code);
    if (/foreign black border/i.test(set.name || '')) categories.foreignBlackBorder.push(code);
    if (oversized) categories.oversized.push(code);
    else if (['memorabilia', 'minigame', 'vanguard', 'token'].includes(set.set_type) ||
      /^(?:30a|cei|ced|wc97|wc98|wc99|wc0[0-4])$/.test(code)) categories.nonTournament.push(code);
  }
  for (const flag of Object.keys(categories)) {
    if (!categories[flag].length) {
      throw new Error('not one set came out as ' + flag +
        ', so the classification in the picture would be an empty claim');
    }
  }
  return categories;
}

module.exports = { heroCard, clipboardCards, setCategories, taggerEdges, taggerEdgesByOracle,
  allPrintings, cachedGet };