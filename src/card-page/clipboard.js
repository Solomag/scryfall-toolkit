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

    const root = document.createElement("aside");
    root.id = "scryfall-toolkit-clipboard";
    root.setAttribute("aria-label", "Card clipboard");
    const toolbar = document.createElement("div");
    toolbar.className = "stk-toolbar";
    const list = document.createElement("div");
    list.className = "stk-list";
    const open = iconButton('clip', t('Показать список карт'), () => { list.hidden = !list.hidden; });
    const badge = document.createElement('span');
    badge.className = 'stk-count';
    badge.setAttribute('aria-hidden', 'true');
    open.append(badge);
    const writeClipboard = async (format, control, restLabel, stripSets) => {
      const text = clipboardText(cards, format, stripSets);
      try { await navigator.clipboard.writeText(text); flashCopied(control, restLabel); }
      catch { control.title = t('Ошибка копирования'); }
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
    const copy = iconButton('duplicate', t('Копировать карты'), async () => {
      const format = (await chrome.storage.local.get({ exportFormat: "moxfield" })).exportFormat;
      await writeClipboard(format, copy, t('Копировать карты'));
    });
    const labelOf = other => {
      const entry = FORMATS[other] || FORMATS.names;
      return language === 'ru' ? entry.ru : entry.en;
    };
    let shownFormat = null;
    const paintMenu = format => {
      if (shownFormat === format) return;
      shownFormat = format;
      const other = otherFormat(format);
      plain.textContent = labelOf(other);
      plain.title = `${t('Скопировать в формате')} ${labelOf(other)}`;
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
    const clear = iconButton('trash', t('Очистить буфер карт'), async () => {
      if (!cards.length || !confirm(t('Очистить буфер карт?'))) return;
      cards = [];
      await persist();
    });
    toolbar.append(wrap, clear, open);
    root.append(toolbar, list);
    document.body.append(root);
    list.hidden = true;

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
      open.setAttribute('aria-label', `${t('Показать список карт')} (${cards.length})`);
      list.replaceChildren();
      if (!cards.length) { const empty = document.createElement("p"); empty.textContent = t('Список пуст'); list.append(empty); return; }
      for (const [index, card] of cards.entries()) {
        const row = document.createElement("div");
        row.className = "stk-list-row";
        const link = document.createElement("a");
        link.href = /^https:\/\/(?:www\.)?scryfall\.com\/card\//.test(card.url) ? card.url : "#";
        link.textContent = card.name;
        const copyCard = iconButton('duplicate', `${t('Копировать карту')} ${card.name}`, async () => {
          const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'moxfield' });
          try { await navigator.clipboard.writeText(formatCard(card, exportFormat)); flashCopied(copyCard, `${t('Копировать карту')} ${card.name}`); }
          catch { copyCard.title = t('Ошибка копирования'); }
        });
        copyCard.classList.add('stk-copy-card');
        const set = document.createElement('span');
        set.className = 'stk-list-set';
        if (card.set && card.number) set.textContent = `(${card.set.toUpperCase()}) ${card.number}`;
        const remove = button("×", async () => {
          cards.splice(index, 1);
          await persist();
        });
        remove.setAttribute("aria-label", `${t('Удалить')} ${card.name}`);
        row.append(link);
        if (set.textContent) row.append(set);
        row.append(copyCard, remove);
        list.append(row);
      }
    }

    function scan() {
      const targets = cardPage ? [document.querySelector(".card-image")].filter(Boolean) :
        [...document.querySelectorAll(".card-grid-item:not([aria-hidden='true'])")];
      for (const target of targets) {
        const link = cardPage ? location.href : target.querySelector("a.card-grid-item-card[href]")?.href;
        if (!link) continue;
        const match = new URL(link).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
        if (!match) continue;
        const name = (cardPage ?
          [...document.querySelectorAll(".card-text-card-name")].map(e => e.textContent.trim()).filter(Boolean).join(" // ") :
          target.querySelector(".card-grid-item-invisible-label")?.textContent.trim()) ||
          target.querySelector("img[alt]")?.getAttribute("alt")?.split(" (")[0];
        if (!name) continue;
        const set = match[1];
        const number = decodeURIComponent(match[2]);
        const key = entryKey({ set, number });
        let add = target.querySelector(":scope > .stk-add");
        if (!add) {
          add = button("+", async () => {
            const idx = cards.findIndex(c => entryKey(c) === key);
            if (idx >= 0) cards.splice(idx, 1);
            else cards.push({ name, url: link, set, number });
            await persist();
          });
          add.className = "stk-add";
          target.append(add);
        }
        const selected = cards.some(c => entryKey(c) === key);
        add.textContent = selected ? "✓" : "+";
        add.setAttribute("aria-label", `${t(selected ? 'Удалить' : 'Добавить')} ${name}`);
        add.classList.toggle("stk-selected", selected);
      }
    }
    render();
    scan();
    let pending = false;
    new MutationObserver(mutations => {
      if (!mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 &&
        (n.matches?.(".card-grid-item, .card-image") || n.querySelector?.(".card-grid-item, .card-image"))))) return;
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; scan(); }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener(changes => {
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
        language === 'ru' ? 'Добавить это издание с сетом' : 'Add this printing with its set');
    }
  }


  self.STK_CONTENT.on("clipboard", () => initClipboard());
  self.STK_CONTENT.on("nativePrintButtons", () => initNativePrintButtons());
})();
