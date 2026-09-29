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

// The clean up improver, running where it has to run: in Scryfall's own page
// world, because everything it does goes through Scryfall's application state
// rather than through the page's markup.
//
// Behaviour follows Shambleshark's scryfall-embed (modify-clean-up,
// add-section-heading, scryfall-globals) — MIT,
// https://github.com/crookedneighbor/shambleshark — rewritten for this project:
// plain JavaScript, and a local emitter in place of the message bus, since
// everything here runs in one world.
//
// Read this before touching it. window.Scryfall and window.ScryfallAPI are
// Scryfall's internals, not an interface anyone published. They can change
// without warning. Everything below is therefore wrapped so that a failure
// degrades to "the feature does nothing" rather than "the deck editor breaks".

(function () {
  'use strict';

  const tools = self.STK_DECK_TOOLS;

  // --- a local emitter ------------------------------------------------------
  // Upstream routes these through framebus to cross frames. Nothing here
  // crosses a frame.

  const handlers = Object.create(null);

  function on(event, fn) {
    (handlers[event] = handlers[event] || []).push(fn);
  }

  function emit(event, data) {
    (handlers[event] || []).slice().forEach(fn => {
      try {
        fn(data);
      } catch (error) {
        report('listener for ' + event + ' threw', error);
      }
    });
  }

  // --- what this tells the outside world ------------------------------------

  const problems = [];

  function report(message, error) {
    const detail = message + (error ? ': ' + (error && error.message ? error.message : String(error)) : '');
    problems.push(detail);
    if (self.STK_DECK_CLEANUP_DEBUG) {
      console.warn('[scryfall-toolkit] ' + detail);
    }
  }

  // --- Scryfall's own globals ----------------------------------------------

  function scryfallGlobal() {
    return self.Scryfall || null;
  }

  function scryfallApi() {
    return self.ScryfallAPI || null;
  }

  function deckbuilder() {
    const s = scryfallGlobal();
    return s && s.deckbuilder ? s.deckbuilder : null;
  }

  function decksApi() {
    const api = scryfallApi();
    return api && api.decks ? api.decks : null;
  }

  // The deck id. Upstream waits for ScryfallAPI.grantSecret to exist first,
  // then prefers the URL, then the deckbuilder's own id, then the active deck.
  let activeDeckIdPromise = null;

  function deckIdFromUrl() {
    const match = /\/decks\/([a-z0-9-]+)/i.exec(self.location ? self.location.pathname : '');
    return match ? match[1] : '';
  }

  function getActiveDeckId(waitTime) {
    if (!scryfallApi()) {
      return delay(waitTime || 300).then(() => getActiveDeckId((waitTime || 300) * 2));
    }
    const fromUrl = deckIdFromUrl();
    if (fromUrl) return Promise.resolve(fromUrl);
    const db = deckbuilder();
    if (db && db.deckId) return Promise.resolve(db.deckId);
    return new Promise(resolve => {
      const decks = decksApi();
      if (!decks || typeof decks.active !== 'function') return resolve('');
      decks.active(deck => resolve(deck && deck.id ? deck.id : ''));
    });
  }

  function activeDeckId() {
    if (!activeDeckIdPromise) activeDeckIdPromise = getActiveDeckId();
    return activeDeckIdPromise;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Scryfall's deck API is callback-shaped. Wrap the two calls this feature
  // needs, and fail soft if the method is not there any more.
  function callDeck(method, buildArgs) {
    return activeDeckId().then(id => new Promise(resolve => {
      const decks = decksApi();
      if (!decks || typeof decks[method] !== 'function') {
        report('ScryfallAPI.decks.' + method + ' is not available');
        return resolve(null);
      }
      let settled = false;
      const done = value => { if (!settled) { settled = true; resolve(value); } };
      try {
        decks[method].apply(decks, buildArgs(id).concat(done));
      } catch (error) {
        report('ScryfallAPI.decks.' + method + ' threw', error);
        done(null);
      }
    }));
  }

  function getDeck() {
    return callDeck('get', id => [id]).then(deck => deck || { entries: {}, sections: { primary: [], secondary: [] } });
  }

  function updateEntry(card) {
    return callDeck('updateEntry', id => [id, card]);
  }

  function pushNotification(header, message, color, type) {
    const s = scryfallGlobal();
    if (s && typeof s.pushNotification === 'function') {
      try {
        s.pushNotification(header, message, color, type);
      } catch (error) {
        report('Scryfall.pushNotification threw', error);
      }
    }
  }

  // The hooks that tell this feature the deck changed. Each one is optional:
  // if Scryfall has reshaped the thing it attaches to, that hook simply does
  // not exist and the feature stops reacting instead of breaking the editor.
  function addHooks() {
    const decks = decksApi();
    if (decks) {
      ['addCard', 'updateEntry', 'replaceEntry', 'createEntry', 'destroyEntry'].forEach(method => {
        const original = decks[method];
        if (typeof original !== 'function') return;
        decks[method] = function () {
          const args = arguments;
          const result = original.apply(decks, args);
          emit('deck-method-called', { method: method, deckId: args[0], payload: args[1] });
          return result;
        };
      });
    }

    const db = deckbuilder();
    if (!db) return;

    // totalCount is a function on the Vue instance. Wrapping it is how upstream
    // learns the total changed; if it is no longer a function this is skipped.
    if (typeof db.totalCount === 'function' && !db.totalCount.__stkWrapped) {
      const originalTotal = db.totalCount;
      let cached = originalTotal.call(db);
      const wrapped = function () {
        const next = originalTotal.call(db);
        if (next !== cached) {
          cached = next;
          emit('deck-total-count-updated', { totalCount: next });
        }
        return next;
      };
      wrapped.__stkWrapped = true;
      db.totalCount = wrapped;
    }

    // Replacing the entries property is how upstream learns the deck was
    // edited. This is the single most fragile line in the project: it assumes
    // entries is a plain own property of the deckbuilder object.
    try {
      const current = db.entries;
      if (current && !Object.getOwnPropertyDescriptor(db, 'entries').get) {
        Object.defineProperty(db, 'entries', {
          configurable: true,
          get() { return this._stkEntries; },
          set(entries) {
            this._stkEntries = entries;
            emit('deck-entries-updated', { entries: entries });
          }
        });
        db._stkEntries = current;
      }
    } catch (error) {
      report('could not hook deckbuilder.entries', error);
    }
  }

  // --- correcting the land and nonland columns ------------------------------

  function correctLandNonLandColumns(deck) {
    if (!tools.hasDedicatedLandSection(deck)) return Promise.resolve([]);
    const entries = deck.entries || {};
    const landsInNonLands = (entries.nonlands || []).filter(c => c.card_digest).filter(c => tools.isLandCard(c));
    const nonLandsInLands = (entries.lands || []).filter(c => c.card_digest).filter(c => !tools.isLandCard(c));

    landsInNonLands.forEach(c => { c.section = 'lands'; });
    nonLandsInLands.forEach(c => { c.section = 'nonlands'; });

    return Promise.all(landsInNonLands.concat(nonLandsInLands).map(c => updateEntry(c)));
  }

  // --- the headings ---------------------------------------------------------

  // The sections that get headings. Upstream names these four and no others.
  const SECTIONS_WITH_HEADINGS = {
    nonlands: true, mainboard: true, columna: true, columnb: true
  };

  const HEADINGS = {
    'card-type': [
      { id: 'creature', label: 'creatures' },
      { id: 'planeswalker', label: 'planeswalkers' },
      { id: 'artifact', label: 'artifacts' },
      { id: 'enchantment', label: 'enchantments' },
      { id: 'instant', label: 'instants' },
      { id: 'sorcery', label: 'sorceries' },
      { id: 'land', label: 'lands' }
    ],
    name: [
      { id: 'abcd', label: 'a-d' },
      { id: 'efg', label: 'e-g' },
      { id: 'hijk', label: 'h-k' },
      { id: 'lmnop', label: 'l-p' },
      { id: 'qrs', label: 'q-s' },
      { id: 'tuv', label: 't-v' },
      { id: 'wx', label: 'w-x' },
      { id: 'yz', label: 'y-z' }
    ]
  };

  function headingFor(sortChoice, entry) {
    const groups = HEADINGS[sortChoice];
    if (!groups) return null;
    if (sortChoice === 'name') {
      const first = (entry.card_digest && entry.card_digest.name || '').charAt(0).toLowerCase();
      return groups.find(group => group.id.indexOf(first) > -1) || null;
    }
    const primary = tools.getPrimaryType(entry);
    return groups.find(group => group.id === primary) || null;
  }

  function totalsFor(section, sortChoice) {
    const db = deckbuilder();
    const entries = (db && db.entries && db.entries[section]) || [];
    if (sortChoice === 'name') return tools.calculateTotalsByName(entries);
    if (sortChoice === 'card-type') return tools.calculateTotalsByCardType(entries);
    return {};
  }

  function createElement(html) {
    const holder = document.createElement('ul');
    holder.innerHTML = String(html).trim();
    return holder.firstElementChild;
  }

  function createHeadingElement(heading, subtotal) {
    const db = deckbuilder();
    const total = db && typeof db.totalCount === 'function' ? db.totalCount() : 0;
    return createElement(
      '<li class="cleanup-improver__deck-section-heading" data-heading-section-id="' + heading.id + '">' +
        '<h6 class="deckbuilder-section-title-bar">' +
          '<span class="deckbuilder-section-title">' + heading.label + '</span>' +
          '<span class="deckbuilder-section-count">' +
            '<span class="modify-cleanup-subtotal-count">' + subtotal + '</span>/' +
            '<span class="modify-cleanup-total-count">' + total + '</span> cards</span>' +
        '</h6>' +
      '</li>'
    );
  }

  function resetDefaultHeadings() {
    // Put Scryfall's own section titles back before adding ours, so ours can
    // hide them without leaving them hidden when the feature is turned off.
    document.querySelectorAll('h6.deckbuilder-section-title-bar').forEach(el => el.classList.remove('is-hidden'));
  }

  function resetPreviousHeadings(headings, section) {
    if (headings[section]) {
      Object.keys(headings[section]).forEach(key => {
        const el = headings[section][key];
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
    headings[section] = {};
  }

  function insertHeadings(sortChoice, headings) {
    const db = deckbuilder();
    if (!db) return;
    const done = () => {
      resetDefaultHeadings();
      db.flatSections.forEach(section => {
        if (!(section in SECTIONS_WITH_HEADINGS)) return;
        const totals = totalsFor(section, sortChoice);
        resetPreviousHeadings(headings, section);
        (db.entries[section] || []).forEach(entry => {
          if (!entry.card_digest) return;
          const heading = headingFor(sortChoice, entry);
          if (!heading || headings[section][heading.id]) return;
          const li = createHeadingElement(heading, totals[heading.id]);
          headings[section][heading.id] = li;

          const entryElement = document.querySelector('[data-entry="' + entry.id + '"]');
          if (!entryElement || !entryElement.parentNode) return;
          const originalTitle = entryElement.parentNode.parentNode
            ? entryElement.parentNode.parentNode.querySelector('h6.deckbuilder-section-title-bar')
            : null;
          if (originalTitle) originalTitle.classList.add('is-hidden');
          entryElement.parentNode.insertBefore(li, entryElement);
        });
      });
    };

    if (typeof db.$nextTick === 'function') {
      try {
        db.$nextTick(done);
        return;
      } catch (error) {
        report('deckbuilder.$nextTick threw', error);
      }
    }
    done();
  }

  function updateTotalsInHeadings(totalCount) {
    document.querySelectorAll('.cleanup-improver__deck-section-heading').forEach(el => {
      const el2 = el.querySelector('.modify-cleanup-total-count');
      if (el2) el2.textContent = String(totalCount);
    });
  }

  function updateSubTotalsInHeadings(section, sortChoice) {
    const totals = totalsFor(section, sortChoice);
    Object.keys(totals).forEach(area => {
      const el = document.querySelector('[data-heading-section-id="' + area + '"] .modify-cleanup-subtotal-count');
      if (el) el.textContent = String(totals[area]);
    });
  }

  function addDeckTotalUpdateListener(sortChoice) {
    on('deck-total-count-updated', data => {
      updateTotalsInHeadings(data.totalCount);
      const db = deckbuilder();
      if (!db) return;
      db.flatSections.forEach(section => {
        if (!(section in SECTIONS_WITH_HEADINGS)) return;
        updateSubTotalsInHeadings(section, sortChoice);
      });
    });
  }

  // --- wiring it to the clean up button -------------------------------------

  const SORTERS = {
    'card-type': () => tools.sortByPrimaryCardType(),
    name: () => tools.sortByName()
  };

  function modifyCleanUp(config) {
    const db = deckbuilder();
    if (!db || typeof db.cleanUp !== 'function') {
      report('Scryfall.deckbuilder.cleanUp is not available');
      return false;
    }

    const sortChoice = config.sortEntriesPrimary;
    const sorter = sortChoice && SORTERS[sortChoice] ? SORTERS[sortChoice]() : null;

    if (sorter) {
      const headings = {};
      if (config.insertSortingHeadings) addDeckTotalUpdateListener(sortChoice);

      on('deck-entries-updated', () => {
        const target = deckbuilder();
        if (!target) return;
        target.flatSections.forEach(section => {
          if (Array.isArray(target.entries[section])) target.entries[section].sort(sorter);
        });
        if (typeof target.$forceUpdate === 'function') {
          try {
            target.$forceUpdate();
          } catch (error) {
            report('deckbuilder.$forceUpdate threw', error);
          }
        }
        if (config.insertSortingHeadings) insertHeadings(sortChoice, headings);
      });
    }

    const original = db.cleanUp;
    db.cleanUp = function () {
      const args = arguments;
      const self2 = this;
      return getDeck().then(deck => {
        if (config.cleanUpLandsInSingleton) return correctLandNonLandColumns(deck);
      }).catch(error => {
        report('reading the deck before clean up threw', error);
      }).then(() => original.apply(self2, args));
    };
    return true;
  }

  // --- the outside interface ------------------------------------------------

  let applied = false;

  function apply(config) {
    config = config || {};
    if (!tools) {
      report('deck tools were not loaded before this file');
      return { applied: false, problems: problems.slice() };
    }

    // Hooks are installed once. The clean up wrapper is installed once too, so
    // that turning the setting off and on again does not stack wrappers.
    if (!applied) {
      try {
        addHooks();
      } catch (error) {
        report('installing the hooks failed', error);
      }
    }

    const wanted = Boolean(config.cleanUpLandsInSingleton) ||
      (config.sortEntriesPrimary && config.sortEntriesPrimary !== 'none');
    if (!wanted) {
      return { applied: applied, problems: problems.slice() };
    }

    if (!applied) {
      try {
        applied = modifyCleanUp(config) === true;
      } catch (error) {
        report('wiring the clean up button failed', error);
      }
    }
    return { applied: applied, problems: problems.slice() };
  }

  function status() {
    return {
      applied: applied,
      problems: problems.slice(),
      hasScryfall: Boolean(scryfallGlobal()),
      hasScryfallApi: Boolean(scryfallApi()),
      hasDeckbuilder: Boolean(deckbuilder())
    };
  }

  self.STK_DECK_CLEANUP = {
    apply: apply,
    status: status,
    // exposed so the port can be exercised against a stand-in Scryfall
    _internal: {
      getDeck: getDeck, updateEntry: updateEntry, correctLandNonLandColumns: correctLandNonLandColumns,
      insertHeadings: insertHeadings, headingFor: headingFor, totalsFor: totalsFor,
      addHooks: addHooks, modifyCleanUp: modifyCleanUp, deckIdFromUrl: deckIdFromUrl
    }
  };
})();
