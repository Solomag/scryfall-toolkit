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

// The grouped printings table, and the finish column it counts on.
// These two are one file because the grouped table waits for the finish column to
// land before it counts columns, and because the rows it creates later reuse the
// throttled CardTrader queue the price column set up.
// Loaded after content-core.js: everything this file needs is on self.STK_CONTENT, and
// nothing here is needed by the files around it. What runs, and in which order, is
// decided in content-core.js — where this file sits in the manifest does not decide it.
(async () => {
  // The settings have not been read yet when this file is injected, so the context is
  // waited for rather than read. Destructuring at load time would give every name
  // below as undefined, and nothing would say so until a feature asked for a card page
  // that was not there.
  const {
    settings,
    language,
    t,
    cardPath,
    cardPage,
    advancedPage,
    identity,
    PLATFORM_NAMES,
    chosenPlatforms,
    platformFilterOn,
    setPlatformsOf,
    platformSetVisible,
    platformSetRequests,
    request,
    button,
    iconButton,
    attachPrintButton,
    printKey,
    refreshPrintButtons,
    flashCopied,
    hidePreview,
    positionPreview,
    enablePreview,
    ctQueuedCells,
    printButtonRefreshers,
    shared
  } = await self.STK_CONTENT.context;

  function initPrintFinishes() {
    const table = document.querySelector('#main .prints > .prints-table');
    const printLinks = [...(table?.querySelectorAll('tbody tr td:first-child a[data-card-id]') || [])];
    const ids = [...new Set(printLinks.map(link => link.dataset.cardId))];
    if (!ids.length || ids.length > 75) return;
    shared.finishesSettled = request({ type: 'finishes', ids }).then(byId => {
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

  function initExpandedPrints() {
    const foldGroups = settings.printFoldGroups !== false;
    const withPageLink = settings.printFullPageLink !== false;
    const table = document.querySelector('#main .prints > .prints-table');
    const native = document.querySelector('#main .prints .prints-all a') ||
      [...(table?.querySelectorAll('a[href]') || [])].find(link => /^(?:view all prints|показать все издания)/i.test(link.textContent.trim()));
    const tbody = table?.querySelector('tbody');
    if (!native || !tbody || table.dataset.stkPrints) return;
    table.dataset.stkPrints = '1';
    // The native link is hijacked to expand in place, so the real full page
    // keeps a permanent sibling on the same line.
    const nativeRow = native.closest('tr');
    const nativeLabel = native.textContent;
    // "Open on a new page" can become "Open on this page", which also stops the
    // link from opening a new tab.
    const sameTab = Boolean(settings.printPageSameTab);
    const pageLink = document.createElement('a');
    pageLink.className = 'stk-print-new-page';
    pageLink.href = native.getAttribute('href');
    if (!sameTab) {
      pageLink.target = '_blank';
      pageLink.rel = 'noopener noreferrer';
    }
    // The line only exists for the pair; without the full-page link the native
    // expand link stays exactly where Scryfall put it.
    const pageLine = document.createElement('span');
    pageLine.className = 'stk-print-new-page-line';
    if (withPageLink) {
      native.parentNode?.insertBefore(pageLine, native);
      pageLine.append(native, pageLink);
    }
    table.classList.toggle('stk-fold-groups', foldGroups);
    const openPageLabel = () => language === 'ru'
      ? (sameTab ? 'Открыть на этой странице' : 'Открыть на новой странице')
      : (sameTab ? 'Open on this page' : 'Open on a new page');
    const fullPageLabel = () => language === 'ru'
      ? (sameTab ? 'Все издания на этой странице' : 'Все издания на новой странице →')
      : (sameTab ? 'View all prints on this page' : 'View all prints on a new page →');
    const expandLabel = () => language === 'ru' ? 'Развернуть все группы' : 'Expand all groups';
    const collapseLabel = () => language === 'ru' ? 'Свернуть все группы' : 'Collapse all groups';
    const fewerLabel = language === 'ru' ? 'Показать меньше изданий ↑' : 'Show fewer prints ↑';
    const headCells = () => [...(table.querySelector('thead')?.querySelectorAll('th') || [])];
    const columns = () => headCells().length || 1;
    const statusRow = text => {
      const row = document.createElement('tr');
      row.className = 'stk-print-status stk-print-extra';
      const cell = document.createElement('td');
      cell.colSpan = columns();
      cell.textContent = text;
      row.append(cell);
      return row;
    };
    let builtGroups = new Map();
    let truncatedResult = false;
    let extraRows = [];
    let collapsibleRows = [];
    let loaded = false;
    let showingAll = false;
    // Each group remembers whether the user folded it, so regrouping never
    // changes a group's state behind their back.
    const groupFolded = new Map();
    let placedUnits = [];
    let totalUnits = 0;
    let defaultFolded = true;
    // Where every printing sits in the API answer (newest first), so native rows
    // and added ones can share one order.
    let printIndex = new Map();
    let printNewestFirst = true;
    // Everything added here goes in front of the View-all line, so the line
    // itself ends up as the last row of the table.
    const insertAtEnd = node => tbody.insertBefore(node, nativeRow && nativeRow.parentNode === tbody ? nativeRow : null);
    const clearExtra = () => {
      for (const row of extraRows) row.remove();
      extraRows = [];
      for (const row of collapsibleRows) row.hidden = false;
      collapsibleRows = [];
      for (const row of document.querySelectorAll('#main .prints > .prints-table tr.stk-group-end')) {
        row.classList.remove('stk-group-end');
      }
      // Rows inside a group show the bare collector number; Scryfall's own text
      // comes back when the table is regrouped without that group.
      for (const link of document.querySelectorAll('#main .prints > .prints-table a[data-stk-label]')) {
        link.textContent = link.dataset.stkLabel;
        delete link.dataset.stkLabel;
      }
      // Printings the window skipped are back on the page while the next
      // placement decides where each of them belongs.
      for (const row of tbody.querySelectorAll('tr[hidden]')) row.hidden = false;
    };
    // Fetches the complete print list once; the default view groups it too, so
    // the ten-entry cap covers the whole card, not only Scryfall's subset.
    const loadPrints = async () => {
      if (loaded) return;
      let oracleId = document.querySelector('meta[name="scryfall:oracle:id"]')?.content;
      if (!oracleId) {
        const id = document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
        if (!id) throw new Error('Card identity unavailable');
        oracleId = (await request({type:'card', id})).oracle_id;
      }
      const {prints, truncated} = await request({type:'allPrints', oracleId});
      const needsCategories = platformFilterOn || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideDigitalSets;
      // The platform index only says which client carries a digital set, so the
      // set index is what tells the two apart.
      const [categories, platforms] = needsCategories
        ? await Promise.all([
          request({type:'setCategories'}).catch(() => ({})),
          platformFilterOn ? request({type:'setPlatforms'}).catch(() => ({})) : Promise.resolve({})
        ])
        : [{}, {}];
      const platformVisible = platformFilterOn ? platformSetVisible(categories, platforms) : () => true;
      const excluded = new Set([
        ...(settings.hideDigitalSets ? categories.digital || [] : []),
        ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
        ...(settings.hideOversizedSets ? categories.oversized || [] : []),
        ...(settings.hideForeignBlackBorder ? categories.foreignBlackBorder || [] : [])
      ]);
      const groups = new Map();
      for (const card of prints) {
        if (excluded.has(card.set) || settings.hideDigitalSets && card.digital ||
            !platformVisible(card.set) ||
            settings.hideNonEnglishPrints && card.lang !== 'en') continue;
        const group = groups.get(card.set) || [];
        group.push(card);
        groups.set(card.set, group);
      }
      // The API answers newest first. Scryfall's own rows reveal the page's print
      // preference: the same order as the API means newest first, the opposite
      // order means oldest first. That reads the page itself rather than dates,
      // so it holds for any set order Scryfall uses.
      const apiIndex = new Map();
      let position = 0;
      for (const cards of groups.values()) {
        for (const card of cards) apiIndex.set(printKey(card.set, card.number), position++);
      }
      printIndex = apiIndex;
      const nativePositions = [];
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row === nativeRow) continue;
        const identity = rowSet(row);
        const index = identity && apiIndex.get(printKey(identity.set, identity.number));
        if (index !== undefined) nativePositions.push(index);
      }
      let inversions = 0;
      for (let index = 1; index < nativePositions.length; index++) {
        if (nativePositions[index] < nativePositions[index - 1]) inversions++;
      }
      const newestFirst = nativePositions.length < 2 || inversions * 2 <= nativePositions.length - 1;
      printNewestFirst = newestFirst;
      const byApi = (a, b) => (apiIndex.get(printKey(a.set, a.number)) ?? 0) - (apiIndex.get(printKey(b.set, b.number)) ?? 0);
      const compare = newestFirst ? byApi : (a, b) => -byApi(a, b);
      const ordered = new Map([...groups.entries()]
        .sort((a, b) => compare(a[1][0], b[1][0]))
        .map(([set, cards]) => [set, cards.slice().sort(compare)]));
      // The Finish column header is added by a separate response; wait for
      // it so column spans and cell indexes match the settled header row.
      await shared.finishesSettled;
      builtGroups = buildRows(ordered);
      truncatedResult = !!truncated;
      loaded = true;
    };
    native.setAttribute('aria-expanded', 'false');
    native.addEventListener('click', async event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // One link, three jobs: fold the table back, reveal the printings behind
      // the cap, or unfold every group when there is nothing left to reveal.
      if (showingAll) {
        showingAll = false;
        placeGroups();
        return;
      }
      if (totalUnits > 10) {
        if (!loaded) {
          const status = statusRow(language === 'ru' ? 'Загружаю издания…' : 'Loading printings…');
          insertAtEnd(status);
          try { await loadPrints(); status.remove(); }
          catch {
            status.querySelector('td').textContent =
              language === 'ru' ? 'Не удалось загрузить издания. Откройте отдельную страницу.' : 'Could not load printings. Open the separate page.';
            return;
          }
        }
        showingAll = true;
        placeGroups();
        return;
      }
      // Nothing left to reveal: fold or unfold every group in one go.
      const grouped = placedUnits.filter(unit => unit.grouped);
      const anyFolded = grouped.some(unit => groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded);
      for (const unit of grouped) groupFolded.set(unit.set, !anyFolded);
      placeGroups();
    });
    // The default view is already grouped from the complete print list.
    (async () => {
      await shared.finishesSettled;
      try { await loadPrints(); } catch { /* the click still offers the full page */ }
      placeGroups();
    })();

    const rowSet = row => {
      const link = row.querySelector('td:first-child a[href]');
      let match = null;
      try { match = link && new URL(link.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/); } catch { match = null; }
      return match ? { set: match[1].toLowerCase(), number: decodeURIComponent(match[2]) } : null;
    };
    // Scryfall puts the collector number on its own line inside the link and
    // marks a foil-only printing with a star, so the whitespace is collapsed and
    // both the number and the star are cut off.
    const setNameOf = row => (row.querySelector('td:first-child a[href]')?.textContent || '')
      .replace(/\s+/g, ' ').trim().replace(/\s*#.*$/, '').replace(/[\s✶★]+$/, '').trim();
    const normName = name => String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const baseName = name => normName(name).replace(/\s+promos?$/, '');
    // A star never belongs in a set name: the finish column already says it.
    const cleanSetName = name => String(name || '').replace(/[\s✶★]+/g, ' ').replace(/\s+/g, ' ').trim();
    // The API and the row link keep the star inside the collector number itself
    // ("67★" is a foil-only printing), so it is cut off whenever a number is shown.
    const cleanNumber = number => String(number || '').replace(/\s*[✶★]+\s*$/, '').trim();
    // A lone printing keeps Scryfall's own wording, star included, so the star
    // that trails its collector number is cut here as well.
    const cleanRowLabel = label => String(label || '')
      .replace(/\s+/g, ' ').trim()
      .replace(/(\s*#\s*[^\s★✶]+)\s*[★✶]+/g, '$1')
      .replace(/\s*[★✶]+$/, '').trim();
    const groupHead = (setName, set, count) => {
      const head = document.createElement('tr');
      head.className = 'stk-print-group-row stk-print-extra';
      const cell = document.createElement('td');
      cell.colSpan = columns();
      // A span inside the cell mirrors Scryfall's own first-column markup, so
      // the native padding, alignment and single-line rhythm apply unchanged.
      const label = document.createElement('span');
      label.textContent = `${cleanSetName(setName)} (${set.toUpperCase()}) · ${count}`;
      cell.append(label);
      head.append(cell);
      return head;
    };
    const wireGroup = (head, rows, set) => {
      collapsibleRows.push(...rows);
      const setCollapsed = collapsed => {
        head.classList.toggle('stk-group-collapsed', collapsed);
        // A folded group ends at its own header, an open one at its last row.
        head.classList.toggle('stk-group-folded-end', collapsed);
        for (const row of rows) row.hidden = collapsed;
      };
      if (!foldGroups) return;
      // Groups start folded, unless the whole table fits into ten rows anyway.
      setCollapsed(groupFolded.has(set) ? groupFolded.get(set) : defaultFolded);
      head.addEventListener('click', () => {
        const collapsed = !head.classList.contains('stk-group-collapsed');
        groupFolded.set(set, collapsed);
        setCollapsed(collapsed);
        updateLine();
      });
    };
    // The line at the bottom of the table offers whatever is still worth
    // pressing: more printings, groups to unfold, or nothing but the full page.
    function updateLine() {
      const grouped = placedUnits.filter(unit => unit.grouped);
      const folded = grouped.filter(unit => groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded);
      let left = showingAll ? fewerLabel : totalUnits > 10 ? nativeLabel : '';
      if (!left && foldGroups && grouped.length) left = folded.length ? expandLabel() : collapseLabel();
      native.hidden = !left;
      native.textContent = left;
      const bare = !left;
      if (withPageLink) {
        pageLink.textContent = bare ? fullPageLabel() : openPageLabel();
        pageLine.classList.toggle('stk-print-line-end', bare);
      }
      const open = showingAll || grouped.some(unit => !(groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded));
      table.classList.toggle('stk-prints-expanded', open);
      native.setAttribute('aria-expanded', String(open));
    }
    // A promo set belongs to its parent set: "Ixalan Promos" shares the group of
    // "Ixalan", and only its own code tells the two apart inside the group.
    function mergePromoUnits(units) {
      const merged = [];
      for (const unit of units) {
        const index = merged.findIndex(other =>
          other.setName !== unit.setName && baseName(other.setName) === baseName(unit.setName));
        if (index < 0) { merged.push(unit); continue; }
        const target = merged[index];
        // The parent set keeps the group's name and code even when the promo
        // printing was met first.
        if (normName(unit.setName) === baseName(unit.setName) && normName(target.setName) !== baseName(target.setName)) {
          target.setName = unit.setName;
          target.set = unit.set;
        }
        target.sets = [...new Set([...target.sets, ...unit.sets])];
        target.nativeRows = [...target.nativeRows, ...unit.nativeRows];
        target.added = [...target.added, ...unit.added];
      }
      return merged;
    }
    // One set is one group: the printings Scryfall already lists and the ones
    // added here share a single header, so two printings of one set (for
    // example #304 and #304★) end up under the same group instead of apart. The
    // grouping is already in place before "View all prints" is pressed, and a
    // long print list keeps the first ten entries of the closed table (a closed
    // group counts as one); the rest stays behind the full-page link.
    function placeGroups() {
      clearExtra();
      const nativeGroups = new Map();
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row === nativeRow) continue;
        const identity = rowSet(row);
        if (!identity) continue;
        if (!nativeGroups.has(identity.set)) nativeGroups.set(identity.set, []);
        nativeGroups.get(identity.set).push(row);
      }
      const units = [];
      for (const [set, nativeSetRows] of nativeGroups) {
        const extra = builtGroups.get(set);
        const added = extra ? extra.rows : [];
        // Even a set with a single printing joins the list: it may still be the
        // parent a promo set has to be merged into.
        units.push({
          set, sets: [set], setName: extra?.setName || setNameOf(nativeSetRows[0]),
          nativeRows: nativeSetRows, added, grouped: nativeSetRows.length + added.length > 1
        });
      }
      for (const [set, extra] of builtGroups) {
        if (nativeGroups.has(set)) continue;
        units.push({
          set, sets: [set], setName: extra.setName, nativeRows: [],
          added: extra.rows, grouped: extra.rows.length > 1
        });
      }
      // After a promo merge the set holds more than one printing, so it earns a
      // header even when one side arrived as a single native row.
      const merged = mergePromoUnits(units)
        .map(unit => ({ ...unit, grouped: unit.nativeRows.length + unit.added.length > 1 }));
      // Native rows take part in the order like any other printing: the whole
      // table reads as one list in the direction the page itself uses, with the
      // rows Scryfall renders where their release date puts them.
      const rowRank = row => {
        const identity = rowSet(row);
        const rank = identity && printIndex.get(printKey(identity.set, identity.number));
        return rank === undefined ? Infinity : rank;
      };
      const unitRank = unit => Math.min(...[...unit.nativeRows, ...unit.added].map(rowRank));
      merged.sort((a, b) => {
        const left = unitRank(a);
        const right = unitRank(b);
        if (left === right) return 0;
        return (left < right ? -1 : 1) * (printNewestFirst ? 1 : -1);
      });
      totalUnits = merged.length;
      // A card whose printings all fit into ten rows has nothing to fold away,
      // so its groups start open.
      defaultFolded = merged.reduce((sum, unit) => sum + unit.nativeRows.length + unit.added.length, 0) > 10;
      // Ten entries fit on the page (a closed group counts as one). Scryfall
      // keeps the printing being viewed on screen, so the window is taken around
      // its group instead of from the top.
      const cap = 10;
      let start = 0;
      if (!showingAll && totalUnits > cap) {
        const currentRow = tbody.querySelector('tr.current');
        const at = currentRow ? merged.findIndex(unit => unit.nativeRows.includes(currentRow)) : -1;
        start = at < 0 ? 0 : Math.max(0, Math.min(at - 4, totalUnits - cap));
      }
      placedUnits = showingAll ? merged : merged.slice(start, start + cap);
      const sequence = [];
      for (const unit of placedUnits) {
        // Inside a group the set name lives in the header, so every row there
        // shows the bare collector number; a lone printing repeats the set name.
        const all = [...unit.nativeRows, ...unit.added];
        for (const row of all) {
          const link = row.querySelector('td:first-child a[href]');
          if (!link) continue;
          if (unit.grouped) {
            const identity = rowSet(row);
            // Scryfall's own wording is kept aside so regrouping can restore it.
            if (identity && link.dataset.stkLabel === undefined) link.dataset.stkLabel = link.textContent;
            const code = identity && identity.set !== unit.set ? ` (${identity.set.toUpperCase()})` : '';
            link.textContent = row.stkShortLabel
              ? `${row.stkShortLabel}${code}`
              : `#${identity ? cleanNumber(identity.number) : ''}${code}`;
          } else {
            link.textContent = cleanRowLabel(row.stkFullLabel || link.textContent);
          }
        }
        if (unit.grouped) {
          const head = groupHead(unit.setName, unit.set, all.length);
          // The set of the card being viewed gets a light accent so it is easy
          // to find among the other groups.
          if (unit.nativeRows.some(row => row.classList.contains('current'))) head.classList.add('stk-current-group');
          wireGroup(head, all, unit.set);
          extraRows.push(head);
          sequence.push(head);
        }
        sequence.push(...all);
        for (const row of unit.added) {
          // The CardTrader queue only ever sees the rows that made it into the
          // table, so the printings behind the ten-entry cap cost no requests.
          row.stkEnqueueCT?.();
        }
        extraRows.push(...unit.added);
        // A light rule under the group's last row tells the grouped printings
        // apart from the ones that stand on their own.
        if (unit.grouped && all.length) {
          const last = all[all.length - 1];
          last.classList.add('stk-group-end');
          collapsibleRows.push(last);
        }
      }
      // The whole body is moved into the chosen order, Scryfall's own rows
      // included, so the table reads as one list from top to bottom.
      for (const row of sequence) insertAtEnd(row);
      // Printings the window skipped wait off screen until "View all prints"
      // brings the whole list in.
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row !== nativeRow && !sequence.includes(row)) row.hidden = true;
      }
      if (truncatedResult) {
        const notice = statusRow(language === 'ru' ? 'Часть изданий не загрузилась; откройте полную страницу.' : 'More printings are available on the full page.');
        insertAtEnd(notice);
        extraRows.push(notice);
      }
      updateLine();
    }

    // Rows are inserted into Scryfall's own prints table so the expansion stays
    // part of the original Prints section instead of a detached panel. One set
    // is one group, so the headers are built in placeGroups().
    function buildRows(groups) {
      const total = columns();
      const heads = headCells();
      const finishIdx = heads.findIndex(th => th.classList.contains('stk-finish-header'));
      const usdIdx = heads.findIndex(th => /^usd/i.test(th.textContent.trim()));
      const eurIdx = heads.findIndex(th => /^eur/i.test(th.textContent.trim()));
      const tixIdx = heads.findIndex(th => /^tix/i.test(th.textContent.trim()));
      const setIdx = heads.findIndex(th => /^set$/i.test(th.textContent.trim()));
      const ctIdx = heads.findIndex(th => th.classList.contains('stk-ct-price-header'));
      // Columns the price filter or the CardTrader switch already hid must stay
      // hidden in rows that are created after those settings were applied.
      const hiddenIdx = new Set(heads.map((th, i) => th.classList.contains('stk-price-hidden') ? i : -1).filter(i => i >= 0));
      const euroSources = ['cm', 'ct', 'both'].includes(settings.euroPriceSources) ? settings.euroPriceSources : 'cm';
      const fillPrice = (cell, text, currency) => {
        if (!text) return;
        const span = document.createElement('span');
        span.className = `price currency-${currency}`;
        span.textContent = text;
        cell.append(span);
      };
      const priceText = (card, key, foilKey, symbol) =>
        card.prices?.[key] ? `${symbol}${card.prices[key]}`
          : card.prices?.[foilKey] ? `${symbol}${card.prices[foilKey]}` : '';
      const path = uri => {
        try { return new URL(uri, location.href).pathname.replace(/\/+$/, ''); }
        catch { return ''; }
      };
      const nativeHrefs = new Set(
        [...tbody.querySelectorAll('tr:not(.stk-print-extra) td:first-child a[href]')].map(link => path(link.href)).filter(Boolean)
      );
      const built = new Map();
      for (const cards of groups.values()) {
        // Printings already listed by the native table are skipped so the
        // expansion only adds what is missing.
        const entries = cards.filter(card => !nativeHrefs.has(path(card.uri)));
        if (!entries.length) continue;
        const group = { setName: cards[0].setName, rows: [] };
        for (const card of entries) {
          const row = document.createElement('tr');
          row.className = 'stk-print-entry stk-print-extra';
          const number = `#${cleanNumber(card.number)}${card.lang !== 'en' ? ` · ${card.lang.toUpperCase()}` : ''}`;
          // Under a group header the set name would repeat on every row, so the
          // bare number is used there and the full label outside groups.
          row.stkShortLabel = number;
          row.stkFullLabel = `${cards[0].setName} ${number}`;
          for (let i = 0; i < total; i++) {
            const cell = document.createElement('td');
            if (i === 0) {
              const link = document.createElement('a');
              link.href = path(card.uri);
              link.textContent = number;
              cell.append(link);
              // The printing's own art comes with the print list, so the hover
              // preview needs no extra request.
              if (card.image) enablePreview(link, async () => ({ image: card.image, name: card.name, uri: link.href }));
              attachPrintButton(cell, printKey(card.set, card.number), card,
                language === 'ru' ? 'Добавить конкретное издание с кодом сета в буфер' : 'Add this printing with its set code to the clipboard');
            } else if (i === finishIdx) {
              // One glyph only: a printing with several finishes gets no badge,
              // exactly like Scryfall's own rows.
              const glyphs = { nonfoil: '○', foil: '✶', etched: '◈' };
              const text = (card.finishes || []).length === 1 ? glyphs[card.finishes[0]] || '' : '';
              if (text) {
                cell.className = 'stk-finish-cell';
                const badge = document.createElement('span');
                badge.className = 'stk-finish-badge';
                badge.textContent = text;
                badge.title = (card.finishes || []).join(' / ');
                cell.append(badge);
              }
            } else if (i === setIdx) {
              const span = document.createElement('span');
              span.textContent = card.set.toUpperCase();
              cell.append(span);
            } else if (i === ctIdx) {
              cell.className = 'stk-ct-price-cell';
              // Same throttled background queue that fills the native rows, but
              // only once the row is actually placed in the table.
              row.stkEnqueueCT = () => {
                if (!cell.querySelector('a')) shared.enqueueCardTraderPrint?.(cell, card.id, card.set);
              };
            } else if (i === usdIdx || i === eurIdx || i === tixIdx) {
              if (i === usdIdx) fillPrice(cell, priceText(card, 'usd', 'usd_foil', '$'), 'usd');
              else if (i === eurIdx) {
                fillPrice(cell, priceText(card, 'eur', 'eur_foil', '€'), 'eur');
                if (euroSources === 'both') cell.classList.add('stk-cm-price-cell');
              } else fillPrice(cell, priceText(card, 'tix', 'tix', ''), 'tix');
            }
            if (hiddenIdx.has(i)) cell.classList.add('stk-price-hidden');
            row.append(cell);
          }
          group.rows.push(row);
        }
        built.set(cards[0].set.toLowerCase(), group);
      }
      return built;
    }
  }


  self.STK_CONTENT.on("printFinishes", () => initPrintFinishes());
  self.STK_CONTENT.on("expandedPrints", () => initExpandedPrints());
})();
