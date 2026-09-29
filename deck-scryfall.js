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

// The one place that reaches into Scryfall's application state.
//
// Everything the deck modules know about Scryfall they learn here:
// window.Scryfall and window.ScryfallAPI, which are the site's own internals and
// not an interface anyone published. Behaviour follows Shambleshark's
// scryfall-globals.ts (MIT, https://github.com/crookedneighbor/shambleshark),
// rewritten in plain JavaScript with a local emitter in place of framebus.
//
// The difference from upstream is the posture. Upstream assumes these globals
// keep their shape. This assumes they might not: every hook is optional, every
// call is wrapped, and a missing method is reported rather than thrown. If
// Scryfall rewrites its internals, the deck features stop working and the deck
// editor does not.

(function () {
  'use strict';

  // --- a local emitter ------------------------------------------------------

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
    problems.push(message + (error ? ': ' + (error && error.message ? error.message : String(error)) : ''));
    if (self.STK_DECK_CLEANUP_DEBUG) {
      console.warn('[scryfall-toolkit] ' + message, error || '');
    }
  }

  // --- the globals ----------------------------------------------------------

  function scryfallGlobal() { return self.Scryfall || null; }
  function scryfallApi() { return self.ScryfallAPI || null; }
  function deckbuilder() {
    const s = scryfallGlobal();
    return s && s.deckbuilder ? s.deckbuilder : null;
  }
  function decksApi() {
    const api = scryfallApi();
    return api && api.decks ? api.decks : null;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- which deck -----------------------------------------------------------

  function deckIdFromUrl() {
    const match = /\/decks\/([a-z0-9-]+)/i.exec(self.location ? self.location.pathname : '');
    return match ? match[1] : '';
  }

  // Upstream waits for ScryfallAPI.grantSecret to appear first, then prefers the
  // URL, then the deckbuilder's own id, then whatever deck is active.
  function lookupDeckId(waitTime) {
    if (!scryfallApi()) {
      return delay(waitTime || 300).then(() => lookupDeckId((waitTime || 300) * 2));
    }
    const fromUrl = deckIdFromUrl();
    if (fromUrl) return Promise.resolve(fromUrl);
    const db = deckbuilder();
    if (db && db.deckId) return Promise.resolve(db.deckId);
    return new Promise(resolve => {
      const decks = decksApi();
      if (!decks || typeof decks.active !== 'function') return resolve('');
      try {
        decks.active(deck => resolve(deck && deck.id ? deck.id : ''));
      } catch (error) {
        report('ScryfallAPI.decks.active threw', error);
        resolve('');
      }
    });
  }

  let deckIdPromise = null;
  function activeDeckId() {
    if (!deckIdPromise) deckIdPromise = lookupDeckId();
    return deckIdPromise;
  }

  // --- the two calls the deck modules need ----------------------------------

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
    return callDeck('get', id => [id]).then(deck => deck || {
      id: '', entries: {}, sections: { primary: [], secondary: [] }
    });
  }

  function updateEntry(card) {
    return callDeck('updateEntry', id => [id, card]);
  }

  function addCard(cardId) {
    return callDeck('addCard', id => [id, cardId]);
  }

  function pushNotification(header, message, color, type) {
    const s = scryfallGlobal();
    if (!s || typeof s.pushNotification !== 'function') return;
    try {
      s.pushNotification(header, message, color, type);
    } catch (error) {
      report('Scryfall.pushNotification threw', error);
    }
  }

  // --- the hooks ------------------------------------------------------------
  //
  // Each hook is how the deck modules learn that something changed. Each is
  // optional: if Scryfall has reshaped the thing it attaches to, that hook is
  // simply not installed and the feature stops reacting.

  let hooksInstalled = false;

  function addHooks() {
    if (hooksInstalled) return true;
    hooksInstalled = true;

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
    } else {
      report('ScryfallAPI.decks is not available');
    }

    const db = deckbuilder();
    if (!db) {
      report('Scryfall.deckbuilder is not available');
      return false;
    }

    // totalCount is a method on the Vue instance. Wrapping it is how upstream
    // learns the total changed.
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
    // edited. This is the most fragile line in the project: it assumes entries
    // is a plain own property of the deckbuilder object. If it is not, the
    // hook gives up and says so instead of breaking the editor.
    try {
      const descriptor = Object.getOwnPropertyDescriptor(db, 'entries');
      const current = db.entries;
      if (current && (!descriptor || !descriptor.get)) {
        Object.defineProperty(db, 'entries', {
          configurable: true,
          get() { return this._stkEntries; },
          set(entries) {
            this._stkEntries = entries;
            emit('deck-entries-updated', { entries: entries });
          }
        });
        db._stkEntries = current;
      } else if (descriptor && descriptor.get) {
        report('deckbuilder.entries is a computed property; the deck edits hook is not installed');
      }
    } catch (error) {
      report('could not hook deckbuilder.entries', error);
    }

    return true;
  }

  // --- waiting for elements that arrive later -------------------------------

  // The deck editor builds its rows, columns and toolbar as the deck loads, so
  // almost everything has to wait for markup rather than look for it once.
  const waiting = [];
  let observer = null;

  function checkWaiting() {
    waiting.forEach(entry => {
      document.querySelectorAll(entry.selector).forEach(element => {
        if (entry.seen.indexOf(element) > -1) return;
        entry.seen.push(element);
        try {
          entry.fn(element);
        } catch (error) {
          report('element handler for ' + entry.selector + ' threw', error);
        }
      });
    });
  }

  function elementReady(selector, fn) {
    waiting.push({ selector, fn, seen: [] });
    if (!observer && typeof MutationObserver === 'function') {
      observer = new MutationObserver(checkWaiting);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    checkWaiting();
  }

  // --- the outside interface ------------------------------------------------

  self.STK_DECK_SCRYFALL = {
    on: on,
    emit: emit,
    report: report,
    install: addHooks,
    elementReady: elementReady,
    getDeck: getDeck,
    updateEntry: updateEntry,
    addCard: addCard,
    pushNotification: pushNotification,
    activeDeckId: activeDeckId,
    deckIdFromUrl: deckIdFromUrl,
    status() {
      return {
        problems: problems.slice(),
        hooksInstalled: hooksInstalled,
        hasScryfall: Boolean(scryfallGlobal()),
        hasScryfallApi: Boolean(scryfallApi()),
        hasDeckbuilder: Boolean(deckbuilder())
      };
    }
  };
})();
