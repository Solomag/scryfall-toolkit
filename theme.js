chrome.storage.local.get({ darkTheme: false, hideCasterIndicator: false, siteLanguage: 'en' }).then(({ darkTheme, hideCasterIndicator, siteLanguage }) => {
  document.documentElement.classList.toggle("stk-dark", Boolean(darkTheme));
  document.documentElement.classList.toggle("stk-hide-caster", Boolean(hideCasterIndicator));
  document.documentElement.classList.toggle('stk-site-ru', siteLanguage === 'ru');
  if (siteLanguage === 'ru') translateSiteControls();
  if (darkTheme) { repairAccountColors(); repairDarkPurple(); repairSetSymbols(); }
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
  if (changes.hideCasterIndicator) document.documentElement.classList.toggle('stk-hide-caster', Boolean(changes.hideCasterIndicator.newValue));
  if (changes.siteLanguage) document.documentElement.classList.toggle('stk-site-ru', changes.siteLanguage.newValue === 'ru');
  if (changes.darkTheme) {
    document.documentElement.classList.toggle("stk-dark", Boolean(changes.darkTheme.newValue));
    if (changes.darkTheme.newValue) { repairAccountColors(); repairDarkPurple(); repairSetSymbols(); }
  }
});

function repairDarkPurple() {
  if (document.documentElement.dataset.stkPurpleRepair === 'true') return;
  document.documentElement.dataset.stkPurpleRepair = 'true';
  let scheduled = false;
  const pending = new Set();
  // Scryfall marks its links with one purple, but it hands that colour to plain
  // inline tags too (strong in the empty search, b in the jump bar), so the list
  // covers the text tags a link or a sentence can be built from.
  const selector = 'a,button,label,span,p,li,small,abbr,option,h1,h2,h3,h4,h5,h6,strong,b,em,i,u,s,sub,sup,code,pre,kbd,samp,var,cite,dfn,mark,legend,figcaption,summary,caption,dt,dd,th,td';
  const scan = (root = document.getElementById('main')) => {
    if (!document.documentElement.classList.contains('stk-dark')) return;
    const main = document.getElementById('main');
    if (!main || !root || root !== main && !main.contains(root) && !root.contains(main)) return;
    const candidates = root === main ? main.querySelectorAll(selector) :
      [root, ...root.querySelectorAll(selector)];
    for (const node of candidates) {
      if (!node.matches(selector) || !main.contains(node)) continue;
      if (node.classList.contains('stk-brighter-purple')) continue;
      if (getComputedStyle(node).color === 'rgb(99, 68, 150)') node.classList.add('stk-brighter-purple');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true});
  else scan();
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

// The set symbols in the advanced-search chips are inline SVGs. Most are black
// line art that disappears on the dark surface, but a few sets (TMT, TDM, ...)
// ship a light symbol that already reads well and should keep its own colour,
// so only the genuinely dark ones are lifted.
function repairSetSymbols() {
  if (document.documentElement.dataset.stkSymbolRepair === 'true') return;
  document.documentElement.dataset.stkSymbolRepair = 'true';
  let scheduled = false;
  const pending = new Set();
  const selector = '.select2-selection__choice svg, .select2-results__option svg';
  const luminance = fill => {
    const match = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match ? (0.2126 * +match[1] + 0.7152 * +match[2] + 0.0722 * +match[3]) / 255 : null;
  };
  const scan = (root = document) => {
    if (!document.documentElement.classList.contains('stk-dark')) return;
    const candidates = root.matches?.(selector) ? [root, ...root.querySelectorAll(selector)] :
      root.querySelectorAll?.(selector) || [];
    for (const svg of candidates) {
      if (svg.dataset.stkSymbolChecked) continue;
      svg.dataset.stkSymbolChecked = '1';
      const shapes = [...svg.querySelectorAll('path,use,circle,rect,polygon')];
      const levels = shapes.map(node => luminance(getComputedStyle(node).fill)).filter(level => level !== null);
      // A single light shape means the set brings its own bright symbol.
      if (!levels.length || levels.some(level => level > 0.4)) continue;
      svg.classList.add('stk-light-set-symbol');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true});
  else scan();
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
      const value = getComputedStyle(node).backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
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
