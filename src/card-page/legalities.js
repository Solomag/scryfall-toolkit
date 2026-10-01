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

// Scryfall's own legality block, with the extra formats added to it.
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

  async function initLegalities() {
    const table = document.querySelector("#main .card-legality");
    const id = document.querySelector('meta[name="scryfall:card:id"]')?.content ||
      document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
    let oracleId = document.querySelector('meta[name="scryfall:oracle:id"]')?.content;
    if (!table || document.getElementById("stk-legalities")) return;
    const catalog = window.STK_FORMAT_CATALOG;
    const keys = new Map(catalog.map(([key, label]) => [label.toLowerCase(), key]));
    const formatKey = name => keys.get(name.trim().toLowerCase()) || `other:${name.trim().toLowerCase()}`;
    const visible = key => {
      if (Object.prototype.hasOwnProperty.call(settings.formatVisibility || {}, key)) return settings.formatVisibility[key];
      if (["premodern", "heritage", "classic", "peak"].includes(key)) return settings[key];
      return true;
    };
    const order = Array.isArray(settings.formatOrder) ? settings.formatOrder : catalog.map(([key]) => key);
    let nextOrder = 0;
    function arrange() {
      const stats = table.querySelector(':scope > #stk-edhrec');
      const cells = [...table.querySelectorAll(":scope > .card-legality-row > .card-legality-item")]
        .map(cell => ({ cell, key: formatKey(cell.querySelector("dt")?.textContent || ""), index: nextOrder++ }))
        .filter(item => visible(item.key));
      cells.sort((a,b) => {
        const ai = order.indexOf(a.key), bi = order.indexOf(b.key);
        return (ai < 0 ? order.length + a.index : ai) - (bi < 0 ? order.length + b.index : bi);
      });
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < cells.length; i += 2) {
        const row = document.createElement("div");
        row.className = "card-legality-row stk-legality-row";
        if (i === 0) row.id = "stk-legalities";
        row.append(cells[i].cell);
        if (cells[i + 1]) row.append(cells[i + 1].cell);
        fragment.append(row);
      }
      table.replaceChildren(fragment);
      if (stats) table.append(stats);
      table.hidden = cells.length === 0 && !stats;
    }
    const unknown = [...table.querySelectorAll(":scope > .card-legality-row .card-legality-item dt")]
      .map(el => ({ key: formatKey(el.textContent), label: el.textContent.trim() }))
      .filter(item => item.key.startsWith("other:"));
    if (unknown.length) {
      chrome.storage.local.get({ discoveredFormats: [] }).then(({ discoveredFormats }) => {
        const all = new Map(discoveredFormats.map(item => [item.key, item]));
        for (const item of unknown) all.set(item.key, item);
        if (all.size !== discoveredFormats.length) chrome.storage.local.set({ discoveredFormats: [...all.values()] });
      });
    }
    arrange();
    if (!settings.legalities || !id) return;
    const enabled = ["premodern", "heritage", "classic", "peak"].filter(visible);
    if (!enabled.length) return;
    let card;
    if (!oracleId || enabled.includes('premodern')) {
      try { card = await request({ type: 'card', id }); oracleId ||= card.oracle_id; }
      catch { /* Extra formats may still be available from the page. */ }
    }
    const names = { premodern: "Premodern", heritage: "Heritage", classic: "Classic Legacy", peak: "Peak Legacy" };
    const results = await Promise.all(enabled.map(async key => {
      try {
        if (key === "premodern") {
          return card?.legalities?.premodern;
        }
        if (!oracleId) return 'error';
        const found = await request({ type: "query", oracleId, format: key });
        return found.legality;
      } catch { return "error"; }
    }));
    for (let i = 0; i < enabled.length; i++) {
      const cell = document.createElement("div");
      cell.className = "card-legality-item";
      const label = document.createElement("dt");
      label.textContent = names[enabled[i]];
      const state = document.createElement("dd");
      const value = results[i];
      state.textContent = value === "legal" ? "Legal" : value === "banned" ? "Banned" :
        value === "restricted" ? "Restricted" : value === "not_legal" ? "Not Legal" : "Unavailable";
      state.className = value === "not_legal" || !["legal", "banned", "restricted"].includes(value)
        ? "not-legal" : value;
      cell.append(label, state);
      let row = table.lastElementChild;
      if (!row || !row.classList.contains("card-legality-row") || row.children.length === 2) {
        row = document.createElement("div");
        row.className = "card-legality-row";
        table.append(row);
      }
      row.append(cell);
    }
    table.hidden = false;
    arrange();
    // The stats panel under the block has to follow the new column layout.
    shared.realignStatsPanel?.();
  }


  self.STK_CONTENT.on("legalities", () => initLegalities());
})();
