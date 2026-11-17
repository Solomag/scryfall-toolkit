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

// How many copies the reader owns, from the collection loaded on the settings page
// (src/core/collection.js reads the export). Three places:
//
//   - a card page: the copies of the card, and of the printing on screen;
//   - search results: a small count on each card the reader has;
//   - a deck page: each row says how many are owned, and a row the collection does not
//     cover in full is marked, so what is still missing can be read down the list.
//
// Nothing is fetched: the counts are in storage, and the page already says which card
// each element is.
(() => {
  self.STK_CONTENT.on("ownedCounts", async () => {
    const { cardPage, identity } = await self.STK_CONTENT.context;
    const { collection } = await chrome.storage.local.get({ collection: null });
    if (!collection || !collection.byCard) return;
    const { owned } = self.STK_COLLECTION;
    const nameOfCardPage = () => [...document.querySelectorAll('#main .card-text-card-name')]
      .map(node => node.textContent.trim()).filter(Boolean)[0] || '';

    if (cardPage) {
      const title = document.querySelector('#main .card-text-title') ||
        document.querySelector('#main .card-text-card-name')?.parentElement;
      const counts = owned(collection, { name: nameOfCardPage(), set: identity?.set, number: identity?.number });
      if (title && counts && !title.querySelector('.stk-owned')) {
        const badge = document.createElement('span');
        badge.className = 'stk-owned' + (counts.card ? '' : ' stk-owned-none');
        badge.textContent = counts.card ? `Owned ×${counts.card}` : 'Not in your collection';
        if (counts.card && counts.print !== null) {
          badge.title = `${counts.print} of this printing, ${counts.card} of the card in all`;
          if (counts.print) badge.textContent += ` (this printing ×${counts.print})`;
        }
        title.append(badge);
      }
    }

    const markGrid = () => {
      for (const item of document.querySelectorAll('.card-grid-item:not([aria-hidden="true"])')) {
        if (item.querySelector(':scope > .stk-owned-count')) continue;
        const name = item.querySelector('.card-grid-item-invisible-label')?.textContent.trim() ||
          item.querySelector('img[alt]')?.getAttribute('alt')?.split(' (')[0];
        const href = item.querySelector('a.card-grid-item-card[href]')?.getAttribute('href') || '';
        const path = href && new URL(href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
        const counts = name && owned(collection, { name, set: path?.[1], number: path && decodeURIComponent(path[2]) });
        if (!counts || !counts.card) continue;
        const badge = document.createElement('span');
        badge.className = 'stk-owned-count';
        badge.textContent = '×' + counts.card;
        badge.title = counts.print ? `You own ${counts.card} (${counts.print} of this printing)` : `You own ${counts.card}`;
        item.append(badge);
      }
    };

    const markDeck = () => {
      for (const row of document.querySelectorAll('.deck-list-entry')) {
        if (row.querySelector('.stk-owned-row')) continue;
        const name = row.querySelector('.deck-list-entry-name')?.textContent.trim();
        if (!name) continue;
        const need = Number(row.querySelector('.deck-list-entry-count')?.textContent.trim()) || 1;
        const have = owned(collection, { name })?.card || 0;
        const mark = document.createElement('span');
        mark.className = 'stk-owned-row' + (have >= need ? '' : ' stk-owned-short');
        mark.textContent = have >= need ? `✓${have}` : `${have}/${need}`;
        mark.title = have >= need ? `You own ${have}` : `You own ${have} of the ${need} this deck plays`;
        row.querySelector('.deck-list-entry-name')?.after(mark);
      }
    };

    markGrid();
    if (/^\/@[^/]+\/decks\//.test(location.pathname)) markDeck();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        markGrid();
        if (/^\/@[^/]+\/decks\//.test(location.pathname)) markDeck();
      }, 150);
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
