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

// The shared results area for the deck editor's panels.
//
// Both EDHREC suggestions and the Scryfall search show the same thing: a list of
// cards that can go into the deck. A row of names is quick to scan and tells you
// nothing about what a card is; a wall of art tells you what it is and hides the
// names. So the reader picks: images or list. This is that control and both
// views, and it is the same one in both panels.

(function () {
  'use strict';

  const VIEWS = ['images', 'list'];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The art and the type line come from Scryfall rather than from whoever
  // supplied the card name, so a list of ids goes out in batches.
  function loadImages(cards, request, done) {
    const missing = cards.filter(card => card.id && !card.image);
    if (!missing.length) {
      done();
      return;
    }
    const batches = [];
    for (let i = 0; i < missing.length; i += 75) batches.push(missing.slice(i, i + 75));
    Promise.all(batches.map(batch => request('cardImages', { ids: batch.map(c => c.id) })))
      .then(replies => {
        const byId = new Map();
        for (const reply of replies) {
          for (const card of (Array.isArray(reply) ? reply : (reply && reply.data) || [])) {
            byId.set(card.id, card);
          }
        }
        for (const card of missing) {
          const found = byId.get(card.id);
          if (!found) continue;
          card.image = found.image || card.image;
          if (!card.typeLine && found.typeLine) card.typeLine = found.typeLine;
          if (!card.manaCost && found.manaCost) card.manaCost = found.manaCost;
        }
      })
      .catch(() => {})
      .then(done);
  }

  function tile(card, onAdd) {
    const wrap = el('li', 'stk-results-tile');

    const art = el('div', 'stk-results-art');
    if (card.image) {
      const img = document.createElement('img');
      img.src = card.image;
      img.alt = card.name || '';
      img.loading = 'lazy';
      art.appendChild(img);
    } else {
      art.appendChild(el('div', 'stk-results-noart', card.name || ''));
    }

    const name = el('div', 'stk-results-name', card.name || '');
    name.title = [card.name, card.typeLine].filter(Boolean).join('\n');

    const add = el('button', 'button-n tiny-n stk-results-add', 'Add');
    add.type = 'button';
    add.addEventListener('click', () => {
      add.disabled = true;
      onAdd(card).then(ok => {
        if (ok) {
          add.textContent = 'Added';
          return;
        }
        add.disabled = false;
      }).catch(() => { add.disabled = false; });
    });

    wrap.append(art, name, add);
    return wrap;
  }

  function row(card, onAdd) {
    const li = el('li', 'stk-results-row');

    const name = el('span', 'stk-results-row-name', card.name || '');
    name.title = card.typeLine || '';
    const type = el('span', 'stk-results-row-type', card.typeLine || '');
    const cost = el('span', 'stk-results-row-cost', card.manaCost || '');
    const meta = card.meta ? el('span', 'stk-results-row-meta', card.meta) : el('span', 'stk-results-row-meta');

    const add = el('button', 'button-n tiny-n stk-results-add', 'Add');
    add.type = 'button';
    add.addEventListener('click', () => {
      add.disabled = true;
      onAdd(card).then(ok => {
        if (ok) {
          add.textContent = 'Added';
          return;
        }
        add.disabled = false;
      }).catch(() => { add.disabled = false; });
    });

    li.append(name, type, cost, meta, add);
    return li;
  }

  // `host` is where the whole thing goes. `onAdd` answers with true when the
  // card was taken.
  function create(host, onAdd) {
    const bar = el('div', 'stk-results-bar');
    const toggle = el('div', 'stk-results-toggle');
    const buttons = {};
    for (const view of VIEWS) {
      const button = el('button', 'stk-results-view', view === 'images' ? 'Images' : 'List');
      button.type = 'button';
      button.addEventListener('click', () => setView(view));
      buttons[view] = button;
      toggle.appendChild(button);
    }
    bar.appendChild(toggle);

    const body = el('div', 'stk-results-body');
    host.append(bar, body);

    let view = 'images';
    let cards = [];
    let moreFn = null;

    function setView(next) {
      view = next;
      for (const key of VIEWS) buttons[key].classList.toggle('active', key === view);
      render();
    }

    function render() {
      if (!cards.length) return;
      const frag = document.createDocumentFragment();
      // EDHREC groups its cards; a plain search has nothing to group. Grouping
      // is therefore optional and a list without it is just a list.
      const groups = [];
      const byGroup = new Map();
      for (const card of cards) {
        const key = card.group || '';
        if (!byGroup.has(key)) {
          byGroup.set(key, []);
          groups.push(key);
        }
        byGroup.get(key).push(card);
      }
      for (const key of groups) {
        const list = el('ul', view === 'images' ? 'stk-results-grid' : 'stk-results-list');
        for (const card of byGroup.get(key)) {
          list.appendChild(view === 'images' ? tile(card, onAdd) : row(card, onAdd));
        }
        if (key) {
          const wrap = el('div', 'stk-results-group');
          wrap.append(el('h3', 'stk-results-group-title', key), list);
          frag.appendChild(wrap);
        } else {
          frag.appendChild(list);
        }
      }
      // The way to the next page is part of the results, not a sibling of them,
      // or the next redraw of the list takes it with it.
      if (moreFn) {
        const button = el('button', 'button-n stk-results-more', 'More results');
        button.type = 'button';
        button.addEventListener('click', () => {
          const next = moreFn;
          moreFn = null;
          render();
          next();
        });
        frag.appendChild(button);
      }
      body.replaceChildren(frag);
    }

    setView('images');

    return {
      setCards(next, then) {
        cards = next || [];
        moreFn = null;
        loadImages(cards, then, render);
        if (cards.length) render();
      },
      setView,
      message(text) {
        body.replaceChildren(el('p', 'stk-results-note', text));
      },
      // Scryfall pages its searches. This is the way to ask for the next one.
      showMore(next) {
        moreFn = next;
        render();
      }
    };
  }

  self.STK_DECK_RESULTS = { create: create, loadImages: loadImages };
})();
