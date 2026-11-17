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

// Help with Scryfall's search box: suggestions for the query syntax, and searches the
// reader has saved.
//
// Suggestions are for the word under the caret. A bare word is matched against the
// keywords of Scryfall's syntax ("t", "otag", "set"…); a word with an operator in it
// ("otag:ram", "-s:mh", "f=pau") is matched against that keyword's values. Tag names
// come from the same snapshot the tag panels use, and sets from Scryfall's own index,
// both through the worker and asked for once, on the first keystroke.
//
// The list only opens for a word that matches something, and Scryfall's own form is
// left alone otherwise: Enter submits as it always did unless a suggestion has been
// chosen with the arrow keys.
//
// Saved searches are kept in storage (`savedSearchList`), shown when the box is
// focused and empty, and added with the star beside the result count on a search page.
(async () => {
  const { settings, request } = await self.STK_CONTENT.context;

  // Scryfall's keywords, with the short forms it accepts. Only the first name of each
  // group is offered; the others are recognised when typed.
  const KEYWORDS = [
    ['t', 'type'], ['o', 'oracle'], ['fo', 'fulloracle'], ['c', 'color'], ['id', 'identity'],
    ['m', 'mana'], ['mv', 'cmc'], ['pow', 'power'], ['tou', 'toughness'], ['loy', 'loyalty'],
    ['r', 'rarity'], ['s', 'set', 'e', 'edition'], ['b', 'block'], ['f', 'format'],
    ['legal'], ['banned'], ['restricted'], ['a', 'artist'], ['ft', 'flavor'],
    ['is'], ['not'], ['has'], ['otag', 'oracletag', 'function'], ['atag', 'arttag', 'art'],
    ['game'], ['year'], ['date'], ['usd'], ['eur'], ['tix'], ['lang', 'language'],
    ['frame'], ['border'], ['stamp'], ['wm', 'watermark'], ['kw', 'keyword'], ['produces'],
    ['devotion'], ['prints'], ['in'], ['order'], ['unique'], ['prefer'], ['direction']
  ];
  const FAMILY = new Map();
  for (const group of KEYWORDS) for (const name of group) FAMILY.set(name, group[0]);

  async function initSearchAssist() {

  const COLORS = ['w', 'u', 'b', 'r', 'g', 'c', 'm', 'colorless', 'multicolor', 'azorius', 'dimir', 'rakdos',
    'gruul', 'selesnya', 'orzhov', 'izzet', 'golgari', 'boros', 'simic', 'bant', 'esper', 'grixis', 'jund',
    'naya', 'abzan', 'jeskai', 'sultai', 'mardu', 'temur'];
  const FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'commander', 'oathbreaker',
    'brawl', 'standardbrawl', 'historic', 'timeless', 'alchemy', 'explorer', 'gladiator', 'penny',
    'paupercommander', 'duel', 'oldschool', 'premodern', 'predh', 'future'];
  const VALUES = {
    c: COLORS, id: COLORS,
    t: ['creature', 'artifact', 'enchantment', 'instant', 'sorcery', 'land', 'planeswalker', 'battle',
      'legendary', 'basic', 'snow', 'kindred', 'token', 'equipment', 'aura', 'vehicle', 'saga'],
    r: ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'],
    f: FORMATS, legal: FORMATS, banned: FORMATS, restricted: FORMATS,
    is: ['commander', 'spell', 'permanent', 'historic', 'party', 'modal', 'vanilla', 'frenchvanilla',
      'funny', 'foil', 'nonfoil', 'etched', 'hires', 'digital', 'promo', 'reprint', 'firstprint',
      'dfc', 'mdfc', 'transform', 'flip', 'split', 'meld', 'adventure', 'reserved', 'fullart',
      'fetchland', 'shockland', 'dual', 'fastland', 'checkland', 'painland', 'bounceland', 'manland'],
    not: [], has: ['watermark', 'indicator'],
    game: ['paper', 'arena', 'mtgo'],
    lang: ['en', 'ja', 'de', 'fr', 'it', 'es', 'pt', 'ru', 'ko', 'zhs', 'zht', 'ph', 'any'],
    frame: ['1993', '1997', '2003', '2015', 'future', 'legendary', 'colorshifted', 'showcase', 'extendedart', 'etched'],
    border: ['black', 'white', 'borderless', 'silver', 'gold'],
    stamp: ['oval', 'acorn', 'triangle', 'arena'],
    order: ['name', 'set', 'released', 'rarity', 'color', 'usd', 'eur', 'tix', 'cmc', 'power', 'toughness',
      'edhrec', 'penny', 'artist', 'review'],
    unique: ['cards', 'prints', 'art'],
    prefer: ['oldest', 'newest', 'usd-low', 'usd-high', 'eur-low', 'eur-high', 'promo', 'default', 'atypical', 'ub', 'notub'],
    direction: ['asc', 'desc']
  };
  VALUES.not = VALUES.is;
  const LIMIT = 12;
  const STORE_KEY = 'savedSearchList';
  const SAVED_MAX = 50;

  let vocabulary = null;
  let vocabularyRequest = null;
  const loadVocabulary = () => {
    if (!vocabularyRequest) {
      vocabularyRequest = request({ type: 'searchVocabulary' })
        .then(value => { vocabulary = value || {}; return vocabulary; })
        .catch(() => { vocabulary = {}; return vocabulary; });
    }
    return vocabularyRequest;
  };

  let saved = [];
  if (settings.savedSearches) {
    const stored = await chrome.storage.local.get(STORE_KEY);
    saved = Array.isArray(stored[STORE_KEY]) ? stored[STORE_KEY].filter(q => typeof q === 'string') : [];
    chrome.storage.onChanged.addListener(changes => {
      if (changes[STORE_KEY]) {
        saved = Array.isArray(changes[STORE_KEY].newValue) ? changes[STORE_KEY].newValue : [];
        refreshStar();
      }
    });
  }
  const persistSaved = () => chrome.storage.local.set({ [STORE_KEY]: saved.slice(0, SAVED_MAX) });

  // --- reading the word under the caret ----------------------------------------------

  // The word the caret is in, as far left as the last space outside quotes.
  function wordAt(value, caret) {
    let start = 0;
    let quoted = false;
    for (let i = 0; i < caret; i++) {
      if (value[i] === '"') quoted = !quoted;
      else if (!quoted && /\s|\(/.test(value[i])) start = i + 1;
    }
    let end = caret;
    while (end < value.length && !/\s|\)/.test(value[end])) end++;
    return { start, end, text: value.slice(start, caret) };
  }

  // What to offer for a word, as { label, hint, insert, more } — `more` keeps the list open
  // after the pick, for a keyword that wants its value next.
  function suggestionsFor(text) {
    const parts = text.match(/^(-?)([a-z]+)(:|=|!=|>=|<=|>|<)(.*)$/i);
    if (parts) {
      const [, minus, key, op, typed] = parts;
      const family = FAMILY.get(key.toLowerCase());
      if (!family) return [];
      const want = typed.replace(/^"/, '').toLowerCase();
      const head = minus + key + op;
      let pool;
      if (family === 'otag') pool = (vocabulary?.oracle || []).map(name => ({ value: name }));
      else if (family === 'atag') pool = (vocabulary?.art || []).map(name => ({ value: name }));
      else if (family === 's') {
        pool = (vocabulary?.sets || []).map(([code, name]) => ({ value: code, hint: name, also: name.toLowerCase() }));
      } else pool = (VALUES[family] || []).map(value => ({ value }));
      if (!pool.length) return [];
      const exact = [];
      const starts = [];
      const inside = [];
      for (const item of pool) {
        const value = item.value.toLowerCase();
        // The word itself first, when it is a real value: "otag:ramp" is a tag, and the
        // reader typing it should see that, above the longer tags that begin with it.
        if (value === want) exact.push(item);
        else if (!want || value.startsWith(want)) starts.push(item);
        else if (want.length > 1 && (value.includes(want) || (item.also && item.also.includes(want)))) inside.push(item);
        if (exact.length + starts.length >= LIMIT) break;
      }
      return [...exact, ...starts, ...inside].slice(0, LIMIT).map(item => ({
        label: head + item.value, hint: item.hint || '', insert: head + item.value + ' '
      }));
    }
    const want = text.replace(/^-/, '').toLowerCase();
    if (!/^[a-z]{1,}$/.test(want)) return [];
    const minus = text.startsWith('-') ? '-' : '';
    return KEYWORDS.map(group => group[0])
      .filter(name => name.startsWith(want) && name !== want)
      .concat(KEYWORDS.flatMap(group => group.slice(1)).filter(name => name.startsWith(want) && name.length > want.length && want.length >= 2))
      .filter((name, index, all) => all.indexOf(name) === index)
      .slice(0, LIMIT)
      .map(name => ({ label: minus + name + ':', hint: '', insert: minus + name + ':', more: true }));
  }

  // --- the list ----------------------------------------------------------------------

  const box = document.createElement('div');
  box.id = 'stk-suggest';
  box.setAttribute('role', 'listbox');
  box.hidden = true;
  document.body.append(box);
  let current = null;   // { input, items, active, mode, word }

  function close() {
    box.hidden = true;
    box.replaceChildren();
    current = null;
  }

  function place(input) {
    const r = input.getBoundingClientRect?.() || { left: 0, bottom: 0, width: 0 };
    box.style.left = Math.max(4, r.left) + 'px';
    box.style.top = (r.bottom + 4) + 'px';
    box.style.minWidth = Math.min(Math.max(r.width, 260), window.innerWidth - 8) + 'px';
  }

  function show(input, items, mode, word) {
    if (!items.length) return close();
    current = { input, items, active: -1, mode, word };
    box.replaceChildren();
    if (mode === 'saved') {
      const title = document.createElement('div');
      title.className = 'stk-suggest-title';
      title.textContent = 'Saved searches';
      box.append(title);
    }
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'stk-suggest-item';
      row.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.className = 'stk-suggest-label';
      label.textContent = item.label;
      row.append(label);
      if (item.hint) {
        const hint = document.createElement('span');
        hint.className = 'stk-suggest-hint';
        hint.textContent = item.hint;
        row.append(hint);
      }
      if (mode === 'saved') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'stk-suggest-remove';
        remove.textContent = '×';
        remove.title = 'Forget this search';
        remove.setAttribute('aria-label', 'Forget ' + item.label);
        remove.addEventListener('mousedown', event => {
          event.preventDefault();
          event.stopPropagation();
          saved = saved.filter(q => q !== item.label);
          persistSaved();
          showSaved(input);
        });
        row.append(remove);
      }
      // mousedown, not click: a click arrives after the input has lost focus and the list
      // has been closed by that.
      row.addEventListener('mousedown', event => { event.preventDefault(); pick(index); });
      box.append(row);
    });
    place(input);
    box.hidden = false;
  }

  function highlight(index) {
    if (!current) return;
    current.active = index;
    [...box.querySelectorAll('.stk-suggest-item')].forEach((row, i) => {
      row.classList.toggle('stk-active', i === index);
      if (i === index) row.scrollIntoView?.({ block: 'nearest' });
    });
  }

  function pick(index) {
    if (!current) return;
    const { input, items, mode, word } = current;
    const item = items[index];
    if (!item) return;
    if (mode === 'saved') {
      input.value = item.label;
      close();
      if (input.form?.requestSubmit) input.form.requestSubmit();
      else if (input.form) input.form.submit();
      return;
    }
    const value = input.value;
    input.value = value.slice(0, word.start) + item.insert + value.slice(word.end).replace(/^\s+/, '');
    const caret = word.start + item.insert.length;
    input.setSelectionRange?.(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (!item.more) close();
    else update(input);
  }

  function showSaved(input) {
    if (!settings.savedSearches || !saved.length) return close();
    show(input, saved.slice(0, LIMIT).map(q => ({ label: q, hint: '' })), 'saved', null);
  }

  async function update(input) {
    if (input.value.trim() === '') return showSaved(input);
    if (!settings.searchAutocomplete) return close();
    const caret = input.selectionStart ?? input.value.length;
    const word = wordAt(input.value, caret);
    if (!word.text) return close();
    if (/^-?[a-z]+(:|=|!=|>=|<=|>|<)/i.test(word.text) && !vocabulary) await loadVocabulary();
    // The reader may have left the box while the vocabulary was on its way.
    if (focused !== input) return;
    show(input, suggestionsFor(word.text), 'syntax', word);
  }

  const wired = new WeakSet();
  let focused = null;
  function wire(input) {
    if (wired.has(input)) return;
    wired.add(input);
    input.addEventListener('input', () => { focused = input; update(input); });
    input.addEventListener('focus', () => { focused = input; if (input.value.trim() === '') showSaved(input); });
    input.addEventListener('blur', () => {
      if (focused === input) focused = null;
      setTimeout(() => { if (current?.input === input) close(); }, 120);
    });
    input.addEventListener('keydown', event => {
      if (!current || current.input !== input || box.hidden) return;
      const count = current.items.length;
      if (event.key === 'ArrowDown') { event.preventDefault(); highlight((current.active + 1) % count); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); highlight((current.active - 1 + count) % count); }
      else if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if ((event.key === 'Enter' || event.key === 'Tab') && current.active >= 0) {
        event.preventDefault();
        event.stopPropagation();
        pick(current.active);
      } else if (event.key === 'Tab' && current.mode === 'syntax' && count === 1) {
        event.preventDefault();
        pick(0);
      }
    }, true);
  }
  const scanInputs = () => document.querySelectorAll('input[name="q"]').forEach(wire);
  scanInputs();
  new MutationObserver(() => scanInputs()).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', () => { if (current) place(current.input); });
  window.addEventListener('scroll', () => { if (current) place(current.input); }, true);

  // --- saving the search on screen -----------------------------------------------------

  let star = null;
  function currentQuery() {
    if (location.pathname !== '/search') return '';
    return (new URLSearchParams(location.search).get('q') || '').trim();
  }
  function refreshStar() {
    if (!star) return;
    const on = saved.includes(currentQuery());
    star.textContent = on ? '★' : '☆';
    star.classList.toggle('stk-selected', on);
    star.title = on ? 'Forget this search' : 'Save this search';
    star.setAttribute('aria-label', star.title);
  }
  if (settings.savedSearches && currentQuery()) {
    const info = document.querySelector('.search-info');
    if (info) {
      star = document.createElement('button');
      star.type = 'button';
      star.className = 'stk-save-search';
      star.addEventListener('click', () => {
        const query = currentQuery();
        if (saved.includes(query)) saved = saved.filter(q => q !== query);
        else saved = [query, ...saved].slice(0, SAVED_MAX);
        persistSaved();
        refreshStar();
      });
      // Inside the line that counts the results, ahead of the count, so it reads as part of it.
      (info.querySelector('p') || info).prepend(star);
      refreshStar();
    }
  }

  }


  // --- the default filter -------------------------------------------------------------
  //
  // Clauses the reader wants on every search ("game:paper", "lang:en"), added when a
  // search form is sent. A clause is left out when the query already says something
  // with the same keyword, so "game:arena" typed by hand is not overruled. It is added
  // to the query itself, so the box on the results page shows it; a note beside the
  // result count says it was added and links to the same search without it.
  function splitClauses(text) {
    return String(text || '').match(/-?[a-z]+(?::|=|!=|>=|<=|>|<)"[^"]*"|"[^"]*"|\S+/gi) || [];
  }
  function keyOf(clause) {
    const match = clause.match(/^-?([a-z]+)(?::|=|!=|>=|<=|>|<)/i);
    return match ? FAMILY.get(match[1].toLowerCase()) || match[1].toLowerCase() : null;
  }
  // Keywords a card can match more than once: "is:commander" says nothing about
  // "-is:digital", so for these only the very same clause counts as already there.
  const MANY_VALUED = new Set(['is', 'not', 'has', 't', 'o', 'fo', 'kw', 'otag', 'atag', 'produces', 'in', 'a', 'ft', 'wm']);
  // The clauses of the filter the query does not already settle, and the query with them.
  function filterClauses(query, filter) {
    const tokens = splitClauses(query);
    const keys = new Set(tokens.map(keyOf).filter(Boolean));
    const lower = tokens.map(token => token.toLowerCase());
    return splitClauses(filter).filter(clause => {
      const key = keyOf(clause);
      if (lower.includes(clause.toLowerCase())) return false;
      return !key || MANY_VALUED.has(key) || !keys.has(key);
    });
  }
  function withFilter(query, filter) {
    if (!splitClauses(query).length) return query;
    const missing = filterClauses(query, filter);
    if (!missing.length) return query;
    // "a or b game:paper" is "a or (b and game:paper)" to Scryfall.
    const base = /(^|\s)or(\s|$)/i.test(query) ? `(${query.trim()})` : query.trim();
    return base + ' ' + missing.join(' ');
  }
  // The query without the clauses the extension added: taken off the end, where they were
  // put, so a clause the reader typed themselves stays.
  function withoutFilter(query, added) {
    const tokens = splitClauses(query);
    for (const clause of [...added].reverse()) {
      if (tokens.length && tokens[tokens.length - 1].toLowerCase() === clause.toLowerCase()) tokens.pop();
    }
    let rest = tokens.join(' ');
    if (/^\(.*\)$/.test(rest) && /(^|\s)or(\s|$)/i.test(rest)) rest = rest.slice(1, -1);
    return rest;
  }
  // Which clauses were added to which query, for the note on the results page. Kept for the
  // tab, so the note appears only on the search the extension actually changed.
  const FILTER_NOTE_KEY = 'stk-filter-added';
  const sameQuery = (a, b) => String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim();

  function initDefaultFilter() {
    const filter = String(settings.defaultSearchFilter || '').trim().slice(0, 200);
    if (!filter) return;
    document.addEventListener('submit', event => {
      const form = event.target;
      const input = form?.querySelector?.('input[name="q"]');
      if (!input || !input.value.trim()) return;
      let target;
      try { target = new URL(form.getAttribute('action') || location.href, location.href); } catch { return; }
      if (!/(^|\.)scryfall\.com$/.test(target.hostname) || target.pathname !== '/search') return;
      const added = filterClauses(input.value, filter);
      input.value = withFilter(input.value, filter);
      try {
        if (added.length) sessionStorage.setItem(FILTER_NOTE_KEY, JSON.stringify({ q: input.value, added }));
        else sessionStorage.removeItem(FILTER_NOTE_KEY);
      } catch { /* No storage: the search still runs, only without the note. */ }
    }, true);

    if (location.pathname !== '/search') return;
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    let used = [];
    try {
      const note = JSON.parse(sessionStorage.getItem(FILTER_NOTE_KEY) || 'null');
      if (note && sameQuery(note.q, query) && Array.isArray(note.added)) used = note.added.map(String);
    } catch { used = []; }
    const info = document.querySelector('.search-info');
    if (!used.length || !info) return;
    params.set('q', withoutFilter(query, used));
    const note = document.createElement('span');
    note.className = 'stk-filter-note';
    note.textContent = 'Default filter: ' + used.join(' ') + ' ';
    note.title = 'Added by Scryfall Toolkit; change it in the extension settings';
    const off = document.createElement('a');
    off.href = '/search?' + params;
    off.textContent = 'search without it';
    note.append(off);
    (info.querySelector('p') || info).append(note);
  }

  // --- the query builder --------------------------------------------------------------
  //
  // A small form for the clauses people look up most — name, type, rules text, colours,
  // mana value, format, rarity, set — that writes Scryfall's syntax for them. It adds to
  // what is already in the search box rather than replacing it, and it shows the query it
  // will run before running it, so it doubles as a way to learn the syntax. Scryfall's own
  // Advanced Search covers everything; this covers the common part without leaving the page.
  const quoteIfNeeded = text => /[\s"()]/.test(text) ? '"' + text.replace(/"/g, '') + '"' : text;
  function builtQuery(fields) {
    const parts = [];
    const name = String(fields.name || '').trim();
    if (name) parts.push(quoteIfNeeded(name));
    for (const word of String(fields.type || '').trim().split(/\s+/).filter(Boolean)) parts.push('t:' + quoteIfNeeded(word));
    const text = String(fields.oracle || '').trim();
    if (text) parts.push('o:' + quoteIfNeeded(text));
    const colors = (fields.colors || []).filter(c => /^[wubrgc]$/.test(c)).join('');
    if (colors) {
      const op = { exact: '=', including: '>=', most: '<=' }[fields.colorMode] || '>=';
      parts.push((fields.colorField === 'id' ? 'id' : 'c') + op + colors);
    }
    if (/^\d{1,2}$/.test(String(fields.mv || ''))) {
      parts.push('mv' + (['=', '>=', '<='].includes(fields.mvOp) ? fields.mvOp : '=') + fields.mv);
    }
    if (/^[a-z]+$/.test(fields.format || '')) parts.push('f:' + fields.format);
    if (/^[a-z]+$/.test(fields.rarity || '')) parts.push('r:' + fields.rarity);
    const set = String(fields.set || '').trim().toLowerCase();
    if (/^[a-z0-9]{2,6}$/.test(set)) parts.push('s:' + set);
    return parts.join(' ');
  }

  function initQueryBuilder() {
    const anchor = location.pathname === '/'
      ? document.querySelector('form.homepage-form, form[action="/search"]')
      : (location.pathname === '/search' ? document.querySelector('.search-info') : null);
    if (!anchor || document.getElementById('stk-builder')) return;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'stk-builder-open';
    open.textContent = 'Query builder';
    open.title = 'Build a search from a form';

    const dialog = document.createElement('dialog');
    dialog.id = 'stk-builder';
    const field = (label, control) => {
      const row = document.createElement('label');
      row.className = 'stk-builder-row';
      const caption = document.createElement('span');
      caption.textContent = label;
      row.append(caption, control);
      return row;
    };
    const input = (name, placeholder) => {
      const element = document.createElement('input');
      element.type = 'text';
      element.name = name;
      element.placeholder = placeholder;
      element.autocomplete = 'off';
      element.spellcheck = false;
      return element;
    };
    const select = (name, options) => {
      const element = document.createElement('select');
      element.name = name;
      for (const [value, label] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        element.append(option);
      }
      return element;
    };
    const title = document.createElement('h2');
    title.textContent = 'Query builder';
    const colors = document.createElement('span');
    colors.className = 'stk-builder-colors';
    for (const value of ['w', 'u', 'b', 'r', 'g', 'c']) {
      const box = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.name = 'colors';
      check.value = value;
      box.append(check, document.createTextNode(value.toUpperCase()));
      colors.append(box);
    }
    const colorRow = document.createElement('span');
    colorRow.className = 'stk-builder-inline';
    colorRow.append(select('colorField', [['c', 'Colour'], ['id', 'Identity']]), colors,
      select('colorMode', [['including', 'including'], ['exact', 'exactly'], ['most', 'at most']]));
    const mvRow = document.createElement('span');
    mvRow.className = 'stk-builder-inline';
    const mv = input('mv', '');
    mv.inputMode = 'numeric';
    mv.size = 3;
    mvRow.append(select('mvOp', [['=', '='], ['>=', '≥'], ['<=', '≤']]), mv);
    const formats = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'commander', 'premodern'];
    const preview = document.createElement('code');
    preview.className = 'stk-builder-preview';
    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'button-n stk-builder-run';
    run.textContent = 'Search';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button-n';
    cancel.textContent = 'Close';
    const actions = document.createElement('div');
    actions.className = 'stk-builder-actions';
    actions.append(run, cancel);
    dialog.append(title,
      field('Name', input('name', 'goblin')),
      field('Type', input('type', 'legendary creature')),
      field('Rules text', input('oracle', 'draw a card')),
      field('Colours', colorRow),
      field('Mana value', mvRow),
      field('Format', select('format', [['', 'any'], ...formats.map(key => [key, key[0].toUpperCase() + key.slice(1)])])),
      field('Rarity', select('rarity', [['', 'any'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['mythic', 'Mythic']])),
      field('Set code', input('set', 'mh3')),
      preview, actions);
    document.body.append(dialog);

    const current = () => (location.pathname === '/search'
      ? new URLSearchParams(location.search).get('q') || '' : '').trim();
    const read = () => {
      const value = name => dialog.querySelector(`[name="${name}"]`)?.value || '';
      return {
        name: value('name'), type: value('type'), oracle: value('oracle'),
        colors: [...dialog.querySelectorAll('input[name="colors"]')].filter(box => box.checked).map(box => box.value),
        colorField: value('colorField'), colorMode: value('colorMode'),
        mv: value('mv').trim(), mvOp: value('mvOp'), format: value('format'), rarity: value('rarity'), set: value('set')
      };
    };
    const full = () => [current(), builtQuery(read())].filter(Boolean).join(' ');
    const paint = () => {
      preview.textContent = full() || '—';
      run.disabled = !builtQuery(read());
    };
    dialog.addEventListener('input', paint);
    dialog.addEventListener('change', paint);
    run.addEventListener('click', () => {
      if (!builtQuery(read())) return;
      const query = full();
      dialog.close();
      // The rest of the current search — its view, order, uniqueness — carries over.
      const params = new URLSearchParams(location.pathname === '/search' ? location.search : '');
      params.set('q', query);
      params.delete('page');
      location.assign('/search?' + params);
    });
    cancel.addEventListener('click', () => dialog.close());
    open.addEventListener('click', () => { paint(); dialog.showModal(); });
    if (anchor.matches('.search-info')) (anchor.querySelector('p') || anchor).append(open);
    else anchor.after(open);
  }

  self.STK_CONTENT.on("queryBuilder", () => initQueryBuilder());
  self.STK_CONTENT.on("defaultSearchFilter", () => initDefaultFilter());
  self.STK_CONTENT.on("searchAssist", () => initSearchAssist());
})();
