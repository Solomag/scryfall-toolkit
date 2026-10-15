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

// Chrome and Firefox, one namespace.
//
// The two browsers expose the same APIs under two names. Chrome has `chrome`, whose MV3 methods
// return promises and whose older ones also take a callback; Firefox has a promise-returning
// `browser` and a callback-based `chrome` kept only for compatibility. This extension is written
// against `chrome` and mostly with promises, so on Firefox the namespace is pointed at `browser`
// — and the three calls it still makes with a callback (sendMessage, and permissions request and
// contains) are given their callback form back, because Firefox's `browser` methods ignore a
// callback and the promise would otherwise resolve into nothing while the caller waited.
//
// Those callbacks read the error from `chrome.runtime.lastError`, and Firefox makes that property
// getter-only: the write that reports an error threw instead, inside the promise handler, so the
// callback never ran at all and the caller waited for an answer that could not come. Every tag
// panel on a card page hung on "Loading tags…" because of it. An own, writable property is put in
// front of the getter below, and the callbacks work as they do on Chrome.
//
// Loaded first in the content scripts and the background script by the Firefox manifest, which
// names this file before the others. The two extension pages do not load it: they use Firefox's
// own callback-shaped `chrome`. On Chrome it does nothing at all: `browser` is not there, so the
// guard returns before anything is touched.
(() => {
  'use strict';
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  if (!root.browser || !root.browser.storage || !root.browser.runtime) return;

  // A promise method, with the callback form Chrome gives it. An error is put on
  // `chrome.runtime.lastError` for the callback to read, which is how Chrome reports one and how
  // the callers here already check it.
  const setLastError = value => {
    // Firefox's `lastError` is getter-only, so this write threw and the callback below never ran.
    // The own property defined before the first callbackify shadows the getter, so the write lands
    // — and a browser that still refuses it must not take the callback down with it.
    try { root.browser.runtime.lastError = value; } catch { /* read-only on this browser */ }
  };
  const callbackify = (owner, name) => {
    const promise = owner[name];
    if (typeof promise !== 'function') return;
    owner[name] = function (...args) {
      const last = args[args.length - 1];
      const callback = typeof last === 'function' ? args.pop() : null;
      const answer = promise.apply(owner, args);
      if (!callback) return answer;
      answer.then(
        value => { setLastError(undefined); callback(value); },
        error => { setLastError(error); callback(undefined); }
      );
      return answer;
    };
  };

  try {
    Object.defineProperty(root.browser.runtime, 'lastError',
      { value: undefined, writable: true, configurable: true });
  } catch { /* an object that will not take it keeps Firefox's own behaviour */ }

  callbackify(root.browser.runtime, 'sendMessage');
  if (root.browser.permissions) {
    callbackify(root.browser.permissions, 'request');
    callbackify(root.browser.permissions, 'contains');
  }
  root.chrome = root.browser;
})();
