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
// Loaded first in every context — the content scripts, the background script and the two pages —
// by the Firefox manifest, which names this file before the others. On Chrome it does nothing at
// all: `browser` is not there, so the guard returns before anything is touched.
(() => {
  'use strict';
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  if (!root.browser || !root.browser.storage || !root.browser.runtime) return;

  // A promise method, with the callback form Chrome gives it. An error is put on
  // `chrome.runtime.lastError` for the callback to read, which is how Chrome reports one and how
  // the callers here already check it.
  const callbackify = (owner, name) => {
    const promise = owner[name];
    if (typeof promise !== 'function') return;
    owner[name] = function (...args) {
      const last = args[args.length - 1];
      const callback = typeof last === 'function' ? args.pop() : null;
      const answer = promise.apply(owner, args);
      if (!callback) return answer;
      answer.then(
        value => { root.browser.runtime.lastError = undefined; callback(value); },
        error => { root.browser.runtime.lastError = error; callback(undefined); }
      );
      return answer;
    };
  };

  callbackify(root.browser.runtime, 'sendMessage');
  if (root.browser.permissions) {
    callbackify(root.browser.permissions, 'request');
    callbackify(root.browser.permissions, 'contains');
  }
  root.chrome = root.browser;
})();
