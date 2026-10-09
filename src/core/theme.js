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
// The theme follows the operating system until the user picks light or dark,
// so a machine or phone that switches its own appearance switches Scryfall too.
const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
const themeMode = value => {
  if (value === true) return 'dark';
  if (value === false || value === 'light') return 'light';
  if (value === 'dark') return 'dark';
  return systemDark && systemDark.matches ? 'dark' : 'light';
};
let currentTheme = 'auto';
const applyTheme = value => {
  // Installations from before the three-way choice stored a boolean.
  const stored = value === true ? 'dark' : value === false ? 'light' : value;
  currentTheme = ['auto', 'light', 'dark'].includes(stored) ? stored : 'auto';
  const dark = themeMode(currentTheme) === 'dark';
  document.documentElement.classList.toggle("stk-dark", dark);
  if (dark) { repairAccountColors(); repairDarkPurple(); repairBotsArtwork(); }
};
if (systemDark && systemDark.addEventListener) {
  systemDark.addEventListener('change', () => { if (currentTheme === 'auto') applyTheme('auto'); });
}
// The stylesheet is injected by the manifest before anything paints, but every
// rule in it hangs off html.stk-dark, and that class was only added once the
// stored preference came back. Storage is asynchronous, so Scryfall painted a
// light page first — the white flash on every navigation, and on a slow answer a
// white page. The default preference is "follow the system", and the system
// answers synchronously, so the class is set before the first paint and storage
// simply corrects it a moment later.
if (themeMode('auto') === 'dark') document.documentElement.classList.add('stk-dark');
chrome.storage.local.get({ darkTheme: 'auto', settingsLanguage: 'auto', setFilters: null })
  .then(({ darkTheme, settingsLanguage, setFilters }) => {
  // The Caster marker reads `setFilters.showCaster`, and the class is the opposite of it.
  //
  // It used to read a flat `hideCasterIndicator`, which nothing has written since the settings
  // were folded into `setFilters` — the options page wrote `setFilters.caster` and this read a
  // key that had no writer, so the switch on the settings page changed a value nobody read and
  // the marker never went away. The test that covered this asked the theme script to read the
  // flat key directly, which is the same fiction one level up: it proved the read and never the
  // write.
  document.documentElement.classList.toggle('stk-hide-caster', !(setFilters?.showCaster !== false));
  // The site's own controls are translated for the same language the rest of the extension
  // speaks. There used to be a separate setting for this; it is the General choice now, so
  // "as in the browser" means the same thing on the settings page and on the site.
  const siteRu = window.STK_I18N.resolveSettingsLanguage(settingsLanguage) === 'ru';
  document.documentElement.classList.toggle('stk-site-ru', siteRu);
  if (siteRu) translateSiteControls();
  applyTheme(darkTheme);
});
if (/^\/(?:settings|profile|decks|@[^/]+(?:\/decks)?|users|account|contact)(?:\/|$)/.test(location.pathname)) {
  document.documentElement.classList.add('stk-account-page');
}
if (/^\/(?:bots|docs|about|donate|blog)(?:\/|$)/.test(location.pathname)) document.documentElement.classList.add('stk-info-page');
if (/^\/(?:bots|docs)(?:\/|$)/.test(location.pathname)) document.documentElement.classList.add('stk-docs-page');
if (/^\/blog(?:\/|$)/.test(location.pathname)) document.documentElement.classList.add('stk-blog-page');
if (/^\/team(?:\/|$)/.test(location.pathname)) document.documentElement.classList.add('stk-team-page');
if (/^\/bots(?:\/|$)/.test(location.pathname)) document.documentElement.classList.add('stk-bots-page');
// Tagger lives on its own host and shares no class names with Scryfall, so the
// theme marks it separately and keeps its rules away from the main site.
if (/(^|\.)tagger\.scryfall\.com$/.test(location.hostname)) document.documentElement.classList.add('stk-tagger');
if (/^\/(?:@[^/]+\/decks|decks)(?:\/|$)/.test(location.pathname)) initDeckActionsLayout();
chrome.storage.onChanged.addListener(changes => {
  if (changes.setFilters) {
  // Read out of the whole object rather than out of a named key, because the key inside it was
  // renamed when the switch stopped reading "hide". A reader on the old shape has no
  // `showCaster`, and there `undefined` means "shown", which is what the old `false` meant too.
  document.documentElement.classList.toggle('stk-hide-caster',
    !(changes.setFilters.newValue?.showCaster !== false));
}
  if (changes.settingsLanguage) {
    document.documentElement.classList.toggle('stk-site-ru',
      window.STK_I18N.resolveSettingsLanguage(changes.settingsLanguage.newValue) === 'ru');
  }
  if (changes.darkTheme) applyTheme(changes.darkTheme.newValue);
});

function repairDarkPurple() {
  if (document.documentElement.dataset.stkPurpleRepair === 'true') return;
  document.documentElement.dataset.stkPurpleRepair = 'true';
  let scheduled = false;
  const pending = new Set();
  const selector = 'a,button,label,span,p,li,small,abbr,option,h1,h2,h3,h4,h5,h6,strong,b,em,i,u,s,sub,sup,code,pre,kbd,samp,var,cite,dfn,mark,legend,figcaption,summary,caption,dt,dd,th,td';
  // Scryfall marks its links with one purple, but it hands that colour to plain
  // inline tags too (strong in the empty search, b in the jump bar), so the list
  // covers the text tags a link or a sentence can be built from. The test is the
  // colour itself rather than one literal: a purple dark enough to sink into a
  // dark surface is replaced whatever shade of purple Scryfall wrote it as, and a
  // blue or a pink is left alone because a blue needs no lift and a pink is
  // already light.
  const sinkIntoDark = value => {
    const match = String(value).match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const [red, green, blue] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (blue < 90 || blue - green < 25 || red - green < 10) return false;
    const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue) < 0.22;
  };
  const scan = (root = document.getElementById('main')) => {
    if (!document.documentElement.classList.contains('stk-dark')) return;
    const main = document.getElementById('main');
    if (!main || !root || root !== main && !main.contains(root) && !root.contains(main)) return;
    const candidates = root === main ? main.querySelectorAll(selector) :
      [root, ...root.querySelectorAll(selector)];
    for (const node of candidates) {
      if (!node.matches(selector) || !main.contains(node)) continue;
      if (node.classList.contains('stk-brighter-purple')) continue;
      if (sinkIntoDark(getComputedStyle(node).color)) node.classList.add('stk-brighter-purple');
    }
  };
  // Scryfall's own stylesheet is not an obstacle to the first paint of a
  // content script, so at DOMContentLoaded a link still wears the browser's
  // default blue and the scan finds no purple to lift. The purple only arrives
  // with the stylesheet, so the scan waits for the load event as well, and once
  // more after it: a late stylesheet, a font swap or a client-side route can all
  // repaint after the first look.
  // The frame callback is wrapped rather than passed on: a frame hands its
  // timestamp to the callback, and scan's first argument is the root to read.
  const settle = () => { scan(); requestAnimationFrame(() => requestAnimationFrame(() => scan())); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settle, {once:true});
    window.addEventListener('load', settle, {once:true});
  } else {
    settle();
    window.addEventListener('load', settle, {once:true});
  }
  new MutationObserver(mutations => {
    for (const mutation of mutations) for (const node of mutation.addedNodes) if (node.nodeType === 1) pending.add(node);
    if (!pending.size) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      for (const root of pending) scan(root);
      pending.clear();
    });
  }).observe(document.documentElement, {childList:true,subtree:true});
}

// The bots page shows two screenshots of Scryfall's own bot inside Slack, taken
// while Slack wore its light theme. A white window on a dark card reads as a
// blank block, so a light screenshot is turned the other way round. Only a
// picture that is light all over is turned: one that mixes a light window with a
// dark one is a picture of two things, and turning it round would only move the
// bright block from one half to the other. A picture the browser will not let us
// sample keeps its own paint as well.
function repairBotsArtwork() {
  if (!document.documentElement.classList.contains('stk-bots-page')) return;
  const shareOfLight = image => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(image, 0, 0, 8, 8);
      const {data} = context.getImageData(0, 0, 8, 8);
      let light = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const value = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (value > 140) light++;
        count++;
      }
      return count ? light / count : null;
    } catch (error) {
      return null;
    }
  };
  const scan = () => {
    for (const image of document.querySelectorAll('#main img.marketing-features-item-image')) {
      if (image.dataset.stkScreenshot) continue;
      const mark = () => {
        const share = shareOfLight(image);
        image.dataset.stkScreenshot = share === null ? 'unreadable' : 'measured';
        if (share !== null && share >= 0.8) image.classList.add('stk-light-screenshot');
      };
      if (image.complete && image.naturalWidth) mark();
      else image.addEventListener('load', mark, {once: true});
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once: true});
  else scan();
}

function translateSiteControls() {
  // Translate navigational chrome and status labels only. Never rewrite card
  // names, rules, user content or search queries: that would change their data.
  const names = {
    'Advanced':'Расширенный поиск','Syntax':'Синтаксис','Sets':'Сеты','Random':'Случайная',
    'Prints':'Издания','View all prints →':'Показать все издания →',
    'Legal':'Легально','Not Legal':'Нелегально','Banned':'Запрещено','Restricted':'Ограничено','Unavailable':'Недоступно',
    'Search for Magic cards…':'Поиск карт Magic…'
  };
  let pending = false;
  const scan = () => {
    if (!document.documentElement.classList.contains('stk-site-ru')) return;
    for (const node of document.querySelectorAll('#header a, #header button, #main .prints-table thead th, #main .prints-table .prints-all a, #main .card-legality dd, #main .search-controls button')) {
      for (const child of node.childNodes) {
        if (child.nodeType !== 3) continue;
        const source = child.textContent;
        const trimmed = source.trim();
        if (names[trimmed]) child.textContent = source.replace(trimmed, names[trimmed]);
      }
    }
    const search = document.getElementById('header-search-field');
    if (search?.placeholder && names[search.placeholder]) search.placeholder = names[search.placeholder];
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true});
  else scan();
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scan(); });
  }).observe(document.documentElement, { childList:true, subtree:true });
}

function repairAccountColors() {
  if (!document.documentElement.matches('.stk-account-page,.stk-info-page')) return;
  let observer;
  const scan = () => {
    const main = document.getElementById('main') || document.querySelector('main');
    if (!main) return;
    // Account forms have several light title bars with no shared CSS class.
    for (const node of main.querySelectorAll('div,section,article,header,h1,h2,h3,h4,h5,h6,legend')) {
      if (node.classList.contains('stk-account-light-bar')) continue;
      const style = getComputedStyle(node);
      // A band that paints a picture is a picture, not a light surface to flatten:
      // the Slack band on the bots page is a white field carrying the Slack logo,
      // and repainting its field would have taken the logo with it.
      if (style.backgroundImage && style.backgroundImage !== 'none') continue;
      const value = style.backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const before = getComputedStyle(node, '::before').backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const bounds = node.getBoundingClientRect();
      const light = [value,before].some(match => match && match.slice(1).every(channel => Number(channel) >= 235));
      if (/^\/donate(?:\/|$)/.test(location.pathname) && node.querySelector('iframe,form')) continue;
      if (document.documentElement.classList.contains('stk-blog-page') && node.querySelector('img[src*=".gif"],img[src*=".GIF"]')?.parentElement === node) continue;
      if (light && bounds.width >= 250 && bounds.height <= 110) {
        node.classList.add('stk-account-light-bar');
      } else if (light && bounds.width >= 250) {
        if (document.documentElement.classList.contains('stk-info-page')) node.classList.add('stk-info-light-surface');
        else if (document.documentElement.classList.contains('stk-account-page')) node.classList.add('stk-account-light-surface');
      }
    }
    for (const node of main.querySelectorAll('label,button,span,a')) {
      if (/^Choose an image file(?:\s*…|\s*\.\.\.)?$/i.test(node.textContent.trim())) node.classList.add('stk-account-upload-button');
    }
    for (const node of main.querySelectorAll('span,small,b,abbr,h2,h3,h4,h5,h6')) {
      if (!node.closest('#deckbuilder,[class*="deckbuilder"]') || node.childElementCount) continue;
      const text = node.textContent.trim();
      if (/^(?:[A-Z][A-Z0-9]{1,5}(?:\s*[·•]\s*[0-9A-Z★-]+)?|LAND)$/.test(text) &&
        node.closest('.deckbuilder-entry,[class*="deckbuilder-entry"],[class*="deckbuilder-card"],[class*="card-entry"]') &&
        !node.closest('.card-symbol,.mana-symbol,.ms,[class*="mana-cost"],[class*="mana-symbol"]')) {
        node.classList.add('stk-deck-set-badge');
      }
      if (/^(?:COLUMN [AB]|CURVE|CMC\s*\d\+?|\d+\/\d+ CARDS)$/i.test(text)) node.classList.add('stk-deck-editor-label');
      if (/^\d\+?$/.test(text) && node.closest('[class*="curve"],[class*="cmc"]') &&
        !node.closest('.card-symbol,.mana-symbol,.ms,[class*="mana-cost"],[class*="mana-symbol"]')) {
        node.classList.add('stk-deck-editor-label');
      }
    }
    if (!observer) {
      observer = new MutationObserver(() => {
        if (observer.scheduled) return;
        observer.scheduled = true;
        requestAnimationFrame(() => { observer.scheduled = false; scan(); });
      });
      observer.observe(main, { childList: true, subtree: true });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once:true });
  else scan();
}

function initDeckActionsLayout() {
  let activeMenu;
  let pendingButton;
  const clear = () => {
    activeMenu?.parentElement?.classList.remove('stk-deck-menu-shell');
    activeMenu?.classList.remove('stk-deck-actions-menu');
    activeMenu?.style.removeProperty('--stk-deck-menu-top');
    activeMenu?.style.removeProperty('--stk-deck-menu-left');
    activeMenu = null;
  };
  // This is the deck listing's own scroll box, not the dropdown. Expanding it
  // only after a click left the whole deck list cropped even when the menu shut.
  const expandList = () => {
    const main = document.getElementById('main');
    if (!main) return;
    const entries = [...main.querySelectorAll('.deck-list-entry,.deck-list,[class*="deck-list"],[class*="decks-list"],.checklist,.checklist-wrapper,table')];
    for (const entry of entries) {
      let ancestor = entry;
      while (ancestor && ancestor !== document.body) {
        ancestor.classList.add('stk-deck-list-expanded');
        if (ancestor === main) break;
        ancestor = ancestor.parentElement;
      }
    }
    for (const control of main.querySelectorAll('button,a')) {
      if (/^More Actions\b/i.test(control.textContent.trim())) control.classList.add('stk-deck-more-button');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', expandList, {once:true});
  else expandList();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; expandList(); if (pendingButton?.isConnected) open(pendingButton); });
  }).observe(document.documentElement, {childList:true, subtree:true});
  const open = button => {
    clear();
    if (button.getAttribute('aria-expanded') === 'false') { pendingButton = null; return; }
    const entry = button.closest('.deck-list-entry, tr, li');
    expandList();
    // Scryfall puts the dropdown inside the scrolling deck row. Its contents
    // vary by ownership; find the visible panel containing the View Deck link.
    const view = [...(entry || document).querySelectorAll('a,button')].find(node => /^View Deck$/i.test(node.textContent.trim()) && (node.getClientRects?.().length ?? true)) ||
      [...document.querySelectorAll('[role="menu"] a,[class*="dropdown"] a,[class*="popover"] a')]
        .find(node => /^View Deck$/i.test(node.textContent.trim()) && (node.getClientRects?.().length ?? true));
    if (!view) return;
    // A class such as dropdown-menu-item can match a broad selector while
    // representing just one action. Walk to the whole panel, stopping before
    // the shared ancestor with the More Actions trigger.
    let menu = view.parentElement;
    while (menu?.parentElement && menu.parentElement !== entry && !menu.parentElement.contains(button)) menu = menu.parentElement;
    if (!menu || menu.contains(button)) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, Math.max(230, menu.scrollWidth, menu.getBoundingClientRect().width));
    const height = Math.min(menu.scrollHeight || 260, innerHeight - 24);
    const top = rect.bottom + height + 12 < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    menu.style.setProperty('--stk-deck-menu-top', `${top}px`);
    menu.style.setProperty('--stk-deck-menu-left', `${Math.max(8, Math.min(rect.right - width, innerWidth - width - 8))}px`);
    menu.classList.add('stk-deck-actions-menu');
    if (menu.parentElement?.matches('.dropdown,.dropdown-menu,[role="menu"],[class*="popover"]')) {
      menu.parentElement.classList.add('stk-deck-menu-shell');
    }
    activeMenu = menu;
    pendingButton = null;
  };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button,a');
    if (button && /^More Actions\b/i.test(button.textContent.trim()) && button.closest('#main')) {
      pendingButton = button;
      requestAnimationFrame(() => open(button));
      setTimeout(() => { if (!activeMenu) open(button); }, 80);
      setTimeout(() => { if (pendingButton === button) pendingButton = null; }, 1000);
    } else if (activeMenu && !activeMenu.contains(event.target)) { pendingButton = null; clear(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') clear(); });
  window.addEventListener('resize', clear);
}
