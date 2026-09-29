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
// entries and counting them. These are the parts that touch nothing but the deck
// data, so they are here rather than in the page-context script that has to talk
// to Scryfall's internals.
//
// Logic follows Shambleshark's modify-clean-up (MIT,
// https://github.com/crookedneighbor/shambleshark). Rewritten for this project:
// plain JavaScript instead of TypeScript, and no message bus around pure
// functions.

// The order a deck reads in when it is sorted by card type. Anything not listed
// sorts last.
const TYPE_ORDER = ['creature', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery', 'land'];

// The primary type of a card, taken from its type line. "Legendary Creature —
// Human Avatar Ally" is a creature.
function getPrimaryType(entry) {
  const line = entry && entry.card_digest && entry.card_digest.type_line;
  if (!line) return '';
  const found = TYPE_ORDER.find(type => new RegExp('\\b' + type + '\\b', 'i').test(line));
  return found || '';
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

// A deck keeps lands apart when it has a section for them. These two decide
// which side a card belongs on, which is what the cleanup has to correct.
function isLandCard(entry) {
  return getPrimaryType(entry) === 'land';
}

function hasDedicatedLandSection(deck) {
  return Boolean(deck && deck.sections && deck.sections.some(section => section === 'lands'));
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
  hasDedicatedLandSection
};
