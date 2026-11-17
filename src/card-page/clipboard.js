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

// The shared clipboard, and the per-printing + on the card page.
// The clipboard is read by more features than any other part of this — the price
// columns, the grouped printings and the deck list all read what it holds — so it
// goes first and is awaited before anything else runs.
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
    setFilters,
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

  async function initClipboard() {
    // Formatting and identity both come from src/core/clipboard-format.js, which the
    // Tagger page loads as well. They used to be written out twice here and there, and
    // the two copies had already disagreed about `forceSet`, so a list built on one site
    // and copied on the other came out differently depending on which way round you did
    // it. See that file for why the selection is keyed by printing and not by name.
    //
    // Taken first, above the toolbar that uses them. A const read by code that runs
    // before its own declaration line is a temporal dead zone error, and the toolbar is
    // built before this used to sit.
    const { entryKey, formatCard, clipboardText, FORMATS, otherFormat } =
      window.STK_CLIPBOARD_FORMAT;

    let cards = settings.cards;
    if (!Array.isArray(cards)) {
      try {
        const old = JSON.parse(localStorage.getItem("cardClipboard") || "[]");
        cards = Array.isArray(old) ? old.filter(c => c && typeof c.cardName === "string")
          .map(c => ({ name: c.cardName, url: c.cardLink || "", set: "", number: "" })) : [];
      } catch { cards = []; }
      await chrome.storage.local.set({ cards });
    }

    // More than one clipboard. The one in use is still `cards`, exactly as before, so the
    // Tagger page, the per-printing buttons and anything else that reads `cards` keep
    // working without knowing there are others; the rest wait in `clipLists.lists` under
    // their names. Switching moves one list out of `cards` and another into it, in a
    // single write, so there is no moment when a list exists in both places or in neither.
    const LIST_LIMIT = 20;
    const readLists = value => {
      const lists = {};
      for (const [name, items] of Object.entries(value?.lists || {})) {
        if (typeof name === 'string' && name.trim() && Array.isArray(items)) lists[name.slice(0, 40)] = items;
      }
      const active = typeof value?.active === 'string' && value.active.trim() ? value.active.slice(0, 40) : 'Main';
      delete lists[active];
      return { active, lists };
    };
    let clipLists = readLists((await chrome.storage.local.get('clipLists')).clipLists);
    const listNames = () => [clipLists.active, ...Object.keys(clipLists.lists).sort((a, b) => a.localeCompare(b))];
    async function switchTo(name) {
      if (name === clipLists.active || !(name in clipLists.lists)) return;
      const lists = { ...clipLists.lists, [clipLists.active]: cards };
      cards = lists[name];
      delete lists[name];
      clipLists = { active: name, lists };
      await chrome.storage.local.set({ cards, clipLists });
      shared.clipboardCards = cards;
      render();
      scan();
      refreshPrintButtons();
    }
    function askName(question, current = '') {
      const answer = prompt(question, current);
      const name = String(answer || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!name) return '';
      if (listNames().includes(name) && name !== current) { alert('There is already a list called ' + name + '.'); return ''; }
      return name;
    }
    const listPicker = document.createElement('select');
    listPicker.className = 'stk-list-picker';
    listPicker.setAttribute('aria-label', 'Card list');
    listPicker.addEventListener('change', async () => {
      const choice = listPicker.value;
      if (choice === '\u0000new') {
        if (listNames().length >= LIST_LIMIT) { alert('At most ' + LIST_LIMIT + ' lists.'); render(); return; }
        const name = askName('Name of the new list:');
        if (!name) { render(); return; }
        clipLists = { ...clipLists, lists: { ...clipLists.lists, [name]: [] } };
        return switchTo(name);
      }
      if (choice === '\u0000rename') {
        const name = askName('New name for this list:', clipLists.active);
        if (name && name !== clipLists.active) {
          clipLists = { ...clipLists, active: name };
          await chrome.storage.local.set({ clipLists });
        }
        render();
        return;
      }
      if (choice === '\u0000delete') {
        const others = Object.keys(clipLists.lists);
        if (!others.length || !confirm('Delete the list ' + clipLists.active + ' and its ' + cards.length + ' cards?')) { render(); return; }
        const next = others.sort((a, b) => a.localeCompare(b))[0];
        const lists = { ...clipLists.lists };
        cards = lists[next];
        delete lists[next];
        clipLists = { active: next, lists };
        await chrome.storage.local.set({ cards, clipLists });
        shared.clipboardCards = cards;
        render();
        scan();
        refreshPrintButtons();
        return;
      }
      return switchTo(choice);
    });
    function paintPicker() {
      listPicker.replaceChildren();
      const option = (value, text) => {
        const element = document.createElement('option');
        element.value = value;
        element.textContent = text;
        return element;
      };
      for (const name of listNames()) {
        const items = name === clipLists.active ? cards : clipLists.lists[name];
        listPicker.append(option(name, name + ' (' + items.length + ')'));
      }
      listPicker.append(option('\u0000new', '+ New list…'), option('\u0000rename', 'Rename this list…'));
      if (Object.keys(clipLists.lists).length) listPicker.append(option('\u0000delete', 'Delete this list…'));
      listPicker.value = clipLists.active;
      for (const element of listPicker.options) element.selected = element.value === clipLists.active;
    }

    const root = document.createElement("aside");
    root.id = "scryfall-toolkit-clipboard";
    root.setAttribute("aria-label", "Card clipboard");
    const toolbar = document.createElement("div");
    toolbar.className = "stk-toolbar";
    const list = document.createElement("div");
    list.className = "stk-list";
    const open = iconButton('clip', 'Show card list', () => { list.hidden = !list.hidden; if (!list.hidden) paintTotal(); });
    const badge = document.createElement('span');
    badge.className = 'stk-count';
    badge.setAttribute('aria-hidden', 'true');
    open.append(badge);
    const writeClipboard = async (format, control, restLabel, stripSets) => {
      const text = clipboardText(cards, format, stripSets);
      try { await navigator.clipboard.writeText(text); flashCopied(control, restLabel); }
      catch { control.title = 'Copy failed'; }
    };

    // Copy keeps the export format; hovering it reveals a small menu above with a
    // one-off copy in the *other* format.
    //
    // It used to be a fixed "names only, no sets", which meant that whoever had chosen
    // names in the settings had two buttons that did the same thing and no way to reach
    // the set format from here at all. With one alternative the item is simply whatever
    // the settings are not using, so there is nothing to configure and nothing to get
    // wrong: the main button always does what the settings say, and this one does the
    // other thing.
    const wrap = document.createElement('span');
    wrap.className = 'stk-copy-wrap';
    const menu = document.createElement('span');
    menu.className = 'stk-copy-menu';
    menu.hidden = true;
    const plain = document.createElement('button');
    plain.type = 'button';
    plain.className = 'stk-copy-plain';
    menu.append(plain);
    const copy = iconButton('duplicate', 'Copy cards', async () => {
      const format = (await chrome.storage.local.get({ exportFormat: "moxfield" })).exportFormat;
      await writeClipboard(format, copy, 'Copy cards');
    });
    const labelOf = other => {
      const entry = FORMATS[other] || FORMATS.names;
      return entry.en;
    };
    let shownFormat = null;
    const paintMenu = format => {
      if (shownFormat === format) return;
      shownFormat = format;
      const other = otherFormat(format);
      plain.textContent = labelOf(other);
      plain.title = `Copy in the format ${labelOf(other)}`;
    };
    paintMenu('moxfield');
    plain.addEventListener('click', async () => {
      const format = (await chrome.storage.local.get({ exportFormat: "moxfield" })).exportFormat;
      menu.hidden = true;
      const other = otherFormat(format);
      // Copying in the other format is the point of the item, so the set suffix follows
      // that format rather than being switched off: asked for moxfield, it gets a set
      // whether or not the settings default is names.
      await writeClipboard(other, plain, labelOf(other));
    });
    chrome.storage.onChanged.addListener(changes => {
      if (changes.exportFormat) paintMenu(changes.exportFormat.newValue);
    });
    wrap.append(menu, copy);
    let hideMenuTimer;
    // Repaint from the setting at the moment the menu appears, rather than only when a
    // change event arrives. The item's whole job is to name the format the main button
    // is not using, so a stale label points the reader at the format they already have.
    const showMenu = () => {
      clearTimeout(hideMenuTimer);
      chrome.storage.local.get({ exportFormat: "moxfield" }).then(({ exportFormat }) => {
        paintMenu(exportFormat);
        menu.hidden = false;
      });
    };
    const scheduleHideMenu = () => {
      clearTimeout(hideMenuTimer);
      hideMenuTimer = setTimeout(() => { menu.hidden = true; }, 200);
    };
    for (const type of ['mouseenter', 'focusin']) wrap.addEventListener(type, showMenu);
    for (const type of ['mouseleave', 'focusout']) wrap.addEventListener(type, scheduleHideMenu);
    menu.addEventListener('mouseenter', showMenu);
    const clear = iconButton('trash', 'Clear card clipboard', async () => {
      if (!cards.length || !confirm('Clear the card clipboard?')) return;
      cards = [];
      await persist();
    });
    toolbar.append(wrap, clear, open);
    root.append(toolbar, list);
    document.body.append(root);
    list.hidden = true;

    // What the clipboard costs: each entry's printing at Scryfall's price, summed per
    // currency, for the currencies the reader has not hidden. Asked for only while the list
    // is open, and remembered per printing so adding a card asks about that card alone.
    const CURRENCIES = [['usd', '$', 'USD'], ['eur', '€', 'EUR'], ['tix', '', 'TIX']];
    const priceOf = new Map();
    let totalTimer = null;
    const totalLine = document.createElement('p');
    totalLine.className = 'stk-total';
    function paintTotal() {
      const shown = CURRENCIES.filter(([kind]) => setFilters?.prices?.[kind] !== false);
      if (!shown.length || !cards.length) { totalLine.remove(); return; }
      listPicker.after(totalLine);
      const priced = cards.filter(card => card.set && card.number);
      const missing = priced.filter(card => !priceOf.has(entryKey(card)));
      const parts = shown.map(([kind, sign, code]) => {
        let sum = 0;
        let counted = 0;
        for (const card of priced) {
          const value = Number(priceOf.get(entryKey(card))?.[kind]);
          if (Number.isFinite(value) && value > 0) { sum += value; counted += 1; }
        }
        return { text: sign ? sign + sum.toFixed(2) : sum.toFixed(2) + ' ' + code, counted };
      });
      totalLine.textContent = 'Total: ' + parts.map(part => part.text).join(' · ');
      const without = cards.length - Math.max(0, ...parts.map(part => part.counted));
      totalLine.title = missing.length ? 'Reading prices…'
        : (without ? `${without} of ${cards.length} cards have no price here` : 'Scryfall prices, one copy of each printing');
      if (missing.length && !list.hidden) {
        clearTimeout(totalTimer);
        totalTimer = setTimeout(() => {
          request({ type: 'clipboardPrices', cards: missing.slice(0, 600).map(card => ({ set: card.set, number: card.number })) })
            .then(answer => {
              for (const row of answer || []) priceOf.set(entryKey({ set: row.set, number: row.number }), row);
              for (const card of missing.slice(0, 600)) if (!priceOf.has(entryKey(card))) priceOf.set(entryKey(card), {});
              paintTotal();
            })
            .catch(() => { totalLine.title = 'Could not read prices'; });
        }, 300);
      }
    }

    async function persist() {
      await chrome.storage.local.set({ cards });
      shared.clipboardCards = cards;
      render();
      scan();
      refreshPrintButtons();
    }
    // The formatting and identity rules live in src/core/clipboard-format.js; see the
    // note where they are taken.
    function render() {
      badge.textContent = String(cards.length);
      badge.hidden = !cards.length;
      open.setAttribute('aria-label', `${'Show card list'} (${cards.length})`);
      list.replaceChildren();
      paintPicker();
      list.append(listPicker);
      if (!cards.length) { const empty = document.createElement("p"); empty.textContent = 'List is empty'; list.append(empty); return; }
      paintTotal();
      for (const [index, card] of cards.entries()) {
        const row = document.createElement("div");
        row.className = "stk-list-row";
        const link = document.createElement("a");
        link.href = /^https:\/\/(?:www\.)?scryfall\.com\/card\//.test(card.url) ? card.url : "#";
        link.textContent = card.name;
        const copyCard = iconButton('duplicate', `${'Copy card'} ${card.name}`, async () => {
          const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'moxfield' });
          try { await navigator.clipboard.writeText(formatCard(card, exportFormat)); flashCopied(copyCard, `${'Copy card'} ${card.name}`); }
          catch { copyCard.title = 'Copy failed'; }
        });
        copyCard.classList.add('stk-copy-card');
        const set = document.createElement('span');
        set.className = 'stk-list-set';
        if (card.set && card.number) set.textContent = `(${card.set.toUpperCase()}) ${card.number}`;
        const remove = button("×", async () => {
          cards.splice(index, 1);
          await persist();
        });
        remove.setAttribute("aria-label", `${'Remove'} ${card.name}`);
        row.append(link);
        if (set.textContent) row.append(set);
        row.append(copyCard, remove);
        list.append(row);
      }
    }

    // Every place Scryfall lists a card, and how to read a card off each. The grid is the
    // default search view; the other three are the views its "as" menu offers. A card page
    // is the one card, and the full view is a column of card pages, one per result.
    //
    // A text result is a single <a>, so a button put inside it would follow the link as
    // well; that click is stopped before it reaches the link. A checklist row gets a cell
    // of its own instead, so the table keeps its columns.
    const textOf = node => node ? [...node.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent).join(" ").replace(/\s+/g, " ").trim() : "";
    const cardName = scope => [...scope.querySelectorAll(".card-text-card-name")]
      .map(e => e.textContent.trim()).filter(Boolean).join(" // ");
    function placesToAdd() {
      if (cardPage) {
        const target = document.querySelector(".card-image");
        return target ? [{ target, link: location.href, name: cardName(document) }] : [];
      }
      const places = [];
      for (const target of document.querySelectorAll(".card-grid-item:not([aria-hidden='true'])")) {
        places.push({ target, link: target.querySelector("a.card-grid-item-card[href]")?.href,
          name: target.querySelector(".card-grid-item-invisible-label")?.textContent.trim() ||
            target.querySelector("img[alt]")?.getAttribute("alt")?.split(" (")[0] });
      }
      // The full view: a .card-profile per result, each with its own image.
      for (const profile of document.querySelectorAll(".card-profile")) {
        const target = profile.querySelector(".card-image");
        const link = profile.querySelector("a.print-langs-item.current[href]")?.href ||
          profile.querySelector("a[href*='/card/']")?.href;
        if (target) places.push({ target, link, name: cardName(profile) });
      }
      for (const target of document.querySelectorAll("a.text-grid-item[href]")) {
        places.push({ target, link: target.href, name: textOf(target.querySelector(".card-text-title")), stop: true });
      }
      for (const row of document.querySelectorAll("table.checklist tbody tr")) {
        const anchor = row.querySelector("a[href*='/card/']:not([tabindex])") || row.querySelector("a[href*='/card/']");
        places.push({ target: row, link: anchor && new URL(anchor.getAttribute("href"), location.href).href,
          name: anchor?.textContent.trim(), cell: true });
      }
      return places;
    }

    // Which card each add button stands for, for the Shift range; and the last one pressed.
    const addable = new WeakMap();
    let lastPressed = null;
    function scan() {
      // The checklist's header gets the column the rows get, or every row is one cell
      // longer than its heading.
      const head = document.querySelector("table.checklist thead tr");
      if (head && !head.querySelector(":scope > .stk-add-cell")) {
        const th = document.createElement("th");
        th.className = "stk-add-cell";
        head.append(th);
      }
      for (const { target, link, name, stop, cell } of placesToAdd()) {
        if (!link || !name) continue;
        const match = new URL(link).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
        if (!match) continue;
        const set = match[1];
        const number = decodeURIComponent(match[2]);
        const key = entryKey({ set, number });
        let holder = target;
        if (cell) {
          holder = target.querySelector(":scope > td.stk-add-cell");
          if (!holder) {
            holder = document.createElement("td");
            holder.className = "stk-add-cell";
            target.append(holder);
          }
        }
        let add = holder.querySelector(":scope > .stk-add");
        if (!add) {
          add = button("+", async event => {
            if (stop) { event.preventDefault(); event.stopPropagation(); }
            // Shift and a second button: every card between this one and the last one
            // pressed, in the order the page shows them, takes the state this one is
            // being given — all added, or all taken out.
            const from = lastPressed && document.contains(lastPressed) ? lastPressed : null;
            const idx = cards.findIndex(c => entryKey(c) === key);
            const adding = idx < 0;
            if (event.shiftKey && from && from !== add) {
              const order = [...document.querySelectorAll('.stk-add')];
              const [a, b] = [order.indexOf(from), order.indexOf(add)].sort((x, y) => x - y);
              if (a >= 0) {
                for (const other of order.slice(a, b + 1)) {
                  const card = addable.get(other);
                  if (!card) continue;
                  const at = cards.findIndex(c => entryKey(c) === entryKey(card));
                  if (adding && at < 0) cards.push(card);
                  else if (!adding && at >= 0) cards.splice(at, 1);
                }
                lastPressed = add;
                await persist();
                return;
              }
            }
            if (idx >= 0) cards.splice(idx, 1);
            else cards.push({ name, url: link, set, number });
            lastPressed = add;
            await persist();
          });
          add.className = "stk-add";
          holder.append(add);
        }
        addable.set(add, { name, url: link, set, number });
        const selected = cards.some(c => entryKey(c) === key);
        add.textContent = selected ? "✓" : "+";
        add.setAttribute("aria-label", `${selected ? 'Remove' : 'Add'} ${name}`);
        add.classList.toggle("stk-selected", selected);
      }
    }
    // "Add all": every result of the search on screen, not only the sixty the page
    // shows. The worker walks the API's pages; cards already in the clipboard are left
    // where they are, and the button says how many were new.
    function addAllButton() {
      if (location.pathname !== '/search') return;
      const params = new URLSearchParams(location.search);
      const query = (params.get('q') || '').trim();
      const info = document.querySelector('.search-info');
      if (!query || !info || info.querySelector('.stk-add-all')) return;
      const all = button('+ All', async () => {
        const shown = (info.textContent.match(/of\s+([\d,]+)/) || [])[1];
        const count = shown ? Number(shown.replace(/,/g, '')) : 0;
        if (count > 175 && !confirm(`Add all ${count} cards to the clipboard?` +
          (count > 1750 ? ' Only the first 1750 will be added.' : ''))) return;
        all.disabled = true;
        all.textContent = 'Adding…';
        try {
          const result = await request({ type: 'searchAll', query,
            unique: params.get('unique') || 'cards', order: params.get('order') || '', dir: params.get('dir') || '' });
          const have = new Set(cards.map(entryKey));
          const fresh = result.cards.filter(card => !have.has(entryKey(card)) && have.add(entryKey(card)));
          cards.push(...fresh);
          await persist();
          all.textContent = `✓ ${fresh.length} added`;
          all.title = result.truncated ? `Only the first ${result.cards.length} of ${result.total} were added` : '';
        } catch {
          all.textContent = '+ All';
          all.title = 'Could not load the results';
        }
        all.disabled = false;
      });
      all.className = 'stk-add-all';
      all.title = 'Add every result of this search to the clipboard';
      all.setAttribute('aria-label', all.title);
      (info.querySelector('p') || info).append(all);
    }
    render();
    scan();
    addAllButton();
    let pending = false;
    const ADDABLE = ".card-grid-item, .card-image, a.text-grid-item, table.checklist tr";
    new MutationObserver(mutations => {
      if (!mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 &&
        (n.matches?.(ADDABLE) || n.querySelector?.(ADDABLE))))) return;
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; scan(); }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener(changes => {
      if (changes.clipLists) {
        clipLists = readLists(changes.clipLists.newValue);
        if (!changes.cards) render();
      }
      if (changes.cards && Array.isArray(changes.cards.newValue)) {
        cards = changes.cards.newValue;
        shared.clipboardCards = cards;
        render();
        scan();
        refreshPrintButtons();
      }
    });
    window.STK_ADD_PRINT = async card => {
      if (!card?.name || !card?.set || !card?.number) return;
      const index = cards.findIndex(item => item.name === card.name && item.set === card.set && item.number === card.number);
      if (index >= 0) cards.splice(index, 1);
      else cards.push({ name:card.name, url:card.uri, set:card.set, number:card.number, forceSet:true });
      await persist();
      return index < 0;
    };
  }

  function initNativePrintButtons() {
    const name = [...document.querySelectorAll('#main .card-text-card-name')].map(node => node.textContent.trim()).filter(Boolean).join(' // ');
    if (!name) return;
    for (const row of document.querySelectorAll('#main .prints > .prints-table tbody tr')) {
      const cell = row.querySelector('td:first-child');
      // The View-all line spans the whole table and is not a printing.
      if (!cell || cell.colSpan > 1) continue;
      const link = cell.querySelector('a[href^="/card/"],a[href^="https://scryfall.com/card/"]');
      const parts = link && new URL(link.href,location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!parts) continue;
      const set = parts[1];
      const number = decodeURIComponent(parts[2]);
      attachPrintButton(cell, printKey(set, number), { name, uri: link.href, set, number },
        'Add this printing with its set');
    }
  }


  self.STK_CONTENT.on("clipboard", () => initClipboard());
  self.STK_CONTENT.on("nativePrintButtons", () => initNativePrintButtons());
})();
