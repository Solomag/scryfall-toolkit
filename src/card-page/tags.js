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

// Tag panels, related cards, and the hover preview they share.
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

  function initTags() {
    if ((!settings.cardTags && !settings.artTags && !settings.relationships) || document.getElementById("stk-tags")) return;
    const prints = document.querySelector("#main .prints");
    const anchor = [...(prints?.querySelectorAll(".prints-table") || [])].at(-1);
    if (!anchor) return;
    prints.closest(".inner-flex")?.classList.add("stk-has-tags");
    const panel = document.createElement("div");
    panel.id = "stk-tags";
    panel.classList.add('stk-loading');
    panel.textContent = t('Загружаю теги…');
    anchor.after(panel);
    let noticeTimeout;
    function showTagNotice(token) {
      let notice = document.getElementById("stk-tag-notice");
      if (!notice) {
        notice = document.createElement("div");
        notice.id = "stk-tag-notice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        document.body.append(notice);
      }
      notice.textContent = language === 'ru' ? `Добавлено в поиск: ${token}` : `Added to search: ${token}`;
      clearTimeout(noticeTimeout);
      noticeTimeout = setTimeout(() => notice.remove(), 2200);
    }
    function tagIcon(type) {
      const icon = document.createElement("span");
      icon.className = "stk-tag-icon";
      if (["WITHOUT_BODY"].includes(type)) icon.classList.add("icon-upside-down");
      if (["COMES_BEFORE", "DEPICTS", "REFERENCES_TO", "WORSE_THAN"].includes(type)) icon.classList.add("icon-flipped");
      // Only render SVG literals bundled from Shambleshark; never insert API markup.
      const icons = window.STK_TAG_ICONS;
      icon.innerHTML = Object.prototype.hasOwnProperty.call(icons, type)
        ? icons[type] : icons.ORACLE_CARD_TAG;
      icon.title = type.toLowerCase().replaceAll("_", " ");
      return icon;
    }
    request({ type: "tags", ...identity }).then(tags => {
      panel.classList.remove('stk-loading');
      panel.replaceChildren();
      const relations = [...(tags.card || []), ...(tags.art || [])].filter(item => item.relation);
      const relationOrder = ['SIMILAR_TO', 'BETTER_THAN', 'WORSE_THAN', 'COMES_BEFORE', 'COMES_AFTER', 'MIRRORS', 'RELATED_TO', 'DEPICTED_IN', 'DEPICTS', 'REFERENCED_BY', 'REFERENCES_TO'];
      relations.sort((a, b) => {
        const rank = item => { const i = relationOrder.indexOf(item.tagType); return i < 0 ? relationOrder.length : i; };
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      });
      for (const [enabled, kind, heading, prefix, entries] of [
        [settings.cardTags, "card", "Card Tags", "otag", (tags.card || []).filter(item => !item.relation)],
        [settings.artTags, "art", "Art Tags", "art", (tags.art || []).filter(item => !item.relation)],
        [settings.relationships, "related", "Related Cards", null, relations]
      ]) {
        if (!enabled || !entries.length) continue;
        const table = document.createElement("table");
        table.className = `prints-table stk-tags-table stk-${kind}-table`;
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        const th = document.createElement("th");
        const title = document.createElement("a");
        title.href = `https://tagger.scryfall.com/card/${encodeURIComponent(identity.set)}/${encodeURIComponent(identity.number)}`;
        title.textContent = language === 'ru' ? ({'Card Tags':'Теги карты','Art Tags':'Теги рисунка','Related Cards':'Связанные карты'}[heading] || heading) : heading;
        th.append(title);
        headRow.append(th);
        head.append(headRow);
        const body = document.createElement("tbody");
        let expanded = false;
        const render = () => {
          body.replaceChildren();
          for (const tag of expanded ? entries : entries.slice(0, 6)) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            const a = document.createElement("a");
            const tagType = tag.tagType || (kind === "art" ? "ILLUSTRATION_TAG" : "ORACLE_CARD_TAG");
            const token = `${prefix}:${tag.slug}`;
            if (tag.relation) {
              const kind = tag.targetKind === 'art' ? 'illustrationid' : 'oracleid';
              const query = `${kind}:${tag.targetId}`;
              a.href = `/search?q=${encodeURIComponent(query)}`;
              a.title = `${tagType.toLowerCase().replaceAll("_", " ")}: ${tag.name}`;
              enablePreview(a, () => request({ type: 'preview', kind, id: tag.targetId }));
              // Open the actual card detail so prices, tags and legality load.
              // Keep the search URL as a usable fallback if the API fails.
              a.addEventListener('click', async event => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                try {
                  const card = await request({type:'preview', kind, id:tag.targetId});
                  location.assign(card.uri);
                } catch { location.assign(a.href); }
              });
            } else if (tagType === "PRINTING_TAG") {
              a.href = `https://tagger.scryfall.com/tags/print/${encodeURIComponent(tag.slug)}`;
              a.title = language === 'ru' ? `Открыть печатный тег ${tag.name} в Tagger` : `Open printing tag ${tag.name} in Tagger`;
            } else {
              a.href = `/search?q=${encodeURIComponent(token)}`;
              a.title = language === 'ru' ? `Добавить ${token} в поиск` : `Add ${token} to search`;
              a.addEventListener("click", event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                const input = document.querySelector("#header-search-field") || document.querySelector("input[name='q']");
                if (!input) return;
                event.preventDefault();
                const next = [input.value.trim(), token].filter(Boolean).join(" ");
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                if (setter) setter.call(input, next); else input.value = next;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                showTagNotice(token);
              });
            }
            const label = document.createElement("span");
            label.textContent = (tag.name || tag.slug).replace(/-/g, " ");
            a.append(tagIcon(tagType), label);
            cell.append(a);
            row.append(cell);
            body.append(row);
          }
          if (entries.length > 6) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            const toggle = document.createElement('a');
            toggle.href = '#';
            toggle.textContent = expanded ? (language === 'ru' ? 'Скрыть теги ↑' : 'Show fewer tags ↑') : (language === 'ru' ? 'Показать все теги →' : 'View all tags →');
            toggle.addEventListener('click', event => {
              event.preventDefault();
              expanded = !expanded;
              render();
            });
            toggle.className = "stk-tags-toggle";
            toggle.setAttribute("aria-expanded", String(expanded));
            cell.append(toggle);
            row.append(cell);
            body.append(row);
          }
        };
        render();
        table.append(head, body);
        panel.append(table);
      }
      if (!panel.children.length) panel.textContent = t('Для этой карты тегов нет');
      if (tags.fallback) {
        const fallback = document.createElement("p");
        fallback.className = "stk-tag-fallback";
        fallback.textContent = t('Связи Tagger сейчас недоступны; теги показаны из локального списка.');
        panel.append(fallback);
      }
    }).catch(error => {
      panel.classList.remove('stk-loading');
      panel.replaceChildren();
      const link = document.createElement("a");
      link.href = `https://tagger.scryfall.com/card/${encodeURIComponent(identity.set)}/${encodeURIComponent(identity.number)}`;
      link.textContent = t('Теги недоступны — открыть Tagger');
      link.title = error.message;
      panel.append(link);
    });
  }

  function initSearchTaggerLinks() {
    function scanTaggerLinks() { for (const item of document.querySelectorAll('.card-grid-item')) {
      if (item.querySelector('.stk-tagger-link')) continue;
      const link = item.querySelector('a.card-grid-item-card[href]');
      const match = link?.href && new URL(link.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!match) continue;
      const tagger = document.createElement('a');
      tagger.className = 'stk-tagger-link';
      tagger.href = `https://tagger.scryfall.com/card/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`;
      tagger.title = t('Открыть теги карты в Tagger');
      tagger.textContent = '◆';
      tagger.setAttribute('aria-label', tagger.title);
      item.append(tagger);
    } }
    scanTaggerLinks();
    new MutationObserver(scanTaggerLinks).observe(document.querySelector('#main') || document.body, { childList: true, subtree: true });
  }


  self.STK_CONTENT.on("tags", () => initTags());
  self.STK_CONTENT.on("searchTaggerLinks", () => initSearchTaggerLinks());
})();
