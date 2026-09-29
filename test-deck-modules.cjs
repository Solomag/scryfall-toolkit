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
    for (const file of ['deck-tools.js', 'deck-scryfall.js', 'deck-clean-up.js', 'deck-card-preview.js', 'deck-edhrec.js', 'deck-search.js']) run(file);
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
      assertEqual(w.self.posted[1].value.cardPreview, false, 'and the preview is not');

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

    console.log('deck-card-preview: hovering a row shows the card, in Scryfall\'s own tooltip');
    {
      const w = makeWorld({
        deck: {
          id: 'deck-7',
          sections: { primary: ['nonlands'], secondary: [] },
          entries: {
            nonlands: [
              { id: 'e1', count: 1, section: 'nonlands', raw_text: true,
                card_digest: { name: 'Aetherling', type_line: 'Creature — Shapeshifter', image_uris: { front: 'https://img/front1.jpg' } } },
              { id: 'e2', count: 1, section: 'nonlands', raw_text: true,
                card_digest: { name: 'Delver', type_line: 'Creature — Human Wizard', image_uris: { front: 'https://img/front2.jpg', back: 'https://img/back2.jpg' } } }
            ]
          }
        },
        html: `
          <div id="card-tooltip" style="display:none"></div>
          <ul>
            <li class="deckbuilder-entry" data-entry="e1"></li>
            <li class="deckbuilder-entry" data-entry="e2"></li>
          </ul>`
      });
      w.boot();
      const result = w.self.STK_DECK_CARD_PREVIEW.apply({ cardPreviewOnHover: true });
      assertEqual(result.applied, true, 'the preview is wired');
      await tick();

      const rows = w.document.querySelectorAll('.deckbuilder-entry');
      const tooltip = w.document.getElementById('card-tooltip');
      rows[0].dispatchEvent(new w.self.Event('mousemove'));
      assertEqual(tooltip.style.display, 'flex', 'hovering shows the tooltip');
      assertEqual(tooltip.className, '', 'a single-faced card gets the plain layout');
      assertEqual(w.document.getElementById('card-tooltip-img-front').getAttribute('src'),
        'https://img/front1.jpg', 'with the card\'s front image');

      rows[1].dispatchEvent(new w.self.Event('mousemove'));
      assertEqual(tooltip.className, 'two-up', 'a double-faced card gets the two-up layout');
      assertEqual(w.document.getElementById('card-tooltip-img-front').getAttribute('src'),
        'https://img/front2.jpg', 'and its front');
      assertEqual(w.document.getElementById('card-tooltip-img-back').getAttribute('src'),
        'https://img/back2.jpg', 'and its back');

      rows[0].dispatchEvent(new w.self.Event('mousemove'));
      assertEqual(w.document.getElementById('card-tooltip-img-back'), null,
        'going back to a single-faced card drops the back face');

      rows[0].dispatchEvent(new w.self.Event('mouseout'));
      assertEqual(tooltip.style.display, 'none', 'and leaving the row hides it');
    }

    console.log('deck-card-preview: off means nothing is attached');
    {
      const w = makeWorld({
        html: '<div id="card-tooltip"></div><ul><li class="deckbuilder-entry" data-entry="e1"></li></ul>'
      });
      w.boot();
      const result = w.self.STK_DECK_CARD_PREVIEW.apply({ cardPreviewOnHover: false });
      assertEqual(result.applied, false, 'nothing is wired');
      const tooltip = w.document.getElementById('card-tooltip');
      const before = tooltip.style.display;
      w.document.querySelector('.deckbuilder-entry').dispatchEvent(new w.self.Event('mousemove'));
      assertEqual(tooltip.style.display, before,
        'and hovering leaves the tooltip exactly as it was');
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
          return Promise.resolve([
            { header: 'High Synergy Cards', cards: [
              { id: 'a1', name: 'Evolution Sage', numDecks: 900, potentialDecks: 1000 },
              { id: 'a2', name: 'Tekuthal', numDecks: 0, potentialDecks: 1000 }
            ] },
            { header: 'Creatures', cards: [{ id: 'a3', name: 'Cankerbloom', numDecks: 250, potentialDecks: 1000 }] }
          ]);
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
      assertEqual(asked.length, 1, 'clicking asks for suggestions');
      assertEqual(asked[0].name, 'edhrecCommander', 'through the background worker');
      assertEqual(asked[0].value.name, 'Atraxa, Praetors Voice', 'for the deck\'s commander');

      const titles = [...w.document.querySelectorAll('.stk-edhrec-list-title')].map(t => t.textContent);
      assertEqual(titles, ['High Synergy Cards', 'Creatures'], 'EDHREC\'s own grouping is kept');
      assertEqual([...w.document.querySelectorAll('.stk-edhrec-card-name')].map(n => n.textContent),
        ['Evolution Sage', 'Tekuthal', 'Cankerbloom'], 'with its cards in its order');
      assertEqual([...w.document.querySelectorAll('.stk-edhrec-card-rate')].map(n => n.textContent),
        ['90%', '0%', '25%'], 'and how many of the commander\'s decks play each');

      const added = [];
      w.self.ScryfallAPI.decks.addCard = (id, cardId, cb) => { added.push(cardId); cb({ id: cardId }); };
      const buttons = w.document.querySelectorAll('.stk-edhrec-add');
      buttons[0].dispatchEvent(new w.self.Event('click'));
      await tick();
      assertEqual(added, ['a1'], 'adding a card goes through Scryfall with its own id');
      assertEqual(buttons[0].textContent, 'Added', 'and the button says so afterwards');

      w.document.querySelector('.modal-dialog-close').dispatchEvent(new w.self.Event('click'));
      assertEqual(w.document.querySelector('.stk-edhrec-panel'), null, 'and the panel closes');
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
          return Promise.resolve({
            cards: [
              { id: 's1', name: 'Sol Ring', typeLine: 'Artifact', manaCost: '{1}' },
              { id: 's2', name: 'Swords to Plowshares', typeLine: 'Instant', manaCost: '{W}' }
            ],
            hasMore: true
          });
        }
      };
      w.self.STK_DECK_SEARCH.apply({ deckSearch: true });
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

      assertEqual([...w.document.querySelectorAll('.stk-search-card-name')].map(n => n.textContent),
        ['Sol Ring', 'Swords to Plowshares'], 'results come back as a list');
      assertEqual(w.document.querySelector('.stk-search-more') !== null, true,
        'and Scryfall saying there is more gives a way to ask for it');

      const added = [];
      w.self.ScryfallAPI.decks.addCard = (id, cardId, cb) => { added.push(cardId); cb({ id: cardId }); };
      w.document.querySelector('.stk-search-add').dispatchEvent(new w.self.Event('click'));
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

    summary('test-deck-modules');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
