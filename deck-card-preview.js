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

// The card preview on hover in the deck editor.
//
// Behaviour follows Shambleshark's card-input-modifier and card-tooltip (MIT,
// https://github.com/crookedneighbor/shambleshark), rewritten for this project
// in plain JavaScript. Hovering a row in the deck editor shows the card's
// image, and both faces of a double-faced card side by side.
//
// The preview reuses Scryfall's own #card-tooltip element and its .card and
// .two-up classes rather than building a second tooltip. That is one more thing
// tied to Scryfall's markup — see docs/scryfall-dom.md — but it means the
// preview looks like the rest of the site instead of like an add-on.

(function () {
  'use strict';

  const tools = self.STK_DECK_TOOLS;
  const scryfall = self.STK_DECK_SCRYFALL;

  // --- waiting for elements that arrive later -------------------------------

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
          scryfall.report('element handler for ' + entry.selector + ' threw', error);
        }
      });
    });
  }

  // Fires for every element matching the selector that is in the document now
  // or appears later. The deck editor builds its rows as cards are added.
  function elementReady(selector, fn) {
    waiting.push({ selector, fn, seen: [] });
    if (!observer && typeof MutationObserver === 'function') {
      observer = new MutationObserver(checkWaiting);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    checkWaiting();
  }

  // --- what Scryfall gives us to show the preview in ------------------------

  function tooltipElement() {
    return document.getElementById('card-tooltip');
  }

  // --- the image cache ------------------------------------------------------

  const imageCache = Object.create(null);
  const attached = Object.create(null);
  let entriesPromise = null;

  function getEntries(bustCache) {
    if (!entriesPromise || bustCache) {
      entriesPromise = scryfall.getDeck().then(deck => tools.flattenEntries(deck, { idToGroupBy: 'id' }));
    }
    return entriesPromise;
  }

  function lookupImage(id, bustCache) {
    if (!bustCache && id in imageCache) return Promise.resolve(imageCache[id]);
    return getEntries(!bustCache).then(entries => {
      const entry = entries.find(e => e.id === id);
      const digest = entry && entry.card_digest;
      const front = digest && digest.image_uris && digest.image_uris.front;
      if (!front) return { front: '' };
      imageCache[id] = {
        front: front,
        back: (digest.image_uris && digest.image_uris.back) || ''
      };
      return imageCache[id];
    }).catch(() => ({ front: '' }));
  }

  // Cards come and go while the editor is open, so the cache is rebuilt after
  // Scryfall is done handling an edit.
  function refreshCache() {
    return new Promise(resolve => setTimeout(resolve, 1000)).then(() => getEntries(true)).then(entries => {
      entries.forEach(entry => {
        const digest = entry.card_digest;
        imageCache[entry.id] = {
          front: (digest && digest.image_uris && digest.image_uris.front) || '',
          back: (digest && digest.image_uris && digest.image_uris.back) || ''
        };
      });
    }).catch(error => {
      scryfall.report('refreshing the card image cache threw', error);
    });
  }

  // --- showing it -----------------------------------------------------------

  function showPreview(row, event) {
    const tooltip = tooltipElement();
    if (!tooltip) return;
    // Below this width there is no room to be worth showing a card over.
    if (typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 768) return;

    const id = row.getAttribute('data-entry');
    const images = id && imageCache[id];
    if (!images || !images.front) {
      tooltip.style.display = 'none';
      return;
    }

    tooltip.className = images.back ? 'two-up' : '';
    tooltip.style.display = 'flex';
    if (event && typeof event.pageX === 'number') {
      tooltip.style.left = (event.pageX + 50) + 'px';
      tooltip.style.top = (event.pageY - 30) + 'px';
    }

    setFace(tooltip, 'card-tooltip-img-front', images.front);
    setFace(tooltip, 'card-tooltip-img-back', images.back);
  }

  // Only the face whose image actually changed is replaced, so the browser does
  // not re-decode a card it is already showing.
  function setFace(tooltip, id, src) {
    const existing = document.getElementById(id);
    if (!src) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing && existing.getAttribute('src') === src) return;
    const img = document.createElement('img');
    img.id = id;
    img.className = 'card';
    img.src = src;
    img.alt = '';
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    tooltip.appendChild(img);
  }

  function hidePreview() {
    const tooltip = tooltipElement();
    if (tooltip) tooltip.style.display = 'none';
  }

  function attachToRow(row) {
    const id = row.getAttribute('data-entry');
    if (!id || attached[id] === row) return;
    attached[id] = row;

    lookupImage(id);
    row.addEventListener('mousemove', event => {
      // The cache may not have landed yet; ask again rather than showing nothing.
      if (!(id in imageCache)) {
        lookupImage(id, true).then(() => showPreview(row, event));
        return;
      }
      showPreview(row, event);
    });
    row.addEventListener('mouseout', hidePreview);
  }

  // --- the outside interface ------------------------------------------------

  let applied = false;

  function apply(config) {
    config = config || {};
    if (!tools || !scryfall) {
      return { applied: false, problems: ['the deck modules did not load in order'] };
    }
    if (!applied && config.cardPreviewOnHover) {
      applied = true;
      scryfall.install();
      try {
        scryfall.on('deck-method-called', data => {
          if (data && data.method === 'destroyEntry') {
            delete imageCache[String(data.payload)];
            return;
          }
          refreshCache();
        });
        elementReady('.deckbuilder-entry', attachToRow);
      } catch (error) {
        scryfall.report('wiring the card preview failed', error);
        applied = false;
      }
    }
    return { applied: applied, problems: scryfall.status().problems };
  }

  self.STK_DECK_CARD_PREVIEW = {
    apply: apply,
    status: () => ({ applied: applied, problems: scryfall ? scryfall.status().problems : [] })
  };
})();
