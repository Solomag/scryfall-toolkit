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
    self, document, window: self, Event: window.Event, CustomEvent: window.CustomEvent,
    Promise, Object, Array, String, Boolean, Number, Math, JSON, RegExp, Error
  }));
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }
  );
  // The deck modules load in a fixed order: pure deck data first, then the one
  // file that touches Scryfall, then the features on top of it, then the bridge.
  const boot = () => {
    for (const file of ['deck-tools.js', 'deck-scryfall.js', 'deck-results.js', 'deck-clean-up.js', 'deck-edhrec.js', 'deck-search.js']) run(file);
  };
  // Dispatching to the page side means handing over the identity that side sees
  // as its own window. Across a vm boundary that is not the same object as the
  // one this file holds; in a real page both are the window.
  const fromPage = data => {
    const identity = vm.runInContext('self', context);
    self.listeners.slice().forEach(fn => fn({ source: identity, data }));
  };
  return { self, document, calls, target, run, boot, context, fromPage };
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
      w.boot();
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: false, sortEntriesPrimary: 'none' });
      assertEqual(result.applied, false, 'nothing is wired');
      assertEqual(w.calls.cleanUp, 0, 'the clean up button is left alone');
      assertEqual(w.self.Scryfall.deckbuilder.totalCount.__stkWrapped, undefined,
        'no hook is installed on Scryfall while everything is off');
      const descriptor = Object.getOwnPropertyDescriptor(w.self.Scryfall.deckbuilder, 'entries');
      assert(!descriptor || !descriptor.get, 'and the entries property is not touched either');
    }

    console.log('deck-clean-up: without Scryfall it fails soft');
    {
      const w = makeWorld({ withScryfall: false });
      w.boot();
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true });
      assertEqual(result.applied, false, 'it reports that it did nothing');
      assert(result.problems.length > 0, 'and says why');
      const status = w.self.STK_DECK_SCRYFALL.status();
      assertEqual(status.hasScryfall, false, 'the status says Scryfall is missing');
    }

    console.log('deck-clean-up: lands in the wrong column are put back');
    {
      const w = makeWorld();
      w.boot();
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
      w.boot();
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
      w.boot();
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
      w.boot();
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
      w.boot();
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
      w.boot();
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
      w.boot();
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
      assertEqual(w.self.posted[1].value.cleanUp, true, 'saying the clean up is wired');

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
      w.boot();
      const result = w.self.STK_DECK_CLEANUP.apply({ cleanUpLandsInSingleton: true, sortEntriesPrimary: 'name' });
      assertEqual(result.applied, true, 'the clean up button is still wrapped');
      w.self.Scryfall.deckbuilder.cleanUp();
      await tick();
      assertEqual(w.calls.cleanUp, 1, 'and clean up still works');
    }

    console.log('deck-edhrec: a commander deck gets an EDHREC button and real suggestions');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-8',
          sections: { primary: ['commanders', 'nonlands'], secondary: [] },
          entries: {
            commanders: [{ id: 'c1', count: 1, section: 'commanders', raw_text: true,
              card_digest: { name: 'Atraxa, Praetors Voice', type_line: 'Legendary Creature — Phyrexian Angel' } }],
            nonlands: []
          }
        },
        html: `
          <div class="deckbuilder-toolbar"><div class="deckbuilder-toolbar-items-right"></div></div>
          <div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Commanders</h6></div>
          <div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Column A</h6></div>
          <div id="deckbuilder"></div>`
      });
      w.boot();
      const asked = [];
      w.self.STK_BRIDGE = {
        request: (name, value) => {
          asked.push({ name, value });
          if (name === 'cardImages') return Promise.resolve({ ok: true, data: [] });
          if (name === 'cardBySet') return Promise.resolve({ id: 'scry-' + value.set + '-' + value.number });
          // What EDHREC makes of this deck: a name, a type, art, and how much
          // of the recommendation it is.
          return Promise.resolve({ ok: true, data: {
            inRecs: [
              { primary_type: 'Creature', names: ['Evolution Sage'], score: 0.9,
                scryfall_uri: 'https://scryfall.com/card/one/123/evolution-sage',
                image: 'https://cards.scryfall.io/normal/front/1/1/aaa.jpg' },
              { primary_type: 'Creature', names: ['Tekuthal'], score: 0,
                scryfall_uri: 'https://scryfall.com/card/two/45/tekuthal',
                image: 'https://cards.scryfall.io/normal/front/2/2/bbb.jpg' },
              { primary_type: 'Instant', names: ['Cankerbloom'], score: 0.25,
                scryfall_uri: 'https://scryfall.com/card/three/6/cankerbloom',
                image: 'https://cards.scryfall.io/normal/front/3/3/ccc.jpg' }
            ]
          } });
        }
      };

      const result = w.self.STK_DECK_EDHREC.apply({ edhrecSuggestions: true });
      assertEqual(result.applied, true, 'the feature is wired');
      const button = w.document.getElementById('stk-edhrec-button');
      assert(button, 'a commander deck gets the button');
      assertEqual(button.parentNode.className, 'deckbuilder-toolbar-items-right',
        'in the toolbar where the other deck buttons are');

      button.dispatchEvent(new w.self.Event('click'));
      await tick();
      const commanderAsks = asked.filter(a => a.name === 'edhrecRecs');
      assertEqual(commanderAsks.length, 1, 'clicking asks EDHREC what it makes of this deck');
      assertEqual(commanderAsks[0].value.commanders, ['Atraxa, Praetors Voice'], 'naming the commander');
      assertEqual(commanderAsks[0].value.cards.length, 0, 'and the cards in it');

      // Images is the default; the names and scores are on the list side.
      const views = [...w.document.querySelectorAll('.stk-results-view')];
      assertEqual(views.map(v => v.textContent), ['Images', 'List'], 'the reader picks how results are shown');
      views[1].dispatchEvent(new w.self.Event('click'));

      const titles = [...w.document.querySelectorAll('.stk-results-group-title')].map(t => t.textContent);
      assertEqual(titles, ['Creatures', 'Instants'], 'EDHREC\'s own grouping is kept');
      assertEqual([...w.document.querySelectorAll('.stk-results-row-name')].map(n => n.textContent),
        ['Evolution Sage', 'Tekuthal', 'Cankerbloom'], 'with its cards in its order');
      assertEqual([...w.document.querySelectorAll('.stk-results-row-meta')].map(n => n.textContent),
        ['90%', '0%', '25%'], 'and how strongly EDHREC recommends each for this deck');

      const added = [];
      const removed = [];
      w.self.ScryfallAPI.decks.addCard = (id, cardId, cb) => { added.push(cardId); cb({ id: 'entry-' + cardId }); };
      w.self.ScryfallAPI.decks.destroyEntry = (id, entryId, cb) => { removed.push(entryId); cb({ id: entryId }); };
      const buttons = w.document.querySelectorAll('.stk-results-add');
      buttons[0].dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(added, ['scry-one-123'], 'a suggestion names a printing, which is resolved before it is added');
      assertEqual(buttons[0].textContent, 'Remove',
        'and the button turns into the way to take it back');
      buttons[0].dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(removed, ['entry-scry-one-123'], 'so a card added by mistake goes again');
      assertEqual(buttons[0].textContent, 'Add', 'and the button returns to Add');

      w.document.querySelector('.modal-dialog-close').dispatchEvent(new w.self.Event('click'));
      assertEqual(w.document.querySelector('.stk-edhrec-panel'), null, 'and the panel closes');
    }

    console.log('deck-results: the reader can narrow a long list');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-8d',
          sections: { primary: ['commanders', 'nonlands'], secondary: [] },
          entries: {
            commanders: [{ id: 'c1', count: 1, section: 'commanders', raw_text: true,
              card_digest: { name: 'Atraxa, Praetors Voice', type_line: 'Legendary Creature — Phyrexian Angel' } }],
            nonlands: []
          }
        },
        html: `
          <div class="deckbuilder-toolbar"><div class="deckbuilder-toolbar-items-right"></div></div>
          <div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Commanders</h6></div>
          <div id="deckbuilder"></div>`
      });
      w.boot();
      w.self.STK_BRIDGE = {
        request: name => name === 'edhrecCommander'
          ? Promise.resolve([{ header: 'Creatures', cards: [
              { id: 'a1', name: 'Evolution Sage', numDecks: 9, potentialDecks: 10 },
              { id: 'a2', name: 'Cankerbloom', numDecks: 5, potentialDecks: 10 }
            ] }])
          : Promise.resolve([])
      };
      w.self.STK_DECK_EDHREC.apply({ edhrecSuggestions: true });
      w.document.getElementById('stk-edhrec-button').dispatchEvent(new w.self.Event('click'));
      await tick();

      const filter = w.document.querySelector('.stk-results-filter');
      assert(filter, 'both panels get a way to narrow what is on screen');
      filter.value = 'sage';
      filter.dispatchEvent(new w.self.Event('input'));
      assertEqual([...w.document.querySelectorAll('.stk-results-name')].map(n => n.textContent),
        ['Evolution Sage'], 'and it leaves only what matches');

      filter.value = 'nothing at all';
      filter.dispatchEvent(new w.self.Event('input'));
      assert(w.document.querySelector('.stk-results-note') !== null,
        'saying so when nothing does, rather than showing an empty box');
    }

    console.log('deck-edhrec: a deck with no commander gets no button');
    {
      const w = makeWorld({
        html: `
          <div class="deckbuilder-toolbar"><div class="deckbuilder-toolbar-items-right"></div></div>
          <div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Column A</h6></div>`
      });
      w.boot();
      w.self.STK_BRIDGE = { request: () => Promise.resolve([]) };
      w.self.STK_DECK_EDHREC.apply({ edhrecSuggestions: true });
      assertEqual(w.document.getElementById('stk-edhrec-button'), null,
        'a deck with no commanders is left alone');
    }

    console.log('deck-search: the deck editor can search Scryfall and add what it finds');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-8b',
          sections: { primary: ['commanders', 'nonlands'], secondary: [] },
          entries: {
            commanders: [{ id: 'c1', count: 1, section: 'commanders', raw_text: true,
              card_digest: { name: 'Atraxa, Praetors Voice', type_line: 'Legendary Creature — Phyrexian Angel' } }],
            nonlands: []
          }
        },
        html: `
          <div class="deckbuilder-toolbar"><div class="deckbuilder-toolbar-items-right"></div></div>
          <div id="deckbuilder"></div>`
      });
      w.boot();
      const asked = [];
      w.self.STK_BRIDGE = {
        request: (name, value) => {
          asked.push({ name, value });
          if (name === 'cardIdentity') return Promise.resolve({ colorIdentity: 'wub' });
          if (name === 'cardImages') return Promise.resolve([]);
          // What EDHREC knows about these cards for this commander, which is
          // where "share of the commander's decks" comes from.
          if (name === 'edhrecCommander') {
            return Promise.resolve([
              { header: 'Top Cards', cards: [
                { id: 'e1', name: 'Sol Ring', numDecks: 900, potentialDecks: 1000 },
                { id: 'e2', name: 'Swords to Plowshares', numDecks: 250, potentialDecks: 1000 }
              ] }
            ]);
          }
          return Promise.resolve({
            cards: [
              { id: 's1', name: 'Sol Ring', typeLine: 'Artifact', manaCost: '{1}' },
              { id: 's2', name: 'Swords to Plowshares', typeLine: 'Instant', manaCost: '{W}' }
            ],
            hasMore: true
          });
        }
      };
      w.self.STK_DECK_SEARCH.apply({ deckSearch: true, edhrecSuggestions: true });
      const button = w.document.getElementById('stk-search-button');
      assert(button, 'the deck editor gets the button');

      button.dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(w.document.querySelector('.stk-search-input') !== null, true,
        'and it opens a search panel');

      w.document.querySelector('.stk-search-input').value = 't:creature';
      w.document.querySelector('.stk-search-identity').checked = true;
      w.document.querySelector('.stk-search-no-funny').checked = true;
      w.document.querySelector('.stk-search-form').dispatchEvent(new w.self.Event('submit'));
      await tick();

      const searches = asked.filter(a => a.name === 'scryfallSearch');
      assertEqual(searches.length, 1, 'the query goes to the background worker');
      assertEqual(searches[0].value.query, 't:creature id<=wub not:funny',
        'with the two checkboxes turned into Scryfall qualifiers');

      assertEqual([...w.document.querySelectorAll('.stk-results-name')].map(n => n.textContent),
        ['Sol Ring', 'Swords to Plowshares'], 'results come back as a grid of cards');
      assertEqual(w.document.querySelector('.stk-results-filter'), null,
        'the search panel has a query box and does not need a second one');
      assertEqual([...w.document.querySelectorAll('.stk-results-meta')].map(n => n.textContent),
        ['90%', '25%'], 'each carrying what EDHREC knows about it for this commander');
      assertEqual(w.document.querySelector('.stk-results-more') !== null, true,
        'and Scryfall saying there is more gives a way to ask for it');

      const added = [];
      w.self.ScryfallAPI.decks.addCard = (id, cardId, cb) => { added.push(cardId); cb({ id: cardId }); };
      w.document.querySelector('.stk-results-add').dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(added, ['s1'], 'adding a result goes through Scryfall with its own id');

      w.document.querySelector('.modal-dialog-close').dispatchEvent(new w.self.Event('click'));
      assertEqual(w.document.querySelector('.stk-search-panel'), null, 'and the panel closes');
    }

    console.log('deck-search: with no commander known, the colour filter steps aside');
    {
      const w = makeWorld({
        deck: { id: 'deck-9', sections: { primary: ['nonlands'], secondary: [] }, entries: { nonlands: [] } },
        html: '<div class="deckbuilder-toolbar"></div><div id="deckbuilder"></div>'
      });
      w.boot();
      w.self.STK_BRIDGE = { request: () => Promise.resolve({ cards: [], hasMore: false }) };
      w.self.STK_DECK_SEARCH.apply({ deckSearch: true });
      w.document.getElementById('stk-search-button').dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(w.document.querySelector('.stk-search-identity').closest('label').style.display, 'none',
        'the checkbox hides rather than silently doing nothing');
    }

    console.log('deck-edhrec: the button waits for the toolbar instead of giving up on it');
    {
      // A commander section and a toolbar do not arrive together. Whichever
      // comes first has to leave the button for the other to place.
      const w = makeWorld({
        deck: {
          id: 'deck-8c',
          sections: { primary: ['commanders', 'nonlands'], secondary: [] },
          entries: {
            commanders: [{ id: 'c1', count: 1, section: 'commanders', raw_text: true,
              card_digest: { name: 'Atraxa, Praetors Voice', type_line: 'Legendary Creature — Phyrexian Angel' } }],
            nonlands: []
          }
        },
        html: '<div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Commanders</h6></div>'
      });
      w.boot();
      w.self.STK_BRIDGE = { request: () => Promise.resolve([]) };
      w.self.STK_DECK_EDHREC.apply({ edhrecSuggestions: true });
      assertEqual(w.document.getElementById('stk-edhrec-button'), null,
        'with no toolbar yet there is nowhere to put it');

      const host = w.document.createElement('div');
      host.className = 'deckbuilder-toolbar-items-right';
      const toolbar = w.document.createElement('div');
      toolbar.className = 'deckbuilder-toolbar';
      toolbar.appendChild(host);
      w.document.body.appendChild(toolbar);
      w.self.STK_DECK_SCRYFALL.rescanElements();
      assert(w.document.getElementById('stk-edhrec-button'),
        'and the button lands once the toolbar shows up');

      w.self.STK_DECK_SCRYFALL.rescanElements();
      assertEqual(w.document.querySelectorAll('#stk-edhrec-button').length, 1,
        'without a second button appearing on the next sweep');
    }

    console.log('deck-search: a search does not go near EDHREC unless EDHREC is on');
    {
      const w = makeWorld({
        html: '<div class="deckbuilder-toolbar"></div><div id="deckbuilder"></div>'
      });
      w.boot();
      const asked = [];
      w.self.STK_BRIDGE = {
        request: (name, value) => {
          asked.push(name);
          return Promise.resolve({ cards: [{ id: 's1', name: 'Sol Ring' }], hasMore: false });
        }
      };
      w.self.STK_DECK_SEARCH.apply({ deckSearch: true, edhrecSuggestions: false });
      w.document.getElementById('stk-search-button').dispatchEvent(new w.self.Event('click'));
      await tick();
      w.document.querySelector('.stk-search-input').value = 't:artifact';
      w.document.querySelector('.stk-search-form').dispatchEvent(new w.self.Event('submit'));
      await tick();
      assert(!asked.includes('edhrecCommander'),
        'the privacy policy says names go to EDHREC only when that feature is on');
      assertEqual([...w.document.querySelectorAll('.stk-results-meta')].length, 0,
        'and a card without that data simply has no number');
    }

    console.log('deck-edhrec: a card already in the deck is not a suggestion');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-8e',
          sections: { primary: ['commanders', 'nonlands'], secondary: [] },
          entries: {
            commanders: [{ id: 'c1', count: 1, section: 'commanders', raw_text: true,
              card_digest: { name: 'Atraxa, Praetors Voice', type_line: 'Legendary Creature — Phyrexian Angel' } }],
            nonlands: [{ id: 'n1', count: 1, section: 'nonlands', raw_text: true,
              card_digest: { name: 'Evolution Sage', type_line: 'Creature — Human Druid' } }]
          }
        },
        html: `
          <div class="deckbuilder-toolbar"><div class="deckbuilder-toolbar-items-right"></div></div>
          <div class="deckbuilder-section"><h6 class="deckbuilder-section-title">Commanders</h6></div>
          <div id="deckbuilder"></div>`
      });
      w.boot();
      w.self.STK_BRIDGE = {
        request: name => name === 'edhrecCommander'
          ? Promise.resolve([{ header: 'Creatures', cards: [
              { id: 'a1', name: 'Evolution Sage', numDecks: 9, potentialDecks: 10 },
              { id: 'a2', name: 'Cankerbloom', numDecks: 5, potentialDecks: 10 }
            ] }])
          : Promise.resolve([])
      };
      w.self.STK_DECK_EDHREC.apply({ edhrecSuggestions: true });
      w.document.getElementById('stk-edhrec-button').dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual([...w.document.querySelectorAll('.stk-results-name')].map(n => n.textContent),
        ['Cankerbloom'], 'the deck\'s own cards are not offered back to it');
      assertEqual(w.document.querySelector('.stk-results-aside').textContent, '1 already in this deck',
        'and the reader is told how much was left out');
    }

    console.log('deck-results: the filter speaks Scryfall\'s words');
    {
      const q = makeWorld({});
      q.boot();
      const results = q.self.STK_DECK_RESULTS;
      const card = {
        name: 'Sol Ring', typeLine: 'Artifact', manaCost: '{1}', oracleText: 'Add {C}{C}.',
        cmc: 1, colors: '', colorIdentity: '', power: '', toughness: '', rarity: 'common'
      };
      assertEqual(results.matches(card, 't:artifact').ok, true, 't: matches the type line');
      assertEqual(results.matches(card, 't:creature').ok, false, 'and a wrong type does not');
      assertEqual(results.matches(card, '-t:creature').ok, true, 'a leading dash excludes');
      assertEqual(results.matches(card, 'cmc<2').ok, true, 'cmc takes a comparison');
      assertEqual(results.matches(card, 'cmc>2').ok, false, 'and it is read either way');
      assertEqual(results.matches(card, 'o:"add {c}"').ok, true, 'o: searches the text in quotes');
      assertEqual(results.matches(card, 'sol').ok, true, 'a bare word matches the name');
      assertEqual(results.matches(card, 't:artifact sol').ok, true, 'and words combine');
      const unknown = results.matches(card, 'zone:hand');
      assertEqual(unknown.ok, true, 'a term this does not know is not a filter');
      assertEqual(unknown.unknown, 'zone', 'and it is named so the reader knows why');
    }

    summary('test-deck-modules');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
