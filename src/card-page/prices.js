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
    if (!id) return;
    // The two CardTrader features are two switches: the added column in the prints table, and the
    // links in the buy block. Either alone is a reason to be here, and neither is a reason for the
    // other to run. The buy block is looked up further down, because a card page without one still
    // has a table to put a column in — and it used to gate the column, which is how a page whose
    // store markup had moved lost the column as well.
    const showColumn = setFilters.prices.cardtrader !== false;
    const showCardmarket = setFilters.prices.eur !== false;
    // Which currency the CardTrader column asks for. Empty means "as the account", which is what
    // CardTrader's own API answers in; a code is a preference the worker honours when an offer in
    // it exists, because the endpoint has no currency parameter of its own.
    const wantedCurrency = /^[A-Z]{3}$/.test(settings.cardtraderCurrency || '') ? settings.cardtraderCurrency : '';
    const table = document.querySelector('#main .prints > .prints-table');
    const eurIndex = [...(table?.querySelectorAll('thead th') || [])].findIndex(th => th.textContent.trim().toUpperCase() === 'EUR');
    if (table && eurIndex >= 0 && (showColumn || !showCardmarket)) {
      const heading = table.querySelectorAll('thead th')[eurIndex];
      const nativeEurCells = [...table.querySelectorAll('tbody tr')].map(row => row.children[eurIndex]);
      // The euro column is Cardmarket's, and its own box is what hides it: the CardTrader column
      // no longer stands in for it, so there is nothing here to keep in step. When both columns are
      // shown the euro one is relabelled as Cardmarket's, because "EUR" beside a CardTrader column
      // would read as the heading of the wrong one.
      if (!showCardmarket) {
        heading.classList.add('stk-price-hidden');
        for (const cell of nativeEurCells) cell?.classList.add('stk-price-hidden');
      } else if (showColumn) {
        heading.classList.add('stk-cm-price-header');
        heading.replaceChildren(priceHeading('cardmarket', 'EUR'));
        heading.title = 'Cardmarket prices in EUR';
      }
      if (showColumn) {
        const th = document.createElement('th');
        th.className = 'stk-ct-price-header';
        th.title = 'CardTrader: lowest offer for this printing';
        th.append(priceHeading('cardtrader', wantedCurrency));
        heading.after(th);
        // The heading's currency code, filled in when the first offer is answered if the setting
        // says "as the account" and the wanted code is therefore empty.
        const ctCode = () => th.querySelector('.stk-price-code');
        const rows = [...table.querySelectorAll('tbody tr')];
        const queue = [];
        for (const row of rows) {
          const cell = document.createElement('td');
          cell.className = 'stk-ct-price-cell';
          if (showCardmarket) row.children[eurIndex]?.classList.add('stk-cm-price-cell');
          row.children[eurIndex]?.after(cell);
          const print = row.querySelector('a[data-card-id]');
          const path = print?.href && new URL(print.href, location.href).pathname.match(/^\/card\/([^/]+)\//);
          if (path) { ctQueuedCells.add(cell); queue.push({ cell, id: print.dataset.cardId, set: path[1] }); }
        }
        // Start with the current printing. Remaining rows arrive gradually to respect the marketplace rate limit.
        queue.sort((a,b) => Number(b.id === id) - Number(a.id === id));
        queue.splice(75);
        const fetchPrint = async print => {
          try {
            const result = await request({ type: 'cardtrader', id: print.id, set: print.set });
            // The cheapest offer, in whichever currency it came back in — nonfoil preferred, the
            // foil one when that is all there is. It used to insist on EUR, which is an account's
            // own currency rather than a fact about CardTrader, so an account in any other
            // currency showed nothing at all.
            const price = result.nonfoil || result.foil || null;
            if (price) {
              // The heading carries the currency, which is only known once the first offer
              // arrives when the setting says "as the account".
              const code = ctCode();
              if (code && !code.textContent) code.textContent = price.currency;
              const a = document.createElement('a');
              a.href = result.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.title = 'Lowest CardTrader offer; condition and language may vary';
              a.textContent = new Intl.NumberFormat(undefined, { style:'currency', currency: price.currency }).format(price.cents / 100);
              print.cell.append(a);
            }
          } catch {
            print.cell.title = 'CardTrader price unavailable';
            // The current printing failing is the marketplace being unreachable, not this card
            // having no offer, and every row asks the same endpoint: stopping keeps a broken
            // service from costing one request per printing.
            if (print.id === id) return true;
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
    // The links go in the "Buy This Card" block, and nowhere else: without the block there is
    // nowhere for them to be shown, which is the whole of why the lookup is here rather than above.
    const links = document.querySelector('#stores .toolbox-links');
    if (!links || !settings.cardtraderPrices) return;
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
        link.title = 'Lowest offer; condition and language may vary';
        link.append(text, value);
        row.append(link);
        links.append(row);
      }
    }).catch(() => {
      const note = document.createElement('p');
      note.className = 'stk-cardtrader-error';
      note.textContent = 'CardTrader unavailable — check the token in settings.';
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
  function priceHeading(provider, code) {
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
    // The currency code, written into its own span so CardTrader's heading can be filled in once
    // the first offer arrives — the account's currency is not known before a request is answered.
    const label = document.createElement('span');
    label.className = 'stk-price-code';
    label.textContent = code || '';
    wrapper.append(label);
    return wrapper;
  }

  function brandLogo(provider) {
    if (provider === 'cardmarket') {
      return { mask: 'assets/icons/cardmarket-white.png', title: 'Cardmarket' };
    }
    return null;
  }

  function initPriceFilter() {
    // Separate switches, not one. `onlyCardmarket` was a single switch that turned the
    // dollars, the tickets and every shop off together, which meant a reader who wanted no
    // TCGplayer links but kept the dollar column had no way to say so.
    //
    // The currencies and the shops are separate kinds because they are separate things on the
    // page: a column of numbers, and a row of links.
    //
    // Cardmarket is a shop here and nothing more, and EUR is a currency. The two are the same
    // shop's price from two sides — the euro column is Cardmarket's — and they are two switches
    // because they are two things: one hides a link, the other hides a column. The EUR box is the
    // only switch for that column, and the CardTrader column beside it is its own price: neither
    // reads the other.
    //
    // `shops` maps a hostname to the model's key for it, and the filter reads the *value*. It
    // read the key for a long time, which meant `prices.tcgplayer` was asked for and the model
    // stores `tcg` — so the TCGplayer links were never hidden, and Cardhoarder's worked only
    // because its hostname and its key happen to be the same word. Nothing caught it because
    // nothing tested the links at all.
    //
    // The keys are positive: a price is shown unless the reader says otherwise, like every
    // other switch in the settings. They were the negative booleans the model had left,
    // and the lines below are where the sense is turned round — once, rather than at each
    // of the places that asks.
    const currency = new Map([['USD', 'usd'], ['TIX', 'tix'], ['EUR', 'eur']]);
    const shops = { tcgplayer: 'tcg', cardhoarder: 'cardhoarder', cardmarket: 'cardmarket' };
    const hideCurrency = kind => Boolean(kind) && setFilters.prices[kind] === false;
    const hiddenShops = Object.keys(shops).filter(shop => setFilters.prices[shops[shop]] === false);

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
    // The whole block, before any of the per-shop work: a reader who buys nowhere wants the
    // heading and the disclaimer gone as well, and hiding each shop leaves both behind. It also
    // stops the per-shop loop below from mattering, which is the point — this is the general
    // switch and the shops are the particular ones.
    if (setFilters.showStores === false) stores?.classList.add('stk-price-hidden');
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
    // The euro option follows the EUR box alone. It used to follow the source dropdown too, when
    // that dropdown was what removed the column; the box is the only thing that removes it now.
    const noEuro = prices.eur === false;
    if (prices.usd !== false && prices.tix !== false && !noEuro) return;
    // The Prices filter on /advanced offers USD, Euros and MTGO Tickets per row. With a
    // currency hidden its option is dropped, because a filter that searches a currency
    // you have said you do not want to see is the opposite of hiding it. The euro one is
    // dropped for the same reason when the reader has said they want no euro column.
    const isCurrency = select => select.name && select.name.startsWith('price_') && !select.name.endsWith('_mode');
    const relabel = select => {
      if (select.dataset.stkPriceFiltered) return;
      select.dataset.stkPriceFiltered = '1';
      for (const option of [...select.querySelectorAll('option')]) {
        if (option.value === 'eur') {
          if (noEuro) option.remove();
          else option.textContent = 'Cardmarket (€)';
          continue;
        }
        if (prices[option.value] === false) option.remove();
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
