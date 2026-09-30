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

// EDHREC suggestions for a commander deck.
//
// Shambleshark has a feature of the same name that works by parking a hidden
// iframe on edhrec.com and asking it for recommendations. This does not do
// that. EDHREC publishes public JSON for a commander's page, and that page
// already carries its card lists grouped and ranked, each card with the Scryfall
// id this needs to add it to a deck. So this reads the same public JSON the
// rest of the extension reads, through the same queue and the same rate
// EDHREC's published data policy asks for.
//
// What is shown is EDHREC's own grouping and EDHREC's own numbers: how many of
// the decks tracking that commander play the card. Nothing is recomputed here.

(function () {
  'use strict';

  const scryfall = self.STK_DECK_SCRYFALL;
  const results = self.STK_DECK_RESULTS;
  // page.js is what defines the bridge and it loads after this file, so it is
  // looked up when it is needed rather than when this runs.
  const bridge = () => self.STK_BRIDGE;

  // The background worker answers in an envelope — {ok, data} or {ok, error} —
  // and the bridge unwraps it. Taking either shape here means the two cannot get
  // out of step and quietly show "nothing to suggest" again.
  function unwrap(result) {
    return result && typeof result === 'object' && !Array.isArray(result) && 'data' in result
      ? result.data : result;
  }

  // --- is this a commander deck ---------------------------------------------

  function isCommanderDeck() {
    return [...document.querySelectorAll('.deckbuilder-section-title')]
      .some(title => /commander/i.test(title.textContent || ''));
  }

  function commanderName() {
    return scryfall.getDeck().then(deck => {
      const entries = (deck.entries && deck.entries.commanders) || [];
      const first = entries.find(entry => entry.card_digest && entry.card_digest.name);
      return first ? first.card_digest.name : '';
    });
  }

  // --- the panel ------------------------------------------------------------

  function panelMarkup() {
    return '' +
      '<div class="modal-dialog-overlay stk-edhrec-panel">' +
        '<div class="modal-dialog stk-account-light-surface stk-edhrec-panel">' +
          '<h6 class="modal-dialog-title stk-account-light-bar">' +
            'EDHREC suggestions' +
            '<button type="button" title="Close this dialog" class="modal-dialog-close">' +
              '<span aria-hidden="true">&#10005;</span>' +
            '</button>' +
          '</h6>' +
          '<div class="modal-dialog-content stk-edhrec-panel"></div>' +
        '</div>' +
      '</div>';
  }

  function buildPanel() {
    const holder = document.createElement('div');
    holder.innerHTML = panelMarkup().trim();
    const overlay = holder.firstElementChild;
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.querySelector('.modal-dialog-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    return {
      overlay,
      body: overlay.querySelector('.modal-dialog-content'),
      close
    };
  }

  // --- wiring ---------------------------------------------------------------

  // Answers with a way to take the addition back, or with nothing if Scryfall
  // did not take the card. A suggestion names a printing rather than a Scryfall
  // id, so that is turned into one here, once, when the reader asks for it.
  function addCard(card) {
    const known = card.id
      ? Promise.resolve(card.id)
      : bridge().request('cardBySet', { set: card.printing && card.printing.set, number: card.printing && card.printing.number })
          .then(reply => (unwrap(reply) || {}).id || '');
    return known.then(id => {
      if (!id) return null;
      return scryfall.addCard(id).then(entry => {
        if (!entry) return null;
        const entryId = typeof entry === 'string' ? entry : entry.id;
        if (!entryId) return null;
        return () => scryfall.removeEntry(entryId).then(() => undefined);
      });
    });
  }

  // --- what EDHREC makes of this deck ---------------------------------------

  // Their suggestions are about a commander plus a deck list, not about a
  // commander alone. The list is what makes them answer to this deck.
  function deckList() {
    return scryfall.getDeck().then(deck => {
      const commanders = [];
      const cards = [];
      for (const [section, list] of Object.entries(deck.entries || {})) {
        for (const entry of (Array.isArray(list) ? list : [])) {
          const digest = entry.card_digest;
          if (!digest || !digest.name) continue;
          const line = (entry.count || 1) + ' ' + digest.name;
          if (section === 'commanders') commanders.push(digest.name);
          else if (section !== 'maybeboard') cards.push(line);
        }
      }
      return { commanders, cards };
    });
  }

  // Their own answer: a card name, the type it is, the art, and how much of the
  // recommendation it is. The set and number come out of their Scryfall link,
  // which is what a printing is named by.
  function fromRecs(list) {
    return (list || []).map(rec => {
      // Their link is scryfall.com/card/<set>/<number>/<slug>, so the printing
      // is the two segments before the slug.
      const parts = String(rec.scryfall_uri || '').split('/');
      const set = parts[parts.length - 3] || '';
      const number = parts[parts.length - 2] || '';
      return {
        name: (rec.names && rec.names.length ? rec.names.join(' // ') : '').slice(0, 120),
        typeLine: String(rec.primary_type || '').slice(0, 120),
        image: /^https:\/\/cards\.scryfall\.io\//.test(rec.image || '') ? rec.image : '',
        group: String(rec.primary_type || '') ? String(rec.primary_type) + 's' : '',
        meta: Number.isFinite(rec.score) ? Math.round(rec.score * 100) + '%' : '',
        metaTitle: Number.isFinite(rec.score) ? 'EDHREC synergy score for this deck' : '',
        printing: { set: set, number: number }
      };
    }).filter(card => card.name);
  }

  // EDHREC's grouping is the point of the page, so it survives into the panel:
  // the cards carry it and the shared renderer draws it as headings.
  function flatten(lists) {
    const cards = [];
    for (const list of lists) {
      for (const card of list.cards) {
        cards.push({
          id: card.id,
          name: card.name,
          group: list.header,
          meta: Number.isFinite(card.numDecks) && Number.isFinite(card.potentialDecks) && card.potentialDecks > 0
            ? Math.round((card.numDecks / card.potentialDecks) * 100) + '%'
            : '',
          metaTitle: Number.isFinite(card.numDecks) && Number.isFinite(card.potentialDecks)
            ? 'EDHREC: ' + card.numDecks + ' of ' + card.potentialDecks + ' decks playing this commander also play this card'
            : ''
        });
      }
    }
    return cards;
  }

  // The same card EDHREC already saw in this deck is not a suggestion. Their
  // lists are about a commander, not about this deck, so the deck's own contents
  // are what is left to check here.
  const canonical = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function deckCardNames() {
    return scryfall.getDeck().then(deck => {
      const names = new Set();
      for (const list of Object.values(deck.entries || {})) {
        for (const entry of (Array.isArray(list) ? list : [])) {
          if (entry.card_digest && entry.card_digest.name) names.add(canonical(entry.card_digest.name));
        }
      }
      return names;
    }).catch(() => new Set());
  }

  function openPanel() {
    const panel = buildPanel();
    (document.getElementById('deckbuilder') || document.body).appendChild(panel.overlay);
    const area = results.create(panel.body, addCard);
    area.message('Asking EDHREC…');

    commanderName().then(name => {
      if (!name) {
        area.message('This deck has no commander to ask about.');
        return;
      }
      // What EDHREC makes of this deck. It is the endpoint their own site posts
      // to, it is not published, and it is allowed to stop working — so if it
      // does, the panel falls back to their published commander page rather
      // than showing an error and nothing else.
      return deckList().then(list => bridge().request('edhrecRecs', list))
        .then(reply => {
          const result = unwrap(reply) || {};
          const cards = fromRecs(result.inRecs);
          if (!cards.length) throw new Error('no suggestions');
          return cards;
        })
        .catch(() => bridge().request('edhrecCommander', { name: name }).then(reply => {
          const lists = unwrap(reply);
          return Array.isArray(lists) ? flatten(lists) : [];
        }))
        .then(cards => deckCardNames().then(owned => {
          const fresh = cards.filter(card => !owned.has(canonical(card.name)));
          area.setCards(fresh, bridge().request);
          const hidden = cards.length - fresh.length;
          if (hidden > 0) area.note(hidden + ' already in this deck');
        }))
        .then(() => {
          if (!area.hasCards()) area.message('EDHREC has nothing to suggest for ' + name + '.');
        });
    }).catch(error => {
      area.message('EDHREC could not be reached. ' + (error && error.message ? error.message : ''));
    });
  }

  function addButton() {
    if (document.getElementById('stk-edhrec-button')) return;
    const host = document.querySelector('.deckbuilder-toolbar-items-right') ||
      document.querySelector('.deckbuilder-toolbar');
    if (!host) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'stk-edhrec-button';
    button.className = 'button-n tiny-n';
    button.textContent = 'EDHREC';
    button.title = 'EDHREC suggestions for this commander';
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
    if (!wired && config.edhrecSuggestions) {
      wired = true;
      // Two things have to be true before the button can go anywhere: the deck
      // has a commander section, and the toolbar is on the page. They arrive in
      // either order, so both are waited for and the attempt is idempotent —
      // otherwise the first one to show up finds the other missing and the
      // button is never placed.
      const tryAdd = () => { if (isCommanderDeck()) addButton(); };
      scryfall.elementReady('.deckbuilder-section-title', tryAdd);
      scryfall.elementReady('.deckbuilder-toolbar', tryAdd);
      scryfall.elementReady('.deckbuilder-toolbar-items-right', tryAdd);
    }
    return { applied: wired, problems: scryfall.status().problems };
  }

  self.STK_DECK_EDHREC = {
    apply: apply,
    status: () => ({ applied: wired, problems: scryfall ? scryfall.status().problems : [] })
  };
})();
