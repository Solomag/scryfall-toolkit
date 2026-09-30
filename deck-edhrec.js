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
  // page.js is what defines the bridge and it loads after this file, so it is
  // looked up when it is needed rather than when this runs.
  const bridge = () => self.STK_BRIDGE;

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
          '<div class="modal-dialog-content stk-edhrec-panel stk-edhrec-body"></div>' +
        '</div>' +
      '</div>';
  }

  function buildPanel() {
    const holder = document.createElement('div');
    holder.innerHTML = panelMarkup().trim();
    const overlay = holder.firstElementChild;
    const body = overlay.querySelector('.stk-edhrec-body');
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.querySelector('.modal-dialog-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    return { overlay, body, close };
  }

  function note(body, text) {
    const p = document.createElement('p');
    p.className = 'stk-edhrec-note';
    p.textContent = text;
    body.replaceChildren(p);
  }

  // Each card is one line: the name, how many of the commander's decks play it,
  // and a button. The count is EDHREC's own number, divided here and nothing
  // more.
  function cardRow(card) {
    const li = document.createElement('li');
    li.className = 'stk-edhrec-card';

    const name = document.createElement('span');
    name.className = 'stk-edhrec-card-name';
    name.textContent = card.name;

    const rate = document.createElement('span');
    rate.className = 'stk-edhrec-card-rate';
    if (Number.isFinite(card.numDecks) && Number.isFinite(card.potentialDecks) && card.potentialDecks > 0) {
      rate.textContent = Math.round((card.numDecks / card.potentialDecks) * 100) + '%';
      rate.title = card.numDecks + ' of ' + card.potentialDecks + ' decks';
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'button-n tiny-n stk-edhrec-add';
    add.textContent = 'Add';
    add.addEventListener('click', () => {
      add.disabled = true;
      scryfall.addCard(card.id).then(result => {
        // Scryfall answers with the entry it created. Anything else means it
        // did not take the card, and the button comes back so it can be tried
        // again rather than looking like it worked.
        if (result) {
          add.textContent = 'Added';
          return;
        }
        add.disabled = false;
      }).catch(() => { add.disabled = false; });
    });

    li.append(name, rate, add);
    return li;
  }

  function renderLists(body, lists) {
    const frag = document.createDocumentFragment();
    lists.forEach(list => {
      const section = document.createElement('div');
      section.className = 'stk-edhrec-list';

      const title = document.createElement('h3');
      title.className = 'stk-edhrec-list-title';
      title.textContent = list.header;

      const ul = document.createElement('ul');
      list.cards.forEach(card => ul.appendChild(cardRow(card)));

      section.append(title, ul);
      frag.appendChild(section);
    });
    body.replaceChildren(frag);
  }

  // --- wiring ---------------------------------------------------------------

  function openPanel() {
    const panel = buildPanel();
    (document.getElementById('deckbuilder') || document.body).appendChild(panel.overlay);
    note(panel.body, 'Asking EDHREC…');

    commanderName().then(name => {
      if (!name) {
        note(panel.body, 'This deck has no commander to ask about.');
        return;
      }
      return bridge().request('edhrecCommander', { name: name }).then(lists => {
        if (!Array.isArray(lists) || !lists.length) {
          note(panel.body, 'EDHREC has nothing to suggest for ' + name + '.');
          return;
        }
        renderLists(panel.body, lists);
      });
    }).catch(error => {
      note(panel.body, 'EDHREC could not be reached. ' + (error && error.message ? error.message : ''));
    });
  }

  let wired = false;

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

  function apply(config) {
    config = config || {};
    if (!scryfall || !bridge()) {
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
