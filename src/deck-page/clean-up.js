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

// The clean up improver.
//
// Behaviour follows Shambleshark's modify-clean-up and add-section-heading
// (MIT, https://github.com/crookedneighbor/shambleshark), rewritten for this
// project in plain JavaScript. It moves lands out of the nonland column and
// nonlands out of the land one when a deck is cleaned up, sorts every column,
// and heads each group with its name and count.
//
// It has to run in Scryfall's own page world; see deck-scryfall.js for why, and
// for the posture towards those internals. Nothing in this file touches them
// directly.

(function () {
  'use strict';

  const tools = self.STK_DECK_TOOLS;
  const scryfall = self.STK_DECK_SCRYFALL;

  // --- correcting the land and nonland columns ------------------------------

  function correctLandNonLandColumns(deck) {
    if (!tools.hasDedicatedLandSection(deck)) return Promise.resolve([]);
    const entries = deck.entries || {};
    const landsInNonLands = (entries.nonlands || []).filter(c => c.card_digest).filter(c => tools.isLandCard(c));
    const nonLandsInLands = (entries.lands || []).filter(c => c.card_digest).filter(c => !tools.isLandCard(c));

    landsInNonLands.forEach(c => { c.section = 'lands'; });
    nonLandsInLands.forEach(c => { c.section = 'nonlands'; });

    return Promise.all(landsInNonLands.concat(nonLandsInLands).map(c => scryfall.updateEntry(c)));
  }

  // --- the headings ---------------------------------------------------------

  // The sections that get headings. Upstream names these four and no others.
  const SECTIONS_WITH_HEADINGS = {
    nonlands: true, mainboard: true, columna: true, columnb: true
  };

  const HEADINGS = {
    'card-type': [
      { id: 'creature', label: 'creatures' },
      { id: 'planeswalker', label: 'planeswalkers' },
      { id: 'artifact', label: 'artifacts' },
      { id: 'enchantment', label: 'enchantments' },
      { id: 'instant', label: 'instants' },
      { id: 'sorcery', label: 'sorceries' },
      { id: 'land', label: 'lands' }
    ],
    name: [
      { id: 'abcd', label: 'a-d' },
      { id: 'efg', label: 'e-g' },
      { id: 'hijk', label: 'h-k' },
      { id: 'lmnop', label: 'l-p' },
      { id: 'qrs', label: 'q-s' },
      { id: 'tuv', label: 't-v' },
      { id: 'wx', label: 'w-x' },
      { id: 'yz', label: 'y-z' }
    ]
  };

  function deckbuilder() {
    const s = self.Scryfall;
    return s && s.deckbuilder ? s.deckbuilder : null;
  }

  function headingFor(sortChoice, entry) {
    const groups = HEADINGS[sortChoice];
    if (!groups) return null;
    if (sortChoice === 'name') {
      const first = (entry.card_digest && entry.card_digest.name || '').charAt(0).toLowerCase();
      return groups.find(group => group.id.indexOf(first) > -1) || null;
    }
    const primary = tools.getPrimaryType(entry);
    return groups.find(group => group.id === primary) || null;
  }

  function totalsFor(section, sortChoice) {
    const db = deckbuilder();
    const entries = (db && db.entries && db.entries[section]) || [];
    if (sortChoice === 'name') return tools.calculateTotalsByName(entries);
    if (sortChoice === 'card-type') return tools.calculateTotalsByCardType(entries);
    return {};
  }

  function createElement(html) {
    const holder = document.createElement('ul');
    holder.innerHTML = String(html).trim();
    return holder.firstElementChild;
  }

  function createHeadingElement(heading, subtotal) {
    const db = deckbuilder();
    const total = db && typeof db.totalCount === 'function' ? db.totalCount() : 0;
    return createElement(
      '<li class="cleanup-improver__deck-section-heading" data-heading-section-id="' + heading.id + '">' +
        '<h6 class="deckbuilder-section-title-bar">' +
          '<span class="deckbuilder-section-title">' + heading.label + '</span>' +
          '<span class="deckbuilder-section-count">' +
            '<span class="modify-cleanup-subtotal-count">' + subtotal + '</span>/' +
            '<span class="modify-cleanup-total-count">' + total + '</span> cards</span>' +
        '</h6>' +
      '</li>'
    );
  }

  function resetDefaultHeadings() {
    // Put Scryfall's own section titles back before adding ours, so ours can
    // hide them without leaving them hidden once the feature is turned off.
    document.querySelectorAll('h6.deckbuilder-section-title-bar').forEach(el => el.classList.remove('is-hidden'));
  }

  function resetPreviousHeadings(headings, section) {
    if (headings[section]) {
      Object.keys(headings[section]).forEach(key => {
        const el = headings[section][key];
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
    headings[section] = {};
  }

  function insertHeadings(sortChoice, headings) {
    const db = deckbuilder();
    if (!db) return;
    const done = () => {
      resetDefaultHeadings();
      db.flatSections.forEach(section => {
        if (!(section in SECTIONS_WITH_HEADINGS)) return;
        const totals = totalsFor(section, sortChoice);
        resetPreviousHeadings(headings, section);
        (db.entries[section] || []).forEach(entry => {
          if (!entry.card_digest) return;
          const heading = headingFor(sortChoice, entry);
          if (!heading || headings[section][heading.id]) return;
          const li = createHeadingElement(heading, totals[heading.id]);
          headings[section][heading.id] = li;

          const entryElement = document.querySelector('[data-entry="' + entry.id + '"]');
          if (!entryElement || !entryElement.parentNode) return;
          const originalTitle = entryElement.parentNode.parentNode
            ? entryElement.parentNode.parentNode.querySelector('h6.deckbuilder-section-title-bar')
            : null;
          if (originalTitle) originalTitle.classList.add('is-hidden');
          entryElement.parentNode.insertBefore(li, entryElement);
        });
      });
    };

    if (typeof db.$nextTick === 'function') {
      try {
        db.$nextTick(done);
        return;
      } catch (error) {
        scryfall.report('deckbuilder.$nextTick threw', error);
      }
    }
    done();
  }

  function updateTotalsInHeadings(totalCount) {
    document.querySelectorAll('.cleanup-improver__deck-section-heading').forEach(el => {
      const total = el.querySelector('.modify-cleanup-total-count');
      if (total) total.textContent = String(totalCount);
    });
  }

  function updateSubTotalsInHeadings(section, sortChoice) {
    const totals = totalsFor(section, sortChoice);
    Object.keys(totals).forEach(area => {
      const el = document.querySelector('[data-heading-section-id="' + area + '"] .modify-cleanup-subtotal-count');
      if (el) el.textContent = String(totals[area]);
    });
  }

  function addDeckTotalUpdateListener(sortChoice) {
    scryfall.on('deck-total-count-updated', data => {
      updateTotalsInHeadings(data.totalCount);
      const db = deckbuilder();
      if (!db) return;
      db.flatSections.forEach(section => {
        if (!(section in SECTIONS_WITH_HEADINGS)) return;
        updateSubTotalsInHeadings(section, sortChoice);
      });
    });
  }

  // --- wiring it to the clean up button -------------------------------------

  const SORTERS = {
    'card-type': () => tools.sortByPrimaryCardType(),
    name: () => tools.sortByName()
  };

  function modifyCleanUp(config) {
    const db = deckbuilder();
    if (!db || typeof db.cleanUp !== 'function') {
      scryfall.report('Scryfall.deckbuilder.cleanUp is not available');
      return false;
    }

    const sortChoice = config.sortEntriesPrimary;
    const sorter = sortChoice && SORTERS[sortChoice] ? SORTERS[sortChoice]() : null;

    if (sorter) {
      const headings = {};
      if (config.insertSortingHeadings) addDeckTotalUpdateListener(sortChoice);

      scryfall.on('deck-entries-updated', () => {
        const target = deckbuilder();
        if (!target) return;
        target.flatSections.forEach(section => {
          if (Array.isArray(target.entries[section])) target.entries[section].sort(sorter);
        });
        if (typeof target.$forceUpdate === 'function') {
          try {
            target.$forceUpdate();
          } catch (error) {
            scryfall.report('deckbuilder.$forceUpdate threw', error);
          }
        }
        if (config.insertSortingHeadings) insertHeadings(sortChoice, headings);
      });
    }

    const original = db.cleanUp;
    db.cleanUp = function () {
      const args = arguments;
      const scope = this;
      return scryfall.getDeck().then(deck => {
        if (config.cleanUpLandsInSingleton) return correctLandNonLandColumns(deck);
      }).catch(error => {
        scryfall.report('reading the deck before clean up threw', error);
      }).then(() => original.apply(scope, args));
    };
    return true;
  }

  // --- the outside interface ------------------------------------------------

  let applied = false;

  function wanted(config) {
    return Boolean(config.cleanUpLandsInSingleton) ||
      Boolean(config.sortEntriesPrimary && config.sortEntriesPrimary !== 'none');
  }

  function apply(config) {
    config = config || {};
    if (!tools || !scryfall) {
      return { applied: false, problems: ['the deck modules did not load in order'] };
    }
    // The clean up button is wrapped once, so turning the setting off and on
    // again does not stack wrappers. The hooks are installed here rather than
    // left to whoever calls this: a module should not depend on its caller
    // having prepared Scryfall for it.
    if (!applied && wanted(config)) {
      scryfall.install();
      try {
        applied = modifyCleanUp(config) === true;
      } catch (error) {
        scryfall.report('wiring the clean up button failed', error);
      }
    }
    return { applied: applied, problems: scryfall.status().problems };
  }

  self.STK_DECK_CLEANUP = {
    apply: apply,
    status: () => ({ applied: applied, problems: scryfall ? scryfall.status().problems : [] })
  };
})();
