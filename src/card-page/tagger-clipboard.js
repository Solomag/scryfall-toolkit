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
// Share the Scryfall clipboard on Tagger without changing Tagger's own tagging UI.
(async () => {
  const settings = await chrome.storage.local.get({ clipboard: true, cards: [], exportFormat: 'moxfield', siteLanguage: 'en' });
  const t = text => window.STK_I18N.t(text, settings.siteLanguage === 'ru' ? 'ru' : 'en');
  if (!settings.clipboard || document.getElementById('scryfall-toolkit-clipboard')) return;
  let cards = Array.isArray(settings.cards) ? settings.cards : [];
  const root = document.createElement('aside');
  root.id = 'scryfall-toolkit-clipboard';
  root.setAttribute('aria-label', 'Card clipboard');
  const toolbar = document.createElement('div');
  toolbar.className = 'stk-toolbar';
  const list = document.createElement('div');
  list.className = 'stk-list';
  list.hidden = true;
  const iconButton = (icon, label, click) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `stk-icon-button stk-icon-${icon}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    const image = document.createElement('img');
    image.src = chrome.runtime.getURL(`assets/icons/${icon}.svg`);
    image.alt = '';
    button.append(image);
    button.addEventListener('click', click);
    return button;
  };
  const badge = document.createElement('span');
  const formatCard = (card, format) => `1 ${card.name}${format === 'moxfield' && card.set && card.number ? ` (${card.set.toUpperCase()}) ${card.number}` : ''}`;
  badge.className = 'stk-count';
  badge.setAttribute('aria-hidden', 'true');
  const open = iconButton('clip', t('Показать список карт'), () => { list.hidden = !list.hidden; });
  open.append(badge);
  const writeClipboard = async (format, control, restLabel) => {
    const value = cards.map(c => formatCard(c, format)).join('\n');
    try {
      await navigator.clipboard.writeText(value);
      control.title = t('Скопировано');
      control.classList.add('stk-copied');
    } catch { control.title = t('Ошибка копирования'); }
    setTimeout(() => { control.title = restLabel; control.classList.remove('stk-copied'); }, 1000);
  };
  // Same shape as the Scryfall clipboard: sets by default, "names only" in a
  // small menu revealed above the copy button on hover.
  const wrap = document.createElement('span');
  wrap.className = 'stk-copy-wrap';
  const menu = document.createElement('span');
  menu.className = 'stk-copy-menu';
  menu.hidden = true;
  const plain = document.createElement('button');
  plain.type = 'button';
  plain.className = 'stk-copy-plain';
  plain.textContent = t('Только названия без сетов');
  menu.append(plain);
  const copy = iconButton('duplicate', t('Копировать карты'), async () => {
    const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'moxfield' });
    await writeClipboard(exportFormat, copy, t('Копировать карты'));
  });
  plain.addEventListener('click', async () => {
    menu.hidden = true;
    await writeClipboard('names', plain, t('Только названия без сетов'));
  });
  wrap.append(menu, copy);
  let hideMenuTimer;
  const showMenu = () => { clearTimeout(hideMenuTimer); menu.hidden = false; };
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
  (document.body || document.documentElement).append(root);

  async function persist() {
    await chrome.storage.local.set({ cards });
    render();
    scan();
  }
  function render() {
    badge.textContent = String(cards.length);
    badge.hidden = !cards.length;
    open.setAttribute('aria-label', `${t('Показать список карт')} (${cards.length})`);
    list.replaceChildren();
    if (!cards.length) {
      const empty = document.createElement('p');
      empty.textContent = t('Список пуст');
      list.append(empty);
      return;
    }
    for (const card of cards) {
      const row = document.createElement('div');
      row.className = 'stk-list-row';
      const link = document.createElement('a');
      link.href = /^https:\/\/(?:www\.)?scryfall\.com\/card\//.test(card.url) ? card.url : '#';
      link.textContent = card.name;
      const copyCard = iconButton('duplicate', `${t('Копировать карту')} ${card.name}`, async () => {
        const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'moxfield' });
        try { await navigator.clipboard.writeText(formatCard(card, exportFormat)); copyCard.title = t('Скопировано'); copyCard.classList.add('stk-copied'); }
        catch { copyCard.title = t('Ошибка копирования'); }
        setTimeout(() => { copyCard.title = `${t('Копировать карту')} ${card.name}`; copyCard.classList.remove('stk-copied'); }, 1000);
      });
      copyCard.classList.add('stk-copy-card');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${t('Удалить')} ${card.name}`);
      remove.addEventListener('click', async () => {
        cards = cards.filter(c => c.name !== card.name);
        await persist();
      });
      row.append(link);
      if (card.set && card.number) {
        const set = document.createElement('span');
        set.className = 'stk-list-set';
        set.textContent = `(${card.set.toUpperCase()}) ${card.number}`;
        row.append(set);
      }
      row.append(copyCard, remove);
      list.append(row);
    }
  }
  function scan() {
    const match = location.pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
    const detail = match && document.querySelector('main .card-layout .card-image,main .card-image');
    const targets = detail ? [detail] : [...document.querySelectorAll('main .card-grid-item:has(>a.card[href^="/card/"])')];
    for (const target of targets) {
      const cardLink = detail ? location.href : target.querySelector(':scope > a.card[href^="/card/"]')?.href;
      const parts = new URL(cardLink, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!parts) continue;
      const name = detail
        ? [...(document.querySelector('main h1')?.childNodes || [])].find(node => node.nodeType === 3 && node.textContent.trim())?.textContent.trim()
        : target.querySelector(':scope > a.card img[alt]')?.alt.trim();
      if (!name) continue;
      const canonical = `https://scryfall.com/card/${encodeURIComponent(parts[1])}/${encodeURIComponent(decodeURIComponent(parts[2]))}`;
      const existing = target.querySelector(':scope > .stk-add');
      if (existing && existing.dataset.url !== canonical) existing.remove();
      let add = target.querySelector(':scope > .stk-add');
      if (!add) {
        add = document.createElement('button');
        add.type = 'button';
        add.className = 'stk-add';
        add.dataset.url = canonical;
        add.addEventListener('click', async () => {
          const index = cards.findIndex(c => c.name === name);
          if (index >= 0) cards.splice(index, 1);
          else cards.push({ name, url: canonical, set: parts[1], number: decodeURIComponent(parts[2]) });
          await persist();
        });
        target.append(add);
      }
      const selected = cards.some(c => c.name === name);
      if (add.textContent !== (selected ? '✓' : '+')) add.textContent = selected ? '✓' : '+';
      add.classList.toggle('stk-selected', selected);
      add.setAttribute('aria-label', `${t(selected ? 'Удалить' : 'Добавить')} ${name}`);
    }
  }
  render();
  scan();
  let scheduled = false;
  new MutationObserver(mutations => {
    // Tagger mounts the card, image and heading in separate Vue updates. A
    // mutation on the heading can be a text-node addition, not characterData.
    if (!mutations.some(m => m.type === 'childList' || m.type === 'characterData' ||
      m.type === 'attributes' && m.target.matches?.('main .card-image img,main a.card'))) return;
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; scan(); }, 100);
  }).observe(document.body, {childList: true, characterData: true, attributes: true, attributeFilter: ['href','src'], subtree: true});
  chrome.storage.onChanged.addListener(changes => {
    if (changes.cards && Array.isArray(changes.cards.newValue)) {
      cards = changes.cards.newValue;
      render();
      scan();
    }
  });
})();
