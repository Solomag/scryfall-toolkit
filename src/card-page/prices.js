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

// The EUR column: Cardmarket, CardTrader, and the advanced page filters.
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

  function initCardTrader() {
    const id = document.querySelector('meta[name="scryfall:card:id"]')?.content ||
      document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
    const links = document.querySelector('#stores .toolbox-links');
    if (!id || !links) return;
    const sources = ['cm','ct','both'].includes(settings.euroPriceSources) ? settings.euroPriceSources : 'cm';
    const showTable = sources !== 'cm';
    const table = document.querySelector('#main .prints > .prints-table');
    const eurIndex = [...(table?.querySelectorAll('thead th') || [])].findIndex(th => th.textContent.trim().toUpperCase() === 'EUR');
    if (table && eurIndex >= 0) {
      const heading = table.querySelectorAll('thead th')[eurIndex];
      const nativeEurCells = [...table.querySelectorAll('tbody tr')].map(row => row.children[eurIndex]);
      if (sources === 'both') {
        heading.classList.add('stk-cm-price-header');
        heading.replaceChildren(priceHeading('cardmarket'));
        heading.title = t('Цены Cardmarket в евро');
      }
      if (sources === 'ct') {
        heading.classList.add('stk-price-hidden');
        for (const cell of nativeEurCells) cell?.classList.add('stk-price-hidden');
      }
      if (showTable) {
        const th = document.createElement('th');
        th.className = 'stk-ct-price-header';
        th.title = t('CardTrader: минимальное предложение для этого издания в евро');
        th.append(priceHeading('cardtrader'));
        heading.after(th);
        const rows = [...table.querySelectorAll('tbody tr')];
        const queue = [];
        for (const row of rows) {
          const cell = document.createElement('td');
          cell.className = 'stk-ct-price-cell';
          if (sources === 'both') row.children[eurIndex]?.classList.add('stk-cm-price-cell');
          row.children[eurIndex]?.after(cell);
          const print = row.querySelector('a[data-card-id]');
          const path = print?.href && new URL(print.href, location.href).pathname.match(/^\/card\/([^/]+)\//);
          if (path) { ctQueuedCells.add(cell); queue.push({ cell, id: print.dataset.cardId, set: path[1] }); }
        }
        // Start with the current printing. Remaining rows arrive gradually to respect the marketplace rate limit.
        queue.sort((a,b) => Number(b.id === id) - Number(a.id === id));
        queue.splice(75);
        const showEurFallback = () => {
          heading.classList.remove('stk-price-hidden');
          for (const row of table.querySelectorAll('tbody tr')) row.children[eurIndex]?.classList.remove('stk-price-hidden');
        };
        const fetchPrint = async print => {
          try {
            const result = await request({ type: 'cardtrader', id: print.id, set: print.set });
            const price = result.nonfoil?.currency === 'EUR' ? result.nonfoil : result.foil?.currency === 'EUR' ? result.foil : null;
            // A CardTrader account in another currency answers with a real
            // price in that currency, and the EUR column cannot use it. For the
            // printing being viewed that is the same as having nothing to show,
            // so the native EUR column comes back rather than leaving an empty
            // one where a price was expected.
            if (print.id === id && sources === 'ct' && (!result.available || !price)) showEurFallback();
            if (price) {
              const a = document.createElement('a');
              a.href = result.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.title = t('Минимальное предложение CardTrader; состояние и язык могут отличаться');
              a.textContent = new Intl.NumberFormat('en-IE', { style:'currency', currency:'EUR' }).format(price.cents / 100);
              print.cell.append(a);
            }
          } catch {
            print.cell.title = t('Цена CardTrader недоступна');
            if (print.id === id) {
              if (sources === 'ct') showEurFallback();
              return true;
            }
          }
          return false;
        };
        // One throttled queue shared with the expansion: rows that appear after
        // "View all prints" join the same request stream.
        let pumping = false;
        const pump = async () => {
          if (pumping) return;
          pumping = true;
          try {
            while (queue.length) { if (await fetchPrint(queue.shift())) break; }
          } finally { pumping = false; }
        };
        shared.enqueueCardTraderPrint = (cell, cardId, set) => {
          if (ctQueuedCells.has(cell)) return;
          ctQueuedCells.add(cell);
          queue.push({ cell, id: cardId, set });
          pump();
        };
        pump();
      }
    }
    if (!settings.cardtraderPrices) return;
    request({ type: 'cardtrader', id, set: identity.set }).then(result => {
      if (!result.available) return;
      for (const [kind, price] of [['nonfoil',result.nonfoil],['foil',result.foil]]) {
        if (!price) continue;
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'button-n stk-cardtrader-link';
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const text = document.createElement('span');
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('assets/icons/cardtrader.svg');
        icon.alt = '';
        text.append(icon, document.createTextNode(` CardTrader${kind === 'foil' ? ' foil' : ''}`));
        const value = document.createElement('span');
        value.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.cents / 100);
        link.title = t('Минимальное предложение; состояние и язык могут отличаться');
        link.append(text, value);
        row.append(link);
        links.append(row);
      }
    }).catch(() => {
      const note = document.createElement('p');
      note.className = 'stk-cardtrader-error';
      note.textContent = t('CardTrader недоступен — проверь токен в настройках.');
      links.after(note);
    });
  }

  // Providers whose own published logo is used as it stands.
  //
  // Cardmarket puts its marks up for download, black for light backgrounds and
  // white for dark, and this had been choosing between the two by looking for a
  // class on <html>. Two things were wrong with that. The class is not
  // guaranteed to be there at the moment the heading is built, so the wrong one
  // could be used and the mark would sit on the dark page as a dark shape. And a
  // black mark beside CardTrader's reads as heavier than it, because it is not
  // the ink of anything around it.
  //
  // So there is one mark, and it takes the colour of the text beside it. The
  // mark is used as a CSS mask, which means what shows is the alpha of their
  // file while the colour is `currentColor` — right on either theme without
  // having to know which theme it is on, and never the wrong shade.
  function priceHeading(provider) {
    const wrapper = document.createElement('span');
    wrapper.className = 'stk-price-heading';
    const logo = brandLogo(provider);
    if (logo) {
      const mark = document.createElement('span');
      mark.className = 'stk-brand-mark';
      const url = chrome.runtime.getURL(logo.mask);
      mark.style.setProperty('-webkit-mask-image', 'url("' + url + '")');
      mark.style.setProperty('mask-image', 'url("' + url + '")');
      mark.setAttribute('role', 'img');
      mark.setAttribute('aria-label', logo.title);
      mark.title = logo.title;
      wrapper.append(mark);
    } else {
      const icon = document.createElement('img');
      icon.src = chrome.runtime.getURL(`assets/icons/${provider}.svg`);
      icon.alt = '';
      wrapper.append(icon);
    }
    wrapper.append(document.createTextNode('EUR'));
    return wrapper;
  }

  function brandLogo(provider) {
    if (provider === 'cardmarket') {
      return { mask: 'assets/icons/cardmarket-white.png', title: 'Cardmarket' };
    }
    return null;
  }

  function initPriceFilter() {
    // Four switches, not one. `onlyCardmarket` was a single switch that turned the
    // dollars, the tickets and both shops off together, which meant a reader who wanted
    // no TCGplayer links but kept the dollar column had no way to say so.
    //
    // The currencies and the shops are separate kinds because they are separate things on
    // the page: a column of numbers, and a row of links. The card's own Cardmarket price
    // is not a switch at all and is never hidden - it is the one price this extension has
    // a reason to add.
    const currency = new Map([['USD', 'usd'], ['TIX', 'tix']]);
    const shops = { tcgplayer: 'tcgplayer', cardhoarder: 'cardhoarder' };
    const hideCurrency = kind => Boolean(kind && setFilters.prices[kind]);
    const hiddenShops = Object.keys(shops).filter(shop => setFilters.prices[shop]);

    for (const table of document.querySelectorAll('#main .prints-table')) {
      const headers = [...table.querySelectorAll('thead th')];
      for (const [index, header] of headers.entries()) {
        const kind = currency.get(header.textContent.trim().toUpperCase());
        if (!hideCurrency(kind)) continue;
        header.classList.add('stk-price-hidden');
        for (const row of table.querySelectorAll('tbody tr')) row.children[index]?.classList.add('stk-price-hidden');
      }
    }
    const stores = document.querySelector('#stores');
    if (hiddenShops.length) {
      for (const link of stores?.querySelectorAll('a[href]') || []) {
        let host;
        try { host = new URL(link.href).hostname; } catch { continue; }
        // Matched against the shop that was asked for, not against a fixed pair, so a
        // fourth shop added to the settings does not need this line changed as well.
        if (!hiddenShops.some(shop => new RegExp(`(^|\\.)${shop}\\.com$`).test(host))) continue;
        link.classList.add('stk-price-hidden');
      }
    }
    for (const row of stores?.querySelectorAll('.toolbox-links li') || []) {
      const links = [...row.querySelectorAll('a[href]')];
      if (links.length && links.every(link => link.classList.contains('stk-price-hidden'))) row.classList.add('stk-price-hidden');
    }
    stores?.querySelector('.toolbox-disclaimer')?.classList.add('stk-price-hidden');
    if (/^\/(?:@[^/]+\/decks\/|decks\/)/.test(location.pathname)) {
      for (const control of document.querySelectorAll('#main .sidebar-toolbox :is(a,button)')) {
        const shop = hiddenShops.find(name => new RegExp(`^Buy on ${name}\\b`, 'i').test(control.textContent.trim()));
        if (shop) control.classList.add('stk-price-hidden');
      }
    }
  }

  function initAdvancedPriceFilter() {
    const prices = setFilters.prices;
    if (!prices.usd && !prices.tix) return;
    // The Prices filter on /advanced offers USD, Euros and MTGO Tickets per row. With a
    // currency hidden its option is dropped, because a filter that searches a currency
    // you have said you do not want to see is the opposite of hiding it. Euros is
    // renamed rather than dropped: it is the Cardmarket price, and the euro option is how
    // a Cardmarket result is filtered on.
    const isCurrency = select => select.name && select.name.startsWith('price_') && !select.name.endsWith('_mode');
    const relabel = select => {
      if (select.dataset.stkPriceFiltered) return;
      select.dataset.stkPriceFiltered = '1';
      for (const option of [...select.querySelectorAll('option')]) {
        if (prices[option.value]) option.remove();
        else if (option.value === 'eur') option.textContent = 'Cardmarket (€)';
      }
    };
    for (const select of document.querySelectorAll('select[name^="price_"]')) {
      if (isCurrency(select)) relabel(select);
    }
    // Adding another price row duplicates the template, which is caught here.
    new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        for (const select of (node.matches?.('select[name^="price_"]') ? [node] : node.querySelectorAll?.('select[name^="price_"]') || [])) {
          if (isCurrency(select)) relabel(select);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }


  self.STK_CONTENT.on("cardTrader", () => initCardTrader());
  self.STK_CONTENT.on("priceFilter", () => initPriceFilter());
  self.STK_CONTENT.on("advancedPriceFilter", () => initAdvancedPriceFilter());
})();
