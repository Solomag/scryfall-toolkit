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

// The bridge between Scryfall's page world and this extension's content script.
//
// The deck features have to run in the page's own world, because they work
// through window.Scryfall and window.ScryfallAPI and a content script lives in
// an isolated world that cannot see either. The content script, in turn, is the
// only side that can read chrome.storage. So the two talk across the one
// boundary they share: the window itself.
//
// This is not a security boundary and is not meant to be one. A script running
// in the page can read anything this file can and call its functions directly.
// All that crosses here is the user's own settings and a status report.

(function () {
  'use strict';

  const CHANNEL = 'scryfall-toolkit';
  const VERSION = 1;

  // Requests that are still waiting for the content script to come back with an
  // answer. The deck features need data from the extension's own background
  // worker, and this is the only path to it from the page world.
  const waiting = Object.create(null);
  let nextId = 0;

  function post(type, value) {
    self.postMessage({ channel: CHANNEL, version: VERSION, source: 'page', type: type, value: value }, '*');
  }

  // Ask the background worker for something and wait for it. `name` is the
  // message type the worker answers, `value` its payload.
  function request(name, value) {
    return new Promise((resolve, reject) => {
      const id = 'r' + (++nextId);
      waiting[id] = { resolve, reject };
      post('request', { id: id, name: name, value: value || {} });
    });
  }

  function reportStatus(extra) {
    const adapter = self.STK_DECK_SCRYFALL;
    const cleanup = self.STK_DECK_CLEANUP;
    const edhrec = self.STK_DECK_EDHREC;
    const search = self.STK_DECK_SEARCH;
    post('status', Object.assign({
      wired: Boolean(adapter),
      cleanUp: cleanup ? cleanup.status().applied : false,
      edhrecSuggestions: edhrec ? edhrec.status().applied : false,
      deckSearch: search ? search.status().applied : false,
      scryfall: adapter ? adapter.status() : null
    }, extra || {}));
  }

  function applySettings(settings) {
    const s = settings || {};
    // The results area is shared and its view is the reader's choice, remembered
    // across both panels.
    if (s.deckResultsView === 'list' || s.deckResultsView === 'images') self.STK_DECK_VIEW = s.deckResultsView;
    const wantCleanUp = Boolean(s.cleanUpLandsInSingleton) ||
      Boolean(s.sortEntriesPrimary && s.sortEntriesPrimary !== 'none');
    const wantEdhrec = Boolean(s.edhrecSuggestions);
    const wantSearch = Boolean(s.deckSearch);

    // A module that is on is applied; a module that is off is disabled, so anything it already
    // put on the page comes off. Reporting `off: true` while the wrapped clean up button and the
    // two toolbar buttons were still there was the page saying one thing and doing another: the
    // settings page and the diagnostics both read "off" while the editor kept changing the deck.
    const setModule = (module, wanted) => {
      if (!module) return;
      try {
        if (wanted) module.apply(s);
        else module.disable?.();
      } catch (error) {
        reportStatus({ problems: ['a deck module threw while being set: ' + (error && error.message || error)] });
      }
    };

    if (!wantCleanUp && !wantEdhrec && !wantSearch) {
      // Nothing is on. The hooks are deliberately not installed: a setting
      // that is off should leave Scryfall's own objects alone.
      setModule(self.STK_DECK_CLEANUP, false);
      setModule(self.STK_DECK_EDHREC, false);
      setModule(self.STK_DECK_SEARCH, false);
      reportStatus({ off: true });
      return;
    }

    const adapter = self.STK_DECK_SCRYFALL;
    if (!adapter) {
      post('status', { wired: false, problems: ['the deck modules did not load'] });
      return;
    }

    adapter.install();
    setModule(self.STK_DECK_CLEANUP, wantCleanUp);
    setModule(self.STK_DECK_EDHREC, wantEdhrec);
    setModule(self.STK_DECK_SEARCH, wantSearch);
    reportStatus();
  }

  self.addEventListener('message', event => {
    // Only ever from this window. A message from another frame or from the
    // network is not ours. Both names are checked because self and window are
    // the same object in a page but can be reached differently across a bridge.
    if (event.source !== self && event.source !== self.window) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.version !== VERSION) return;
    if (data.source !== 'content') return;
    if (data.type === 'settings') applySettings(data.value);
    if (data.type === 'ping') reportStatus();
    if (data.type === 'response') {
      const pending = data.value && waiting[data.value.id];
      if (!pending) return;
      delete waiting[data.value.id];
      if (data.value.error) pending.reject(new Error(data.value.error));
      else pending.resolve(data.value.value);
    }
  });

  self.STK_BRIDGE = { request: request };

  // Announce that this side is listening, so the content script does not have
  // to guess whether it arrived before or after the page finished loading.
  post('ready', null);
})();
