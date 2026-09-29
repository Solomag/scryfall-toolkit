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
// Deck features have to run in the page's own world, because they work through
// window.Scryfall and window.ScryfallAPI and a content script lives in an
// isolated world that cannot see either. The content script, in turn, is the
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

  function post(type, value) {
    self.postMessage({ channel: CHANNEL, version: VERSION, source: 'page', type: type, value: value }, '*');
  }

  function applySettings(settings) {
    const cleanup = self.STK_DECK_CLEANUP;
    if (!cleanup) {
      post('status', { applied: false, problems: ['the deck modules did not load'] });
      return;
    }
    const result = cleanup.apply(settings || {});
    post('status', result);
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
    if (data.type === 'ping') post('status', self.STK_DECK_CLEANUP ? self.STK_DECK_CLEANUP.status() : null);
  });

  // Announce that this side is listening, so the content script does not have
  // to guess whether it arrived before or after the page finished loading.
  post('ready', null);
})();
