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

// The deck tools ported from Shambleshark's cleanup module. These are the parts
// that touch nothing but deck data, so they are tested directly: the rest of that
// module lives in Scryfall's own page context and cannot be reached this way.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { assert, assertEqual, summary, ROOT } = require('./testlib.cjs');

const context = vm.createContext({ self: {} });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/deck-page/tools.js'), 'utf8'), context, { filename: 'src/deck-page/tools.js' });
const tools = context.self.STK_DECK_TOOLS;

const card = (name, typeLine) => ({ card_digest: { name, type_line: typeLine } });

(async () => {
  try {
    console.log('deck-tools: the module exposes what the cleanup needs');
    for (const name of ['sortByName', 'sortByPrimaryCardType', 'calculateTotalsByName',
      'calculateTotalsByCardType', 'getPrimaryType', 'getNameSection', 'isLandCard',
      'getSections', 'hasDedicatedLandSection']) {
      assert(typeof tools[name] === 'function', `${name} is exported`);
    }

    console.log('deck-tools: sorting by name');
    const byName = [card('Zz', 'Creature'), card('Aa', 'Instant'), card('Mm', 'Sorcery')].sort(tools.sortByName());
    assertEqual(byName.map(c => c.card_digest.name), ['Aa', 'Mm', 'Zz'], 'entries come out in name order');
    assertEqual([card('Aa', 'Creature'), { count: 1 }].sort(tools.sortByName()).map(c => c.card_digest ? 'real' : 'blank'),
      ['real', 'blank'], 'a row without a digest sorts to the end');

    console.log('deck-tools: sorting by card type');
    const byType = [
      card('Z Land', 'Land'),
      card('A Creature', 'Legendary Creature — Human'),
      card('B Instant', 'Instant'),
      card('C Walker', 'Legendary Planeswalker'),
      card('D Artifact', 'Artifact — Equipment'),
      card('E Ench', 'Enchantment'),
      card('F Sorc', 'Sorcery')
    ].sort(tools.sortByPrimaryCardType());
    assertEqual(byType.map(c => tools.getPrimaryType(c)),
      ['creature', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery', 'land'],
      'the order a deck reads in');
    console.log('deck-tools: which type counts as the main one');
    assertEqual(tools.getPrimaryType(card('X', 'Legendary Creature — Human Avatar Ally')), 'creature',
      'the primary type comes from the type line');
    assertEqual(tools.getPrimaryType(card('Dryad Arbor', 'Land Creature — Dryad')), 'creature',
      'a Land Creature is a creature first');
    assertEqual(tools.getPrimaryType(card('Darksteel Citadel', 'Artifact Land')), 'land',
      'but an Artifact Land is a land');
    assertEqual(tools.getPrimaryType(card('Kithkin', 'Kindred — Kithkin')), 'kindred — kithkin',
      'a type outside the known list is handed back as it stands');
    assertEqual(tools.getPrimaryType({ count: 1 }), '',
      'and a row with no digest has no primary type');

    console.log('deck-tools: the alphabet blocks a name falls into');
    assertEqual(tools.getNameSection('Aether'), 'abcd', 'a-d is one block');
    assertEqual(tools.getNameSection('Sol Ring'), 'qrs', 'q-s is one block');
    assertEqual(tools.getNameSection('1/1 Token'), '1234567890', 'digits are their own block');
    assertEqual(tools.getNameSection('Æther'), 'symbols', 'anything else is symbols');

    console.log('deck-tools: totals');
    const entries = [
      card('Aether', 'Instant'), card('Bident', 'Enchantment'), card('Zz', 'Land'),
      card('Sol', 'Land'), card('Qasali', 'Creature'), { count: 1 }
    ];
    assertEqual(tools.calculateTotalsByName(entries), { abcd: 2, yz: 1, qrs: 2 },
      'entries are counted by alphabet block');
    assertEqual(tools.calculateTotalsByCardType(entries), { instant: 1, enchantment: 1, land: 2, creature: 1 },
      'and by primary type');

    console.log('deck-tools: land sections');
    assert(tools.isLandCard(card('Forest', 'Basic Land — Forest')), 'a land is a land');
    assert(tools.isLandCard(card('Darksteel Citadel', 'Artifact Land')), 'an Artifact Land is a land');
    assert(!tools.isLandCard(card('Bolt', 'Instant')), 'and an instant is not');
    assert(!tools.isLandCard(card('Dryad Arbor', 'Land Creature — Dryad')),
      'a Land Creature is not — upstream puts it in the nonland column');
    assertEqual(tools.isLandCard(card('Fire // Ice', 'Instant // Instant')), false,
      'only the front face of a split card is looked at');
    assertEqual(tools.getSections({ sections: { primary: ['commanders', 'nonlands'], secondary: ['lands', 'maybeboard'] } }),
      ['commanders', 'nonlands', 'lands', 'maybeboard'], 'both groups of sections are flattened');
    assertEqual(tools.hasDedicatedLandSection({ sections: { primary: ['nonlands'], secondary: ['lands'] } }), true,
      'a deck with a lands section keeps them apart');
    assertEqual(tools.hasDedicatedLandSection({ sections: { primary: ['nonlands'], secondary: [] } }), false,
      'and one without does not');

    summary('test-deck-tools');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
