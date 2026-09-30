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
// names. So the reader picks: images or list. Whichever they picked last is the
// one that comes up, in either panel.
//
// Adding a card is undoable. A click in a list of fifty cards is where mistakes
// happen, and an "Add" that cannot be taken back leaves the reader hunting for
// the card in the deck behind the window.

(function () {
  'use strict';

  const VIEWS = ['images', 'list'];
  const bridge = () => self.STK_BRIDGE;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // --- Scryfall's query words, over the fields a card carries ----------------
  //
  // The filter is not a second search box, but it does understand the words
  // Scryfall uses, over the data already on the cards. What it does not
  // understand it says so about rather than quietly matching nothing.

  const KNOWN_KEYS = ['t', 'type', 'o', 'oracle', 'c', 'color', 'ci', 'identity', 'cmc', 'pow', 'tou', 'r', 'rarity', 'is', 'name'];

  function tokens(query) {
    const out = [];
    // `t:creature`, `cmc<=3`, `-o:"draw a card"`, or a bare word for the name.
    // The key is optional, and so is what joins it: Scryfall writes `t:creature`
    // with a colon and `cmc<=3` with the operator alone.
    for (const match of String(query).matchAll(/(-?)(?:([a-z]+)(:|<=|>=|<|>|=))?("[^"]*"|\S+)/gi)) {
      out.push({
        negate: match[1] === '-',
        key: (match[2] || '').toLowerCase(),
        op: match[3] || '=',
        value: match[4].replace(/^"|"$/g, '').toLowerCase()
      });
    }
    return out;
  }

  const coloursIn = cost => (String(cost).match(/\{([wubrg])\}/gi) || []).map(c => c[1].toLowerCase());

  function matches(card, query) {
    const words = tokens(query);
    if (!words.length) return { ok: true, unknown: null };
    let unknown = null;
    const holds = words.map(word => {
      const type = String(card.typeLine || '').toLowerCase();
      const text = String(card.oracleText || '').toLowerCase();
      const cost = String(card.manaCost || '');
      const name = String(card.name || '').toLowerCase();
      const identity = String(card.colorIdentity || '') + coloursIn(cost).join('');
      let found = true;
      switch (word.key) {
        case '': case 'name':
          found = name.includes(word.value);
          break;
        case 't': case 'type':
          found = type.includes(word.value);
          break;
        case 'o': case 'oracle':
          found = text.includes(word.value);
          break;
        case 'c': case 'color':
          found = [...word.value].every(colour => identity.includes(colour));
          break;
        case 'ci': case 'identity':
          found = [...word.value].every(colour => identity.includes(colour));
          break;
        case 'cmc': {
          const number = Number(card.cmc);
          const target = Number(word.value.replace(/^[<>=]+/, ''));
          if (!Number.isFinite(number) || !Number.isFinite(target)) { found = false; break; }
          found = { '<=': number <= target, '>=': number >= target, '<': number < target, '>': number > target }[word.op] ??
            number === target;
          break;
        }
        case 'pow': case 'tou': {
          const raw = word.key === 'pow' ? card.power : card.toughness;
          const number = Number(raw);
          const target = Number(word.value.replace(/^[<>=]+/, ''));
          if (!Number.isFinite(number) || !Number.isFinite(target)) { found = false; break; }
          found = { '<=': number <= target, '>=': number >= target, '<': number < target, '>': number > target }[word.op] ??
            number === target;
          break;
        }
        case 'r': case 'rarity':
          found = String(card.rarity || '').toLowerCase().startsWith(word.value);
          break;
        case 'is':
          found = word.value === 'creature' ? /\bcreature\b/.test(type)
            : word.value === 'land' ? /\bland\b/.test(type)
            : word.value === 'commander' ? /\blegendary\b/.test(type) && /\b(creature|planeswalker)\b/.test(type)
            : false;
          break;
        default:
          found = true;
          if (unknown === null) unknown = word.key;
      }
      return word.negate ? !found : found;
    });
    return { ok: holds.every(Boolean), unknown };
  }

  function loadImages(cards, request, done) {
    const missing = cards.filter(card => (card.id || card.printing) && !card.image);
    if (!missing.length) {
      done();
      return;
    }
    const batches = [];
    for (let i = 0; i < missing.length; i += 75) batches.push(missing.slice(i, i + 75));
    Promise.all(batches.map(batch => request('cardImages', {
      ids: batch.filter(c => c.id).map(c => c.id),
      printings: batch.filter(c => !c.id && c.printing).map(c => c.printing)
    })))
      .then(replies => {
        const byKey = new Map();
        for (const reply of replies) {
          for (const card of (Array.isArray(reply) ? reply : (reply && reply.data) || [])) {
            byKey.set('id:' + card.id, card);
          }
        }
        for (const card of missing) {
          const found = (card.id && byKey.get('id:' + card.id)) ||
            [...byKey.values()].find(item => item.name && card.name &&
              item.name.toLowerCase() === String(card.name).toLowerCase().replace(/ \/\/ .*/, ''));
          if (!found) continue;
          for (const field of ['image', 'typeLine', 'manaCost', 'oracleText', 'cmc', 'colors', 'colorIdentity', 'power', 'toughness', 'rarity']) {
            if (card[field] === undefined || card[field] === '' || card[field] === null) card[field] = found[field];
          }
          if (!card.id) card.id = found.id;
        }
      })
      .catch(() => {})
      .then(done);
  }

  // --- adding, and taking it back -------------------------------------------

  // Answers with nothing, and hands back a function that undoes the addition.
  function makeAdd(handlers, card, button) {
    return () => {
      button.disabled = true;
      handlers.add(card).then(undo => {
        button.disabled = false;
        if (!undo) return;
        button.textContent = 'Remove';
        button.classList.add('is-added');
        button.onclick = () => {
          button.disabled = true;
          undo().then(() => {
            button.textContent = 'Add';
            button.classList.remove('is-added');
            button.disabled = false;
            button.onclick = null;
          }).catch(() => { button.disabled = false; });
        };
      }).catch(() => { button.disabled = false; });
    };
  }

  // --- the two views --------------------------------------------------------

  function tile(card, handlers) {
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

    // EDHREC's number sits with the name, where it is looked for.
    const line = el('div', 'stk-results-line');
    line.append(name);
    if (card.meta) {
      const meta = el('span', 'stk-results-meta', card.meta);
      if (card.metaTitle) meta.title = card.metaTitle;
      line.appendChild(meta);
    }

    const add = el('button', 'button-n tiny-n stk-results-add', 'Add');
    add.type = 'button';
    add.onclick = makeAdd(handlers, card, add);

    wrap.append(art, line, add);
    // No preview here: the art is the tile. A bigger tile does more for the
    // reader than a second copy of the same picture under the pointer.
    return wrap;
  }

  function row(card, handlers) {
    const li = el('li', 'stk-results-row');

    const name = el('span', 'stk-results-row-name', card.name || '');
    const type = el('span', 'stk-results-row-type', card.typeLine || '');
    const cost = el('span', 'stk-results-row-cost', card.manaCost || '');
    const meta = el('span', 'stk-results-row-meta', card.meta || '');
    if (card.meta && card.metaTitle) meta.title = card.metaTitle;

    const add = el('button', 'button-n tiny-n stk-results-add', 'Add');
    add.type = 'button';
    add.onclick = makeAdd(handlers, card, add);

    li.append(name, type, cost, meta, add);
    // The row is names only, so the card is one hover away — over the name and
    // nowhere else. Over the Add button a preview only gets in the way of the
    // click it is covering.
    handlers.preview(name, card);
    return li;
  }

  // --- a card that follows the pointer --------------------------------------

  // Inside the panel rather than Scryfall's own tooltip: their tooltip is what
  // covers the deck editor, and this only ever appears over its own list.
  function createPreview(host) {
    const box = el('div', 'stk-results-preview');
    const img = document.createElement('img');
    img.alt = '';
    box.appendChild(img);
    host.appendChild(box);

    return function attach(node, card) {
      node.addEventListener('mouseenter', () => {
        if (!card.image) return;
        img.src = card.image;
        box.style.display = 'block';
      });
      node.addEventListener('mousemove', event => {
        // Kept inside the panel's own box so a card at the edge cannot be
        // half off the window.
        const bounds = host.getBoundingClientRect();
        const x = event.clientX - bounds.left + 18;
        const y = event.clientY - bounds.top - 120;
        box.style.left = Math.max(0, Math.min(x, bounds.width - 220)) + 'px';
        box.style.top = Math.max(0, y) + 'px';
      });
      node.addEventListener('mouseleave', () => { box.style.display = 'none'; });
    };
  }

  // --- the area -------------------------------------------------------------

  function create(host, addFn, options) {
    const opts = options || {};
    const bar = el('div', 'stk-results-bar');

    // Only where there is more on screen than a search already narrowed. The
    // Scryfall panel has a query box; filtering its results again is a second
    // box doing the first box's job.
    const filter = document.createElement('input');
    if (opts.filter !== false) {
      filter.type = 'text';
      filter.className = 'stk-results-filter';
      filter.placeholder = 'Filter: t:creature cmc<3 -o:fly';
      filter.title = 'Scryfall words, over the cards on screen: t: o: c: ci: cmc pow tou r: is: name:, and a bare word for the name. A leading – excludes.';
      filter.setAttribute('aria-label', 'Filter these cards');
      bar.appendChild(filter);
    }

    const toggle = el('div', 'stk-results-toggle');
    const buttons = {};
    for (const view of VIEWS) {
      const button = el('button', 'stk-results-view', view === 'images' ? 'Images' : 'List');
      button.type = 'button';
      button.addEventListener('click', () => setView(view, true));
      buttons[view] = button;
      toggle.appendChild(button);
    }
    bar.appendChild(toggle);

    const body = el('div', 'stk-results-body');
    host.append(bar, body);

    // The last view the reader chose is the one that comes up next, in either
    // panel. page.js hands it over with the rest of the settings.
    let view = VIEWS.includes(self.STK_DECK_VIEW) ? self.STK_DECK_VIEW : 'images';
    let cards = [];
    let moreFn = null;
    const preview = createPreview(host);
    const withPreview = {
      add: addFn,
      preview
    };

    // A small line beside the results rather than instead of them: what the
    // filter did not understand, how much was left out.
    function note(text) {
      const old = host.querySelector('.stk-results-aside');
      if (old) old.remove();
      if (text) bar.appendChild(el('span', 'stk-results-aside', text));
    }

    function setView(next, remember) {
      view = next;
      for (const key of VIEWS) buttons[key].classList.toggle('active', key === view);
      if (remember && bridge()) bridge().request('setDeckResultsView', { view: view });
      render();
    }

    function visibleCards() {
      const needle = filter.value.trim();
      if (!needle) return cards;
      return cards.filter(card => matches(card, needle).ok);
    }

    filter.addEventListener('input', () => {
      render();
      // If the reader typed a term this does not know, say which one rather
      // than leaving an empty list and no reason.
      const unknown = [...new Set(cards.map(card => matches(card, filter.value.trim()).unknown).filter(Boolean))];
      if (filter.value.trim() && unknown.length) {
        note('not understood here: ' + unknown.map(key => key + ':').join(' '));
      } else {
        note('');
      }
    });

    function render() {
      const shown = visibleCards();
      if (!cards.length) return;
      if (!shown.length) {
        body.replaceChildren(el('p', 'stk-results-note', 'Nothing here matches “' + filter.value.trim() + '”.'));
        return;
      }
      const frag = document.createDocumentFragment();
      // EDHREC groups its cards; a plain search has nothing to group. Grouping
      // is therefore optional and a list without it is just a list.
      const groups = [];
      const byGroup = new Map();
      for (const card of shown) {
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
          list.appendChild(view === 'images' ? tile(card, withPreview) : row(card, withPreview));
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

    for (const key of VIEWS) buttons[key].classList.toggle('active', key === view);

    return {
      hasCards() { return cards.length > 0; },
      setCards(next, then) {
        cards = next || [];
        moreFn = null;
        filter.value = '';
        loadImages(cards, then, render);
        if (cards.length) render();
      },
      setView,
      message(text) {
        body.replaceChildren(el('p', 'stk-results-note', text));
      },
      note,
      // Scryfall pages its searches. This is the way to ask for the next one.
      showMore(next) {
        moreFn = next;
        render();
      }
    };
  }

  self.STK_DECK_RESULTS = { create: create, loadImages: loadImages, matches: matches, tokens: tokens };
})();
