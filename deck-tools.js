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

// The deck tools Shambleshark's cleanup module is built from: sorting a deck's
// entries, counting them, and deciding which side of a land section a card
// belongs on. These are the parts that touch nothing but the deck data, so they
// are here rather than in the page-context script that has to talk to
// Scryfall's internals.
//
// Logic follows Shambleshark's modify-clean-up and lib/card-parser (MIT,
// https://github.com/crookedneighbor/shambleshark). Rewritten for this project:
// plain JavaScript instead of TypeScript, and no message bus around pure
// functions. The behaviour is kept as upstream has it, including where upstream
// is quirky — the notes below say so where it matters.

// The order a deck reads in when it is sorted by card type. Anything not listed
// sorts last.
const TYPE_ORDER = [
  'creature', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery', 'land'
];

// Which type of a mixed type line counts as the card's main one. This is a
// different order from TYPE_ORDER on purpose: TYPE_ORDER is how a sorted deck
// reads, this is which type wins when a card is several. A Dryad Arbor is a
// creature that happens to be a land, not the other way round.
const PRIMARY_TYPE_PREFERENCE = [
  'creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery'
];

// The primary type of a card. Upstream takes the part of the type line before
// the first "//" (a split card's front face) and before the first " - ", then
// looks for each preferred type in it as a substring. Scryfall writes its
// type lines with an em dash, so that second split usually does nothing; the
// substring search is what does the work, and "Basic Land — Island" lands on
// "land" through it. Anything matching no known type is returned as it stands.
function getPrimaryType(entry) {
  if (!entry || !entry.card_digest) return '';
  const line = String(entry.card_digest.type_line || '')
    .toLowerCase()
    .split(' // ')[0]
    .split(' - ')[0]
    .trim();
  return PRIMARY_TYPE_PREFERENCE.find(type => line.indexOf(type) > -1) || line;
}

function sortByCardDigest(compare) {
  return (first, second) => {
    // A row without a digest sorts to the end rather than throwing.
    if (!first.card_digest) return 1;
    if (!second.card_digest) return -1;
    return compare(first, second);
  };
}

function sortByName() {
  return sortByCardDigest((first, second) => {
    const a = first.card_digest.name;
    const b = second.card_digest.name;
    return a > b ? 1 : a < b ? -1 : 0;
  });
}

function sortByPrimaryCardType() {
  return sortByCardDigest((first, second) => {
    const a = TYPE_ORDER.indexOf(getPrimaryType(first));
    const b = TYPE_ORDER.indexOf(getPrimaryType(second));
    return a > b ? 1 : a < b ? -1 : 0;
  });
}

// Which alphabet block a name falls into, so a sorted deck can be given headings.
function getNameSection(name) {
  const first = String(name || '').charAt(0).toLowerCase();
  if (/[a-d]/.test(first)) return 'abcd';
  if (/[e-g]/.test(first)) return 'efg';
  if (/[h-k]/.test(first)) return 'hijk';
  if (/[l-p]/.test(first)) return 'lmnop';
  if (/[q-s]/.test(first)) return 'qrs';
  if (/[t-v]/.test(first)) return 'tuv';
  if (/[w-x]/.test(first)) return 'wx';
  if (/[y-z]/.test(first)) return 'yz';
  if (/[0-9]/.test(first)) return '1234567890';
  return 'symbols';
}

function calculateTotalsByName(entries) {
  return (entries || []).reduce((totals, entry) => {
    if (!entry.card_digest) return totals;
    const group = getNameSection(entry.card_digest.name);
    totals[group] = (totals[group] || 0) + 1;
    return totals;
  }, {});
}

function calculateTotalsByCardType(entries) {
  return (entries || []).reduce((totals, entry) => {
    if (!entry.card_digest) return totals;
    const type = getPrimaryType(entry);
    totals[type] = (totals[type] || 0) + 1;
    return totals;
  }, {});
}

// Whether the cleanup should treat this card as a land. Upstream decides on the
// front face's type line alone: it has to say Land and must not say Creature.
// So an Artifact Land is a land, and a Land Creature is not.
function isLandCard(entry) {
  const front = entry && entry.card_digest && entry.card_digest.type_line
    ? entry.card_digest.type_line.split('//')[0].trim()
    : '';
  return Boolean(front && front.includes('Land') && !front.includes('Creature'));
}

// A deck's sections come in two groups; upstream flattens both. The shape of
// deck.sections is Scryfall's, not this project's.
function getSections(deck) {
  const sections = (deck && deck.sections) || {};
  return [...(sections.primary || []), ...(sections.secondary || [])];
}

// A deck keeps lands apart when it has a section for them.
function hasDedicatedLandSection(deck) {
  return getSections(deck).includes('lands');
}

// Every entry in the sections that matter, with duplicates merged by whichever
// id is asked for. Shambleshark uses this to look a card up by its entry id;
// merging is what keeps a card that appears twice from being counted twice.
function flattenEntries(deck, options) {
  const opts = options || {};
  const ignored = opts.ignoredSections || {};
  const grouped = {};
  getSections(deck)
    .filter(section => !(section in ignored))
    .map(section => (deck.entries || {})[section] || [])
    .reduce((all, list) => all.concat(list), [])
    .forEach(entry => {
      let id = '';
      if ((opts.idToGroupBy || 'id') === 'oracleId') {
        id = (entry.card_digest && entry.card_digest.oracle_id) || '';
      } else {
        id = (entry.raw_text && entry.id) || '';
      }
      if (!id) return;
      if (grouped[id]) grouped[id].count += entry.count;
      else grouped[id] = entry;
    });
  return Object.keys(grouped).map(id => grouped[id]);
}

self.STK_DECK_TOOLS = {
  TYPE_ORDER,
  getPrimaryType,
  sortByName,
  sortByPrimaryCardType,
  getNameSection,
  calculateTotalsByName,
  calculateTotalsByCardType,
  isLandCard,
  getSections,
  hasDedicatedLandSection,
  flattenEntries
};
