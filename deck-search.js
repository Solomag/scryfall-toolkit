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
  const results = self.STK_DECK_RESULTS;
  const bridge = () => self.STK_BRIDGE;

  // The background worker answers in an envelope — {ok, data} or {ok, error} —
  // and the bridge unwraps it. Taking either shape here means the two cannot get
  // out of step and quietly show "nothing found" again.
  function unwrap(result) {
    return result && typeof result === 'object' && !Array.isArray(result) && 'data' in result
      ? result.data : result;
  }

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
      body: overlay.querySelector('.stk-search-results'),
      close
    };
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

  function addCard(card) {
    return scryfall.addCard(card.id).then(result => Boolean(result));
  }

  // --- searching ------------------------------------------------------------

  function runSearch(panel, area, page) {
    const query = buildQuery(panel);
    if (!query) {
      area.message('Type something to search for.');
      return;
    }
    area.message(page > 1 ? 'Loading more…' : 'Searching…');

    bridge().request('scryfallSearch', { query: query, page: page }).then(reply => {
      const result = unwrap(reply) || {};
      const cards = result.cards || [];
      if (!cards.length) {
        area.message(page > 1 ? 'That is everything Scryfall has.' : 'Nothing found.');
        return;
      }
      area.setCards(cards, bridge().request);
      if (result.hasMore) {
        area.showMore(() => runSearch(panel, area, page + 1));
      }
    }).catch(error => {
      area.message('Search failed. ' + (error && error.message ? error.message : ''));
    });
  }

  // --- wiring ---------------------------------------------------------------

  function openPanel() {
    const panel = buildPanel();
    (document.getElementById('deckbuilder') || document.body).appendChild(panel.overlay);
    const area = results.create(panel.body, addCard);

    // The colour restriction needs to know what the commander's colours are,
    // which is a lookup of its own. Without it the checkbox quietly does
    // nothing rather than guessing.
    commanderNames().then(names => {
      if (!names.length) {
        panel.identity.closest('label').style.display = 'none';
        return;
      }
      return bridge().request('cardIdentity', { name: names[0] }).then(reply => {
        const identity = unwrap(reply) && unwrap(reply).colorIdentity;
        if (identity) panel.identity.dataset.identity = identity;
        else panel.identity.closest('label').style.display = 'none';
      }).catch(() => {
        panel.identity.closest('label').style.display = 'none';
      });
    }).catch(() => {});

    panel.form.addEventListener('submit', event => {
      event.preventDefault();
      runSearch(panel, area, 1);
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
    if (!scryfall || !bridge() || !results) {
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
