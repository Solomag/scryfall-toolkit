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
    // The panel is built as nodes rather than parsed from a string, so nothing here
    // reaches the HTML parser: the title, the labels and the close glyph are set as
    // text and cannot be read as markup.
    const overlay = document.createElement('div');
    overlay.className = 'modal-dialog-overlay stk-search-panel';
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog stk-account-light-surface stk-search-panel';
    const title = document.createElement('h6');
    title.className = 'modal-dialog-title stk-account-light-bar';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.title = 'Close this dialog';
    closeButton.className = 'modal-dialog-close';
    const closeGlyph = document.createElement('span');
    closeGlyph.setAttribute('aria-hidden', 'true');
    closeGlyph.textContent = '\u2715';
    closeButton.append(closeGlyph);
    title.append('Search Scryfall', closeButton);
    const content = document.createElement('div');
    content.className = 'modal-dialog-content stk-search-panel';
    const form = document.createElement('form');
    form.className = 'stk-search-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'stk-search-input';
    input.placeholder = 'Try: t:creature cmc<=3';
    // Set as attributes rather than properties: `autocomplete` and `spellcheck`
    // are content attributes here, and only the attribute form is guaranteed to
    // reach the markup across DOM implementations.
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'button-n primary-n';
    submit.textContent = 'Search';
    form.append(input, submit);
    const options = document.createElement('p');
    options.className = 'stk-search-options';
    const identityLabel = document.createElement('label');
    const identity = document.createElement('input');
    identity.type = 'checkbox';
    identity.className = 'stk-search-identity';
    identityLabel.append(identity, " Only the commander's colours");
    const noFunnyLabel = document.createElement('label');
    const noFunny = document.createElement('input');
    noFunny.type = 'checkbox';
    noFunny.className = 'stk-search-no-funny';
    // `checked` is a content attribute, so it is set as one: the property alone
    // would leave the markup without the default this panel has always had.
    noFunny.setAttribute('checked', '');
    noFunny.checked = true;
    noFunnyLabel.append(noFunny, ' Exclude funny cards');
    options.append(identityLabel, ' ', noFunnyLabel);
    const body = document.createElement('div');
    body.className = 'stk-search-results';
    content.append(form, options, body);
    dialog.append(title, content);
    overlay.append(dialog);
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

  // Answers with a way to take the addition back, or with nothing if Scryfall
  // did not take the card.
  function addCard(card) {
    return scryfall.addCard(card.id).then(entry => {
      if (!entry) return null;
      const entryId = typeof entry === 'string' ? entry : entry.id;
      if (!entryId) return null;
      return () => scryfall.removeEntry(entryId).then(() => undefined);
    });
  }

  // --- what EDHREC knows about these cards ----------------------------------

  // EDHREC's commander page is where "how many of this commander's decks play
  // it" lives. A search cannot ask EDHREC per card, but it does not have to:
  // the page already carries that number for every card it lists, and the
  // background worker caches it. Cards EDHREC does not list simply get nothing.
  const canonical = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let ratesPromise = null;
  let edhrecAllowed = false;

  function commanderRates() {
    // EDHREC is optional and off until it is switched on, and the privacy
    // policy says the card and commander names go there only when it is. A
    // search asking EDHREC on its own would break that, so it does not.
    if (!edhrecAllowed) return Promise.resolve(new Map());
    if (ratesPromise) return ratesPromise;
    ratesPromise = commanderNames().then(names => {
      if (!names.length) return new Map();
      return bridge().request('edhrecCommander', { name: names[0] }).then(reply => {
        const lists = unwrap(reply);
        const map = new Map();
        for (const list of (Array.isArray(lists) ? lists : [])) {
          for (const card of list.cards) {
            if (!Number.isFinite(card.numDecks) || !Number.isFinite(card.potentialDecks) || !card.potentialDecks) continue;
            const pct = Math.round((card.numDecks / card.potentialDecks) * 100) + '%';
            map.set(canonical(card.name), pct);
          }
        }
        return map;
      }).catch(() => new Map());
    }).catch(() => new Map());
    return ratesPromise;
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
      // The query as it was actually run, so what the checkboxes did is on the
      // screen rather than assumed.
      return commanderRates().then(rates => {
        for (const card of cards) {
          const pct = rates.get(canonical(card.name));
          if (pct) {
            card.meta = pct;
            card.metaTitle = 'EDHREC: ' + pct + ' of decks playing this commander also play this card';
          }
        }
        area.setCards(cards, bridge().request);
        area.note('ran: ' + query);
        if (result.hasMore) {
          area.showMore(() => runSearch(panel, area, page + 1));
        }
      });
    }).catch(error => {
      area.message('Search failed. ' + (error && error.message ? error.message : ''));
    });
  }

  // --- wiring ---------------------------------------------------------------

  function openPanel() {
    const panel = buildPanel();
    (document.getElementById('deckbuilder') || document.body).appendChild(panel.overlay);
    const area = results.create(panel.body, addCard, { filter: false });

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

  let wired = false;      // the feature is on, so the button belongs on the page
  let watching = false;   // the elementReady handlers are registered

  function apply(config) {
    config = config || {};
    if (!scryfall || !bridge() || !results) {
      return { applied: false, problems: ['the deck modules did not load in order'] };
    }
    if (config.deckSearch) {
      wired = true;
      edhrecAllowed = Boolean(config.edhrecSuggestions);
      if (!watching) {
        watching = true;
        // Either of these can land first; adding the button is idempotent, so both are waited
        // for rather than guessing which comes first. The handler checks `wired`, so a feature
        // turned off does not put the button back when a late element arrives.
        const tryAdd = () => { if (wired) addButton(); };
        scryfall.elementReady('.deckbuilder-toolbar', tryAdd);
        scryfall.elementReady('.deckbuilder-toolbar-items-right', tryAdd);
      }
      addButton();
    }
    return { applied: wired, problems: scryfall.status().problems };
  }

  // The feature turned off: take the button away. The element handlers stay registered — the
  // adapter has no way to remove one — but they do nothing while `wired` is false.
  function disable() {
    wired = false;
    document.getElementById('stk-search-button')?.remove();
  }

  self.STK_DECK_SEARCH = {
    apply: apply,
    disable: disable,
    status: () => ({ applied: wired, problems: scryfall ? scryfall.status().problems : [] })
  };
})();
