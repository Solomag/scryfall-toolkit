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

// The finish column: a narrow column beside the printing names, saying which finishes a
// printing is available in. It used to share this file with the grouped printings table,
// which is gone; the finish column is the whole of it now.
//
// Loaded after content-core.js: everything this file needs is on self.STK_CONTENT, and
// nothing here is needed by the files around it. What runs, and in which order, is
// decided in content-core.js — where this file sits in the manifest does not decide it.
(async () => {
  // The settings have not been read yet when this file is injected, so the context is
  // waited for rather than read. Destructuring at load time would give every name
  // below as undefined, and nothing would say so until a feature asked for a card page
  // that was not there.
  const {
    language,
    t,
    request
  } = await self.STK_CONTENT.context;

  function initPrintFinishes() {
    const table = document.querySelector('#main .prints > .prints-table');
    const printLinks = [...(table?.querySelectorAll('tbody tr td:first-child a[data-card-id]') || [])];
    const ids = [...new Set(printLinks.map(link => link.dataset.cardId))];
    if (!ids.length || ids.length > 75) return;
    request({ type: 'finishes', ids }).then(byId => {
      const marked = [];
      for (const link of printLinks) {
        const entry = byId[link.dataset.cardId];
        const finishes = Array.isArray(entry) ? entry : entry?.finishes;
        if (!Array.isArray(finishes)) continue;
        const special = entry?.promoTypes?.find(type => /^(surgefoil|textured|galaxyfoil|confettifoil|fracturefoil|halofoil|gilded|rainbowfoil|cosmicfoil)$/.test(type));
        const kind = special && finishes.length === 1 && finishes.includes('foil') ? 'special' : finishes.length === 1 ? finishes[0] : null;
        if (!['foil','nonfoil','etched','special'].includes(kind)) continue;
        // Scryfall already prints ★ in a foil-only collector number.
        if (kind === 'foil' && /★|✶/.test(link.textContent)) continue;
        marked.push({ link, kind, special });
      }
      if (!marked.length || !table || table.querySelector('.stk-finish-header')) return;
      const header = document.createElement('th');
      header.className = 'stk-finish-header';
      header.title = t('Отделка выпуска');
      header.setAttribute('aria-label', header.title);
      table.querySelector('thead th')?.after(header);
      const byLink = new Map(marked.map(item => [item.link, item]));
      for (const link of printLinks) {
        const cell = document.createElement('td');
        cell.className = 'stk-finish-cell';
        link.closest('tr')?.children[0]?.after(cell);
        const item = byLink.get(link);
        if (!item) continue;
        const badge = document.createElement('span');
        badge.className = `stk-finish-badge stk-finish-${item.kind}`;
        badge.title = item.kind === 'special' ? (language === 'ru' ? `Особый фойл: ${item.special}` : `Special foil: ${item.special}`) : t({ foil:'Только Foil', nonfoil:'Только Nonfoil', etched:'Только Etched Foil' }[item.kind]);
        badge.setAttribute('aria-label', badge.title);
        badge.textContent = { foil:'✶', nonfoil:'○', etched:'◈', special:'✧' }[item.kind];
        cell.append(badge);
      }
      // Scryfall marks a foil-only printing with a star inside the price cells.
      // The finish column already says it, so the star is dropped there.
      for (const price of table.querySelectorAll('td .currency-usd, td .currency-usd-promo, td .currency-eur, td .currency-tix')) {
        const textNode = [...price.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
        if (textNode) textNode.textContent = textNode.textContent.replace(/^[\s✶★]+/, '');
      }
    }).catch(() => {});
  }

  self.STK_CONTENT.on("printFinishes", () => initPrintFinishes());
})();
