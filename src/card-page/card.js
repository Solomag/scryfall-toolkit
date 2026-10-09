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

// The type and mana search links.
// Loaded after content-core.js: everything this file needs is on self.STK_CONTENT, and
// nothing here is needed by the files around it. What runs, and in which order, is
// decided in content-core.js — where this file sits in the manifest does not decide it.
(async () => {
  // The settings have not been read yet when this file is injected, so the context is
  // waited for rather than read. Destructuring at load time would give every name
  // below as undefined, and nothing would say so until a feature asked for a card page
  // that was not there.
  const {
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
  } = await self.STK_CONTENT.context;

  function initCardSearchLinks() {
    const typeLine = document.querySelector('#main .card-text-type-line');
    if (typeLine) {
      const indicator = typeLine.querySelector('.color-indicator');
      const text = typeLine.textContent.trim();
      const words = text.split(/(\s+|—)/);
      typeLine.replaceChildren();
      if (indicator) typeLine.append(indicator);
      for (const word of words) {
        if (!word.trim() || word === '—') { typeLine.append(document.createTextNode(word)); continue; }
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`type:${word.toLowerCase()}`)}`;
        link.textContent = word;
        typeLine.append(link);
      }
    }
    const cost = document.querySelector('#main .card-text-mana-cost');
    const symbols = [...(cost?.querySelectorAll('.card-symbol') || [])];
    if (cost && symbols.length) {
      const query = symbols.map(symbol => symbol.textContent.replace(/[{}]/g, '')).join('');
      if (query) {
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`mana="${query}"`)}`;
        while (cost.firstChild) link.append(cost.firstChild);
        cost.append(link);
      }
    }
  }


  self.STK_CONTENT.on("cardSearchLinks", () => initCardSearchLinks());
})();
