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

// The clean up improver runs against window.Scryfall and window.ScryfallAPI,
// which are Scryfall's application internals. They cannot be reached from a
// test, so this stands in for them. That is also why the module is written to
// fail soft: what is being tested here is that it works when the internals are
// as Shambleshark found them, and that it does nothing at all when they are not.

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { assert, assertEqual, summary, ROOT } = require('./testlib.cjs');

function tick(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// A stand-in for a Scryfall deck editor page.
function makeWorld({ withScryfall = true, html = '', deck = null, opts = {} } = {}) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  const calls = { updateEntry: [], get: 0, cleanUp: 0, forceUpdate: 0 };
  const target = deck || {
    id: 'deck-1',
    sections: { primary: ['commanders', 'nonlands'], secondary: ['lands', 'maybeboard'] },
    entries: {
      commanders: [],
      nonlands: [
        { id: 'e1', count: 1, section: 'nonlands', card_digest: { name: 'Forest', type_line: 'Basic Land — Forest' } },
        { id: 'e2', count: 1, section: 'nonlands', card_digest: { name: 'Grizzly Bears', type_line: 'Creature — Bear' } }
      ],
      lands: [
        { id: 'e3', count: 1, section: 'lands', card_digest: { name: 'Lightning Bolt', type_line: 'Instant' } }
      ],
      maybeboard: []
    }
  };

  const self = {
    location: { pathname: '/decks/deck-1/build' },
    listeners: [],
    posted: [],
    addEventListener(type, fn) { if (type === 'message') this.listeners.push(fn); },
    postMessage(data) { this.posted.push(data); },
    setTimeout,
    console
  };

  if (withScryfall) {
    self.ScryfallAPI = {
      grantSecret: 'secret',
      decks: {
        active(cb) { cb({ id: target.id }); },
        get(id, cb) { calls.get++; cb(target); },
        updateEntry(id, card, cb) { calls.updateEntry.push({ id, card }); cb(card); },
        addCard() {}, replaceEntry() {}, createEntry() {}, destroyEntry() {}
      }
    };
    self.Scryfall = {
      pushNotification() {},
      deckbuilder: {
        deckId: target.id,
        cleanUp() { calls.cleanUp++; },
        entries: target.entries,
        flatSections: ['commanders', 'nonlands', 'lands', 'maybeboard'],
        totalCount: () => Object.values(target.entries).reduce((n, list) => n + list.length, 0),
        $forceUpdate() { calls.forceUpdate++; },
        $nextTick(fn) { fn(); }
      }
    };
    if (opts.entriesSetter === false) {
      // A future Scryfall could make entries a computed property instead of a
      // plain one; the hook must then give up quietly.
      const db = self.Scryfall.deckbuilder;
      const backing = db.entries;
      delete db.entries;
      Object.defineProperty(db, 'entries', {
        configurable: true,
        get() { return backing; }
      });
    }
  }

  const context = vm.createContext(Object.assign(self, {
    self, document, window: self, Promise, Object, Array, String, Boolean, Number, Math, JSON, RegExp, Error
  }));
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }
  );
  // Dispatching to the page side means handing over the identity that side sees
  // as its own window. Across a vm boundary that is not the same object as the
  // one this file holds; in a real page both are the window.
  const fromPage = data => {
    const identity = vm.runInContext('self', context);
    self.listeners.slice().forEach(fn => fn({ source: identity, data }));
  };
  return { self, document, calls, target, run, context, fromPage };
}

const card = (name, typeLine, id) => ({
  id: id || name.toLowerCase().replace(/\W+/g, '-'),
  count: 1, section: 'nonlands', card_digest: { name, type_line: typeLine }
});

(async () => {
  try {
    console.log('deck-clean-up: with nothing switched on it does nothing');
    {
      const w = makeWorld();
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: false, sortEntriesPrimary: 'none' });
      assertEqual(result.applied, false, 'nothing is wired');
      assertEqual(w.calls.cleanUp, 0, 'the clean up button is left alone');
      assertEqual(w.self.Scryfall.deckbuilder.cleanUp.__stkWrapped, undefined,
        'and no hooks are left behind');
    }

    console.log('deck-clean-up: without Scryfall it fails soft');
    {
      const w = makeWorld({ withScryfall: false });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true });
      assertEqual(result.applied, false, 'it reports that it did nothing');
      assert(result.problems.length > 0, 'and says why');
      const status = w.self.STK_DECK_CLEANUP.status();
      assertEqual(status.hasScryfall, false, 'the status says Scryfall is missing');
    }

    console.log('deck-clean-up: lands in the wrong column are put back');
    {
      const w = makeWorld();
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true, sortEntriesPrimary: 'none' });
      w.self.Scryfall.deckbuilder.cleanUp();
      await tick();
      assertEqual(w.calls.cleanUp, 1, 'the original clean up still ran');
      assertEqual(w.calls.updateEntry.length, 2, 'both misplaced cards were sent back');
      const moved = w.calls.updateEntry.map(c => [c.card.card_digest.name, c.card.section]).sort();
      assertEqual(moved, [['Forest', 'lands'], ['Lightning Bolt', 'nonlands']],
        'the forest went to lands and the bolt to nonlands');
    }

    console.log('deck-clean-up: a deck with no land section is left alone');
    {
      const w = makeWorld({ deck: {
        id: 'deck-2',
        sections: { primary: ['nonlands'], secondary: [] },
        entries: {
          nonlands: [card('Forest', 'Basic Land — Forest'), card('Bolt', 'Instant')]
        }
      } });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true, sortEntriesPrimary: 'none' });
      w.self.Scryfall.deckbuilder.cleanUp();
      await tick();
      assertEqual(w.calls.updateEntry.length, 0,
        'a deck with one column has nothing to move between');
    }

    console.log('deck-clean-up: sorting reorders every section');
    {
      const w = makeWorld({ deck: {
        id: 'deck-3',
        sections: { primary: ['nonlands'], secondary: [] },
        entries: {
          nonlands: [
            card('Zz', 'Land — Plains'), card('Aa', 'Creature — Bear'),
            card('Mm', 'Instant'), card('Bb', 'Sorcery')
          ]
        }
      } });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: false, sortEntriesPrimary: 'name' });
      // Sorting runs when Scryfall reports the entries changed.
      w.self.Scryfall.deckbuilder.entries = w.self.Scryfall.deckbuilder.entries;
      const names = w.target.entries.nonlands.map(c => c.card_digest.name);
      assertEqual(names, ['Aa', 'Bb', 'Mm', 'Zz'], 'by name');
      assertEqual(w.calls.forceUpdate, 1, 'and Scryfall was asked to redraw');
    }

    console.log('deck-clean-up: sorting by card type reads the way a deck does');
    {
      const w = makeWorld({ deck: {
        id: 'deck-4',
        sections: { primary: ['nonlands'], secondary: [] },
        entries: {
          nonlands: [
            card('Zz', 'Land — Plains'), card('Aa', 'Creature — Bear'),
            card('Mm', 'Instant'), card('Cc', 'Legendary Planeswalker'),
            card('Dd', 'Artifact — Equipment'), card('Ee', 'Enchantment'),
            card('Ff', 'Sorcery')
          ]
        }
      } });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: false, sortEntriesPrimary: 'card-type' });
      w.self.Scryfall.deckbuilder.entries = w.self.Scryfall.deckbuilder.entries;
      assertEqual(w.target.entries.nonlands.map(c => c.card_digest.name),
        ['Aa', 'Cc', 'Dd', 'Ee', 'Mm', 'Ff', 'Zz'],
        'creature, planeswalker, artifact, enchantment, instant, sorcery, land');
    }

    console.log('deck-clean-up: headings are inserted and then removed');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-5',
          sections: { primary: ['nonlands'], secondary: [] },
          entries: {
            nonlands: [
              card('Aetherling', 'Creature — Shapeshifter', 'e1'),
              card('Bident', 'Enchantment', 'e2'),
              card('Zz', 'Land — Plains', 'e3')
            ]
          }
        },
        html: `
          <div class="deckbuilder-section">
            <h6 class="deckbuilder-section-title-bar"><span class="deckbuilder-section-title">nonlands</span></h6>
            <ul>
              <li data-entry="e1"></li>
              <li data-entry="e2"></li>
              <li data-entry="e3"></li>
            </ul>
          </div>`
      });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({
        cleanUpLandsInSingleton: false, sortEntriesPrimary: 'card-type', insertSortingHeadings: true
      });
      w.self.Scryfall.deckbuilder.entries = w.self.Scryfall.deckbuilder.entries;

      const headings = w.document.querySelectorAll('.cleanup-improver__deck-section-heading');
      assertEqual(headings.length, 3, 'one heading per type present');
      assertEqual([...headings].map(h => h.getAttribute('data-heading-section-id')),
        ['creature', 'enchantment', 'land'], 'in the order a deck reads in');
      assertEqual(w.document.querySelector('[data-heading-section-id="creature"] .modify-cleanup-subtotal-count').textContent,
        '1', 'each heading counts what is under it');
      assertEqual(w.document.querySelector('.modify-cleanup-total-count').textContent,
        '3', 'and the total is shown');
      assertEqual(
        [...w.document.querySelector('ul').children].map(el =>
          el.hasAttribute('data-entry')
            ? 'card:' + el.getAttribute('data-entry')
            : 'heading:' + el.getAttribute('data-heading-section-id')),
        ['heading:creature', 'card:e1', 'heading:enchantment', 'card:e2', 'heading:land', 'card:e3'],
        'each heading sits directly above the first card of its group');

      // Scryfall's own section title is hidden while ours are in place.
      const original = w.document.querySelector('h6.deckbuilder-section-title-bar');
      assert(original.classList.contains('is-hidden'), 'the stock section title steps aside');

      // And a second pass replaces rather than stacks them.
      w.self.Scryfall.deckbuilder.entries = w.self.Scryfall.deckbuilder.entries;
      assertEqual(w.document.querySelectorAll('.cleanup-improver__deck-section-heading').length, 3,
        'running again leaves three headings, not six');
    }

    console.log('deck-clean-up: totals track the deck count');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-6',
          sections: { primary: ['nonlands'], secondary: [] },
          entries: { nonlands: [card('Aetherling', 'Creature — Shapeshifter', 'e1')] }
        },
        html: `
          <div class="deckbuilder-section">
            <h6 class="deckbuilder-section-title-bar"></h6>
            <ul><li data-entry="e1"></li></ul>
          </div>`
      });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.self.STK_DECK_CLEANUP.apply({
        cleanUpLandsInSingleton: false, sortEntriesPrimary: 'card-type', insertSortingHeadings: true
      });
      w.self.Scryfall.deckbuilder.entries = w.self.Scryfall.deckbuilder.entries;
      assertEqual(w.document.querySelector('.modify-cleanup-total-count').textContent, '1', 'starts at one card');
      // The wrapped totalCount reports a change the next time it is read.
      w.target.entries.nonlands.push(card('Bident', 'Enchantment', 'e2'));
      assertEqual(w.self.Scryfall.deckbuilder.totalCount(), 2, 'the total moved to two');
      assertEqual(w.document.querySelector('.modify-cleanup-total-count').textContent, '2',
        'and the heading followed');
    }

    console.log('deck-clean-up: the bridge passes settings across the window');
    {
      const w = makeWorld();
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      w.run('page.js');
      assertEqual(w.self.posted.length, 1, 'the page side announces itself');
      assertEqual(w.self.posted[0].type, 'ready', 'with a ready message');
      assertEqual(w.self.posted[0].source, 'page', 'marked as coming from the page');

      // What the content script would send.
      w.fromPage({
        channel: 'scryfall-toolkit', version: 1, source: 'content', type: 'settings',
        value: { cleanUpLandsInSingleton: true, sortEntriesPrimary: 'none', insertSortingHeadings: false }
      });
      await tick();
      assertEqual(w.self.posted.length, 2, 'and answers with a status');
      assertEqual(w.self.posted[1].type, 'status', 'the answer is a status report');
      assertEqual(w.self.posted[1].value.applied, true, 'saying the feature is wired');

      // A message from anywhere else is ignored.
      const before = w.self.posted.length;
      w.self.listeners.forEach(fn => fn({ source: {}, data: { channel: 'scryfall-toolkit', version: 1, source: 'content', type: 'settings', value: {} } }));
      w.fromPage({ channel: 'other', source: 'content', type: 'settings', value: {} });
      w.fromPage({ channel: 'scryfall-toolkit', version: 2, source: 'content', type: 'settings', value: {} });
      w.fromPage({ channel: 'scryfall-toolkit', version: 1, source: 'not-the-content-script', type: 'settings', value: {} });
      assertEqual(w.self.posted.length, before,
        'messages from another window, another channel, another version or another sender are ignored');
    }

    console.log('deck-clean-up: a future Scryfall with no entries setter does not break');
    {
      const w = makeWorld({ opts: { entriesSetter: false } });
      w.run('deck-tools.js');
      w.run('deck-clean-up.js');
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true, sortEntriesPrimary: 'name' });
      assertEqual(result.applied, true, 'the clean up button is still wrapped');
      w.self.Scryfall.deckbuilder.cleanUp();
      await tick();
      assertEqual(w.calls.cleanUp, 1, 'and clean up still works');
    }

    summary('test-deck-clean-up');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
