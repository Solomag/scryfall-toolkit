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

// Scryfall search inside the deck editor.
//
// Behaviour follows Shambleshark's scryfall-search (MIT,
// https://github.com/crookedneighbor/shambleshark), rewritten in plain
// JavaScript. Shambleshark searches Scryfall straight from the page and adds
// saved searches; this goes through the extension's background worker so the
// request is queued with everything else Scryfall, and it does not keep saved
// searches — upstream describes those as not done yet too.
//
// What is here is the part that matters: type a query, see what Scryfall
// returns, put a card in the deck. Searches can be narrowed to the commander's
// colour identity and can keep funny cards out.

(function () {
  'use strict';

  const scryfall = self.STK_DECK_SCRYFALL;
  const bridge = () => self.STK_BRIDGE;

  // --- the deck this is searching for --------------------------------------

  function commanderNames() {
    return scryfall.getDeck().then(deck => {
      const entries = (deck.entries && deck.entries.commanders) || [];
      return entries.filter(e => e.card_digest && e.card_digest.name)
        .map(e => e.card_digest.name);
    });
  }

  // --- the panel ------------------------------------------------------------

  function buildPanel() {
    const holder = document.createElement('div');
    holder.innerHTML = (
      '<div class="modal-dialog-overlay stk-search-panel">' +
        '<div class="modal-dialog stk-account-light-surface stk-search-panel">' +
          '<h6 class="modal-dialog-title stk-account-light-bar">' +
            'Search Scryfall' +
            '<button type="button" title="Close this dialog" class="modal-dialog-close">' +
              '<span aria-hidden="true">&#10005;</span>' +
            '</button>' +
          '</h6>' +
          '<div class="modal-dialog-content stk-search-panel">' +
            '<form class="stk-search-form">' +
              '<input type="text" class="stk-search-input" placeholder="Try: t:creature cmc&lt;=3" autocomplete="off" spellcheck="false">' +
              '<button type="submit" class="button-n primary-n">Search</button>' +
            '</form>' +
            '<p class="stk-search-options">' +
              '<label><input type="checkbox" class="stk-search-identity"> Only the commander\'s colours</label> ' +
              '<label><input type="checkbox" class="stk-search-no-funny"> No funny cards</label>' +
            '</p>' +
            '<div class="stk-search-results"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).trim();
    const overlay = holder.firstElementChild;
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.querySelector('.modal-dialog-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    return {
      overlay,
      form: overlay.querySelector('.stk-search-form'),
      input: overlay.querySelector('.stk-search-input'),
      identity: overlay.querySelector('.stk-search-identity'),
      noFunny: overlay.querySelector('.stk-search-no-funny'),
      results: overlay.querySelector('.stk-search-results'),
      close
    };
  }

  function note(container, text) {
    const p = document.createElement('p');
    p.className = 'stk-search-note';
    p.textContent = text;
    container.replaceChildren(p);
  }

  function resultRow(card) {
    const li = document.createElement('li');
    li.className = 'stk-search-card';

    const name = document.createElement('span');
    name.className = 'stk-search-card-name';
    name.textContent = card.name;

    const type = document.createElement('span');
    type.className = 'stk-search-card-type';
    type.textContent = card.typeLine;
    type.title = card.typeLine;

    const cost = document.createElement('span');
    cost.className = 'stk-search-card-cost';
    cost.textContent = card.manaCost;

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'button-n tiny-n stk-search-add';
    add.textContent = 'Add';
    add.addEventListener('click', () => {
      add.disabled = true;
      scryfall.addCard(card.id).then(result => {
        if (result) {
          add.textContent = 'Added';
          return;
        }
        add.disabled = false;
      }).catch(() => { add.disabled = false; });
    });

    li.append(name, type, cost, add);
    return li;
  }

  // Scryfall's query language is the user's own; this only adds the two
  // qualifiers the checkboxes promise.
  function buildQuery(panel) {
    let query = panel.input.value.trim();
    if (panel.identity.checked && panel.identity.dataset.identity) {
      query += ' id<=' + panel.identity.dataset.identity;
    }
    if (panel.noFunny.checked) query += ' not:funny';
    return query.trim();
  }

  function runSearch(panel, page) {
    const query = buildQuery(panel);
    if (!query) {
      note(panel.results, 'Type something to search for.');
      return;
    }
    note(panel.results, page > 1 ? 'Loading more…' : 'Searching…');

    bridge().request('scryfallSearch', { query: query, page: page }).then(result => {
      const cards = (result && result.cards) || [];
      if (!cards.length) {
        note(panel.results, page > 1 ? 'That is everything Scryfall has.' : 'Nothing found.');
        return;
      }
      const ul = document.createElement('ul');
      ul.className = 'stk-search-list';
      cards.forEach(card => ul.appendChild(resultRow(card)));

      const frag = document.createDocumentFragment();
      frag.appendChild(ul);
      if (result.hasMore) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'button-n stk-search-more';
        more.textContent = 'More results';
        more.addEventListener('click', () => runSearch(panel, page + 1));
        frag.appendChild(more);
      }
      if (page === 1) panel.results.replaceChildren(frag);
      else {
        // Paging appends rather than replacing, so what is already on screen
        // stays where the reader had it.
        panel.results.querySelector('.stk-search-list').append(...ul.childNodes);
        const old = panel.results.querySelector('.stk-search-more');
        if (old) old.remove();
        if (result.hasMore) panel.results.appendChild(frag.querySelector('.stk-search-more'));
      }
    }).catch(error => {
      note(panel.results, 'Search failed. ' + (error && error.message ? error.message : ''));
    });
  }

  // --- wiring ---------------------------------------------------------------

  function openPanel() {
    const panel = buildPanel();
    (document.getElementById('deckbuilder') || document.body).appendChild(panel.overlay);

    // The colour restriction needs to know what the commander's colours are,
    // which is a lookup of its own. Without it the checkbox quietly does
    // nothing rather than guessing.
    commanderNames().then(names => {
      if (!names.length) {
        panel.identity.closest('label').style.display = 'none';
        return;
      }
      return bridge().request('cardIdentity', { name: names[0] }).then(result => {
        const identity = result && result.colorIdentity;
        if (identity) panel.identity.dataset.identity = identity;
        else panel.identity.closest('label').style.display = 'none';
      }).catch(() => {
        panel.identity.closest('label').style.display = 'none';
      });
    }).catch(() => {});

    panel.form.addEventListener('submit', event => {
      event.preventDefault();
      runSearch(panel, 1);
    });
    panel.input.focus();
  }

  function addButton() {
    if (document.getElementById('stk-search-button')) return;
    const host = document.querySelector('.deckbuilder-toolbar-items-right') ||
      document.querySelector('.deckbuilder-toolbar');
    if (!host) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'stk-search-button';
    button.className = 'button-n tiny-n';
    button.textContent = 'Search';
    button.title = 'Search Scryfall and add cards to this deck';
    button.addEventListener('click', event => {
      event.preventDefault();
      openPanel();
    });
    host.appendChild(button);
  }

  let wired = false;

  function apply(config) {
    config = config || {};
    if (!scryfall || !bridge()) {
      return { applied: false, problems: ['the deck modules did not load in order'] };
    }
    if (!wired && config.deckSearch) {
      wired = true;
      // Either of these can land first; adding the button is idempotent, so
      // both are waited for rather than guessing which comes first.
      scryfall.elementReady('.deckbuilder-toolbar', addButton);
      scryfall.elementReady('.deckbuilder-toolbar-items-right', addButton);
    }
    return { applied: wired, problems: scryfall.status().problems };
  }

  self.STK_DECK_SEARCH = {
    apply: apply,
    status: () => ({ applied: wired, problems: scryfall ? scryfall.status().problems : [] })
  };
})();
