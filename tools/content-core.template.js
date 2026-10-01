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

// The part of the card page every other content script is built on: the settings,
// what page this is, the request wrapper, the shared clipboard list and the hover
// preview. It also owns the boot.
//
// This file used to be content.js and held all of this and every feature, 1901
// lines in one closure. The features are now their own files and read what they
// need from self.STK_CONTENT. The one thing that made that safe is written down
// at the foot: the order the features run in is a list here, not implied by the
// order the manifest happens to list the files in.
(async () => {
  // --- the registry, before anything can need it -----------------------------
  //
  // A feature file is injected one after another, and the first thing this file
  // does is wait for storage, so a feature file runs while this one is still
  // loading. Two things follow, and both are the reason this shape is here:
  //
  //  - `context` is a promise, because a feature file cannot destructure a
  //    settings object that has not been read yet. Destructuring at load time
  //    gives every feature undefined for everything, quietly.
  //  - `on()` only registers. The boot runs later, in a macrotask, by which time
  //    every feature file has been given the chance to register.
  const pending = {};
  let context = null;
  let booted = false;
  let releaseContext;
  const arrived = new Promise(resolve => { releaseContext = resolve; });
  // Function declarations, not consts: on() can reach start() before the settings
  // arrive, and a const would be in its temporal dead zone until then.
  function on(step, run) {
    (pending[step] = pending[step] || []).push(run);
    // Only if the boot has already been and gone, which should not happen: a
    // feature file registers in a microtask and the boot waits for a macrotask.
    if (booted) start(step, run);
  }
  function start(step, run) {
    Promise.resolve()
      .then(() => run(context))
      // One feature failing is one feature failing. Before the split a throw here
      // stopped every feature below it from running, and the only sign was an empty
      // panel and nothing in the log.
      .catch(error => reportFeature(step, error));
  }
  function reportFeature(step, error) {
    // Reported rather than swallowed. This is a content script with nowhere useful
    // to write it, so it goes to the console the developer has open.
    try {
      console.warn('Scryfall Toolkit: ' + step + ' failed:', error);
    } catch (ignored) { /* nothing left to report it to */ }
  }
  self.STK_CONTENT = { on, reportFeature, context: arrived };

@@BODY@@

  // What the feature files read. Published only once it is complete, so a feature
  // cannot see a half-built core.
  context = {
    settings,
    language,
    t,
    cardPath,
    cardPage,
    advancedPage,
    identity,
    PLATFORM_NAMES,
    chosenPlatforms,
    platformFilterOn,
    setPlatformsOf,
    platformSetVisible,
    platformSetRequests,
    request,
    button,
    iconButton,
    attachPrintButton,
    printKey,
    refreshPrintButtons,
    flashCopied,
    hidePreview,
    positionPreview,
    enablePreview,
    ctQueuedCells,
    printButtonRefreshers,
    shared
  };
  Object.assign(self.STK_CONTENT, context);
  releaseContext(context);

  // The boot, in one place: which feature, whether it runs, and whether the next
  // one waits for it.
  //
  // Read out of the `if (condition) initX();` lines that were at the foot of
  // content.js by tools/content-core-run.cjs, rather than written out again here.
  // A condition typed from memory is how a feature ends up running on a page it
  // has no business on, and nothing in the feature file would say so.
  //
  // The conditions are functions rather than strings. A Manifest V3 content script
  // runs under a policy that forbids eval, so a condition kept as text would break
  // the extension rather than the test.
  const BOOT = [
@@BOOT@@
  ];

  // On a macrotask, not a microtask. Every feature file is waiting on `arrived`
  // and registers in the microtask that follows it; this runs after all of them.
  // A boot that started here would find the register empty for whichever feature
  // file had not been given its turn, and that feature would simply never run —
  // which is the quietest possible failure and the one this comment is about.
  setTimeout(() => {
    booted = true;
    for (const [step, when, awaited] of BOOT) {
      // The feature's own test, moved here from the list this replaced. A step
      // that should not run is not even looked up.
      if (!when()) continue;
      for (const run of pending[step] || []) {
        if (awaited) {
          run(context).catch(error => reportFeature(step, error));
        } else {
          start(step, run);
        }
      }
    }
  }, 0);
})();
