(async () => {
  const defaults = {
    siteLanguage: 'en',
    clipboard: true, tags: true, cardTags: true, artTags: true, relationships: true,
    onlyCardmarket: false, printAddButtons: true, hideDigitalSets: false, hideNonTournamentSets: false, hideOversizedSets: false,
    hideForeignBlackBorder: false, hideNonEnglishPrints: false, legalities: true, finishBadges: true, cardtraderPrices: false, euroPriceSources: 'cm',
    edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: true, edhrecUsageDisplay: 'both',
    usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
    usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
    taggerSearchLinks: false, cardSearchLinks: false, cardNicknames: false, deckNoPrices: true, stackedDeckCards: false, deckTokens: false,
    premodern: true, heritage: false, classic: false, peak: false,
    formatOrder: null, formatVisibility: null,
    exportFormat: "names", cards: null
  };
  const settings = await chrome.storage.local.get(defaults);
  const language = settings.siteLanguage === 'ru' ? 'ru' : 'en';
  const t = text => window.STK_I18N.t(text, language);
  const cardPath = location.pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
  const cardPage = Boolean(cardPath && document.querySelector('.card-image') && document.querySelector('#main .prints-table'));
  const identity = cardPage ? { set: cardPath[1], number: decodeURIComponent(cardPath[2]) } : null;

  function request(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Request failed"));
        resolve(response.data);
      });
    });
  }

  if (settings.clipboard) await initClipboard();
  if ((settings.hideDigitalSets || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideNonEnglishPrints) && (/^\/sets\/?$/.test(location.pathname) || cardPage)) initSetFilter();
  if (cardPage && settings.tags) initTags();
  if (cardPage) initLegalities();
  if (cardPage && settings.finishBadges) initPrintFinishes();
  if (cardPage && settings.clipboard && settings.printAddButtons) initNativePrintButtons();
  if (cardPage) initExpandedPrints();
  if (cardPage && (settings.edhrecUsage || settings.edhrecSalt)) initEdhrecStats();
  if (settings.onlyCardmarket) initPriceFilter();
  if (cardPage && (settings.cardtraderPrices || settings.euroPriceSources !== 'cm')) initCardTrader();
  if (cardPage && settings.cardSearchLinks) initCardSearchLinks();
  if (cardPage && settings.cardNicknames) initCardNicknames();
  if (settings.taggerSearchLinks) initSearchTaggerLinks();
  if (settings.deckNoPrices) initDeckPriceOption();
  if (settings.stackedDeckCards) initStackedDeckCards();
  if (settings.deckTokens) initDeckTokens();

  function initSetFilter() {
    // Scryfall lists these curated online cubes under /cubes/, outside its
    // /sets API. Restrict this exception to the twelve online-only cubes.
    const onlineCubes = new Set(['apcube','arena','chromatic','livethedream','tinkerer','grixis','protour','vintage','uncommon','modern','legacy','twisted']);
    const needsSetIndex = settings.hideDigitalSets || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder;
    (needsSetIndex ? request({type:'setCategories'}) : Promise.resolve({digital:[]}))
      .catch(() => ({digital:[],foreignBlackBorder:['4bb','fbb','bchr']}))
      .then(categories => {
      if (!categories || !Array.isArray(categories.digital)) return;
      const hidden = new Set([
        ...(settings.hideDigitalSets ? categories.digital : []),
        ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
        ...(settings.hideOversizedSets ? categories.oversized || [] : []),
        ...(settings.hideForeignBlackBorder ? categories.foreignBlackBorder || ['4bb','fbb','bchr'] : [])
      ].map(code => code.toLowerCase()));
      const main = document.querySelector('#main');
      if (!main) return;
      const apply = () => {
        const rows = [...main.querySelectorAll('#js-checklist tbody tr')];
        for (const row of rows) {
          const link = row.querySelector('td:first-child a[href]');
          let path;
          try { path = new URL(link?.href || '',location.href).pathname; }
          catch { /* Ignore malformed unrelated links. */ }
          const set = path?.match(/^\/sets\/([^/]+)\/?$/)?.[1];
          const cube = path?.match(/^\/cubes\/([^/]+)\/?$/)?.[1];
          row.classList.toggle('stk-digital-set-hidden', Boolean(set && hidden.has(set.toLowerCase()) || settings.hideDigitalSets && cube && onlineCubes.has(cube.toLowerCase())));
        }
        // Printings are identified by the set in the card URL. Keep the
        // selected printing visible so its own detail page remains coherent.
        for (const row of main.querySelectorAll('.prints-table tbody tr')) {
          const link = row.querySelector('td:first-child a[href]');
          const path = link?.getAttribute('href') || '';
          const set = path.match(/^\/card\/([^/]+)\//)?.[1];
          // English links end after the card slug. A language-specific link
          // has an extra /lang/ segment before that slug (e.g. /ptk/1/ja/name).
          const foreignPrinting = /^\/card\/[^/]+\/[^/]+\/(?:[a-z]{2,3})\/[^/]+/i.test(path);
          row.classList.toggle('stk-digital-set-hidden', Boolean(!row.classList.contains('current') &&
            (set && hidden.has(set.toLowerCase()) || settings.hideNonEnglishPrints && foreignPrinting)));
        }
        const counter = main.querySelector('.search-controls label[for="order"]');
        if (counter && rows.length) {
          const visible = rows.filter(row => !row.classList.contains('stk-digital-set-hidden')).length;
          counter.textContent = language === 'ru' ? `${visible} из ${rows.length} сетов в` : `${visible} of ${rows.length} sets in`;
        }
      };
      apply();
      const table = main.querySelector('#js-checklist') || main.querySelector('.prints-table');
      if (table) new MutationObserver(apply).observe(table, {childList:true,subtree:true});
    });
  }

  function initDeckTokens() {
    if (!/^\/@[^/]+\/decks\//.test(location.pathname)) return;
    const anchors = [...document.querySelectorAll('.deck-list-entry .deck-list-entry-name a, a.card-grid-item-card[href]')];
    const entries = [...new Map(anchors.map(a => {
      const path = new URL(a.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      return path && [path[1] + '/' + path[2], {set:path[1],collector_number:decodeURIComponent(path[2])}];
    }).filter(Boolean)).values()].slice(0,150);
    const place = document.querySelector('#main .sidebar') || document.querySelector('#main .deck-list')?.parentElement;
    if (!entries.length || !place) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button-n stk-token-button';
    button.textContent = language === 'ru' ? 'Показать токены' : 'Show Tokens';
    const dialog = document.createElement('dialog');
    dialog.id = 'stk-deck-tokens';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button-n';
    close.textContent = t('Закрыть');
    close.addEventListener('click', () => dialog.close());
    const title = document.createElement('h2');
    title.textContent = t('Токены колоды');
    const content = document.createElement('div');
    content.className = 'stk-token-grid';
    dialog.append(title, close, content);
    document.body.append(dialog);
    let pending;
    button.addEventListener('click', async () => {
      dialog.showModal();
      if (!pending) {
        content.textContent = t('Загружаю токены…');
        pending = request({type:'deckTokens',entries}).catch(error => { pending = null; throw error; });
      }
      try {
        const tokens = await pending;
        content.replaceChildren();
        if (!tokens.length) { content.textContent = t('Токены не найдены.'); return; }
        for (const token of tokens) {
          const link = document.createElement('a');
          link.href = token.uri;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = token.image;
          img.alt = token.name;
          img.loading = 'lazy';
          link.append(img);
          content.append(link);
        }
      } catch { content.textContent = t('Не удалось загрузить токены.'); }
    });
    place.prepend(button);
  }

  function initStackedDeckCards() {
    if (!document.querySelector('.deck-list')) return;
    const grid = document.querySelector('.card-grid');
    const cards = [...(grid?.querySelectorAll('.card-grid-item[data-card-id]') || [])];
    if (!cards.length) return;
    grid.classList.add('stk-stacked-deck');
    cards.at(-1).classList.add('stk-stacked-last');
  }

  function initCardNicknames() {
    const entry = window.STK_NICKNAMES?.find(item => item.setCode === identity.set && item.collectorNumber === identity.number);
    if (!entry) return;
    const parent = document.querySelector('#main .prints-info-section') || document.querySelector('#main .prints');
    if (!parent) return;
    const line = document.createElement('div');
    line.className = 'prints-info-section-note stk-card-nickname';
    line.textContent = `${entry.source}: “${entry.nickname.join(' // ')}”`;
    parent.append(line);
  }

  function initCardSearchLinks() {
    const typeLine = document.querySelector('#main .card-text-type-line');
    if (typeLine) {
      const indicator = typeLine.querySelector('.color-indicator');
      const text = typeLine.textContent.trim();
      const words = text.split(/(\s+|—)/);
      typeLine.replaceChildren();
      if (indicator) typeLine.append(indicator);
      for (const word of words) {
        if (!word.trim() || word === '—') { typeLine.append(document.createTextNode(word)); continue; }
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`type:${word.toLowerCase()}`)}`;
        link.textContent = word;
        typeLine.append(link);
      }
    }
    const cost = document.querySelector('#main .card-text-mana-cost');
    const symbols = [...(cost?.querySelectorAll('.card-symbol') || [])];
    if (cost && symbols.length) {
      const query = symbols.map(symbol => symbol.textContent.replace(/[{}]/g, '')).join('');
      if (query) {
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`mana="${query}"`)}`;
        while (cost.firstChild) link.append(cost.firstChild);
        cost.append(link);
      }
    }
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

  function initDeckPriceOption() {
    const select = document.querySelector('#with');
    if (!select) return;
    if (!select.querySelector('[value="no-prices"]')) {
      const option = document.createElement('option');
      option.value = 'no-prices';
      option.textContent = language === 'ru' ? 'Без цен' : 'No Prices';
      select.append(option);
    }
    const apply = () => {
      const hidden = select.value === 'no-prices';
      for (const node of document.querySelectorAll('.sidebar-prices,.deck-list-entry-axial-data')) {
        node.classList.toggle('stk-price-hidden', hidden);
      }
    };
    if (new URL(location.href).searchParams.get('with') === 'no-prices') select.value = 'no-prices';
    select.addEventListener('change', apply);
    apply();
  }

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
          if (path) queue.push({ cell, id: print.dataset.cardId, set: path[1] });
        }
        // Start with the current printing. Remaining rows arrive gradually to respect the marketplace rate limit.
        queue.sort((a,b) => Number(b.id === id) - Number(a.id === id));
        (async () => {
          for (const print of queue.slice(0, 75)) {
            try {
              const result = await request({ type: 'cardtrader', id: print.id, set: print.set });
              const price = result.nonfoil?.currency === 'EUR' ? result.nonfoil : result.foil?.currency === 'EUR' ? result.foil : null;
              if (!result.available && print.id === id && sources === 'ct') {
                heading.classList.remove('stk-price-hidden');
                for (const cell of nativeEurCells) cell?.classList.remove('stk-price-hidden');
              }
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
                if (sources === 'ct') {
                  heading.classList.remove('stk-price-hidden');
                  for (const cell of nativeEurCells) cell?.classList.remove('stk-price-hidden');
                }
                break;
              }
            }
          }
        })();
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
        icon.src = chrome.runtime.getURL('icons/cardtrader.svg');
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

  function priceHeading(provider) {
    const wrapper = document.createElement('span');
    wrapper.className = 'stk-price-heading';
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL(`icons/${provider}.svg`);
    icon.alt = '';
    wrapper.append(icon, document.createTextNode('EUR'));
    return wrapper;
  }

  function initPriceFilter() {
    for (const table of document.querySelectorAll('#main .prints-table')) {
      const headers = [...table.querySelectorAll('thead th')];
      for (const [index, header] of headers.entries()) {
        if (!['USD', 'TIX'].includes(header.textContent.trim().toUpperCase())) continue;
        header.classList.add('stk-price-hidden');
        for (const row of table.querySelectorAll('tbody tr')) row.children[index]?.classList.add('stk-price-hidden');
      }
    }
    const stores = document.querySelector('#stores');
    for (const link of stores?.querySelectorAll('a[href]') || []) {
      let host;
      try { host = new URL(link.href).hostname; } catch { continue; }
      if (!/(^|\.)(tcgplayer\.com|cardhoarder\.com)$/.test(host)) continue;
      link.classList.add('stk-price-hidden');
    }
    for (const row of stores?.querySelectorAll('.toolbox-links li') || []) {
      const links = [...row.querySelectorAll('a[href]')];
      if (links.length && links.every(link => link.classList.contains('stk-price-hidden'))) row.classList.add('stk-price-hidden');
    }
    stores?.querySelector('.toolbox-disclaimer')?.classList.add('stk-price-hidden');
    if (/^\/(?:@[^/]+\/decks\/|decks\/)/.test(location.pathname)) {
      for (const control of document.querySelectorAll('#main .sidebar-toolbox :is(a,button)')) {
        if (/^Buy on (?:TCGplayer|Cardhoarder)\b/i.test(control.textContent.trim())) control.classList.add('stk-price-hidden');
      }
    }
  }

  function initEdhrecStats() {
    const legality = document.querySelector('#main .card-text .card-legality');
    const name = [...document.querySelectorAll('#main .card-text-card-name')]
      .map(node => node.textContent.trim()).filter(Boolean).join(' // ');
    if (!legality || !name || document.getElementById('stk-edhrec')) return;
    request({ type: 'edhrec', name }).then(stats => {
      const hasUsage = settings.edhrecUsage && Number.isFinite(stats.numDecks) &&
        Number.isFinite(stats.potentialDecks) && stats.potentialDecks > 0;
      const hasSalt = settings.edhrecSalt && Number.isFinite(stats.salt);
      if (!hasUsage && !hasSalt) return;
      const panel = document.createElement('div');
      panel.id = 'stk-edhrec';
      panel.className = 'stk-edhrec-rows';
      if (!settings.edhrecLink) panel.classList.add('stk-no-source');
      let source;
      if (settings.edhrecLink) {
        source = document.createElement('a');
        source.href = stats.url;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.className = 'stk-edhrec-source';
        const logo = document.createElement('img');
        logo.src = chrome.runtime.getURL('icons/edhrec.png');
        logo.alt = 'EDHREC';
        source.append(logo);
        source.title = t('Открыть статистику карты на EDHREC');
      }
      if (hasUsage) {
        const usage = document.createElement('div');
        usage.className = 'stk-edhrec-item stk-edhrec-usage';
        const label = document.createElement('span');
        label.className = 'stk-edhrec-label';
        label.textContent = t('В колодах');
        const display = ['fraction','percent','both'].includes(settings.edhrecUsageDisplay) ? settings.edhrecUsageDisplay : 'both';
        const number = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US');
        const percent = `${new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(stats.numDecks / stats.potentialDecks * 100)}%`;
        const value = document.createElement('span');
        value.className = 'stk-edhrec-value stk-stat-badge';
        const metric = settings.usageColorMetric === 'percent' ? 'percent' : 'decks';
        const actual = metric === 'percent' ? stats.numDecks / stats.potentialDecks * 100 : stats.numDecks;
        const medium = Number(settings[metric === 'percent' ? 'usageMediumPercent' : 'usageMediumDecks']);
        const high = Number(settings[metric === 'percent' ? 'usageHighPercent' : 'usageHighDecks']);
        const valid = Number.isFinite(medium) && Number.isFinite(high) && medium >= 0 && high > medium;
        const lowBoundary = valid ? medium : metric === 'percent' ? 1 : 50000;
        const highBoundary = valid ? high : metric === 'percent' ? 2.6 : 100000;
        const tier = actual >= highBoundary ? 'high' : (metric === 'decks' ? actual >= lowBoundary : actual > lowBoundary) ? 'medium' : 'low';
        value.classList.add(`stk-usage-${tier}`);
        let fraction;
        if (display !== 'percent') {
          fraction = document.createElement('span');
          fraction.className = 'stk-edhrec-fraction';
          const numerator = document.createElement('span');
          numerator.textContent = number.format(stats.numDecks);
          const denominator = document.createElement('span');
          denominator.textContent = number.format(stats.potentialDecks);
          fraction.append(numerator, denominator);
          if (display === 'fraction') value.append(fraction);
        }
        if (display !== 'fraction') {
          const percentage = document.createElement('span');
          percentage.className = 'stk-edhrec-percent';
          percentage.textContent = percent;
          value.append(percentage);
        }
        value.title = language === 'ru' ? `${number.format(stats.numDecks)} из ${number.format(stats.potentialDecks)} подходящих по цветовой идентичности колод EDHREC (${percent})` : `${number.format(stats.numDecks)} of ${number.format(stats.potentialDecks)} color-identity-eligible EDHREC decks (${percent})`;
        if (source) label.append(source);
        usage.append(value, label);
        if (display === 'both') usage.append(fraction);
        panel.append(usage);
      }
      if (hasSalt) {
        const item = document.createElement('div');
        item.className = 'stk-edhrec-item stk-edhrec-salt';
        const label = document.createElement('span');
        label.className = 'stk-edhrec-label';
        label.textContent = 'Salt Meter';
        const salt = document.createElement('span');
        const medium = Number(settings.saltMediumThreshold);
        const high = Number(settings.saltHighThreshold);
        const valid = Number.isFinite(medium) && Number.isFinite(high) && medium >= 0 && high > medium && high <= 4;
        const tier = stats.salt >= (valid ? high : 2) ? 'high' : stats.salt >= (valid ? medium : 1) ? 'medium' : 'low';
        salt.className = `stk-salt-meter stk-stat-badge stk-salt-${tier}`;
        salt.textContent = stats.salt.toFixed(2) + (settings.showSaltScale ? ' / 4' : '');
        salt.title = t('Средняя оценка раздражающего эффекта карты по опросу EDHREC; не мера силы карты');
        if (source) label.append(source);
        item.append(salt, label);
        panel.append(item);
      }
      legality.append(panel);
      legality.hidden = false;
    }).catch(() => {});
  }

  function initPrintFinishes() {
    const table = document.querySelector('#main .prints > .prints-table');
    const printLinks = [...(table?.querySelectorAll('tbody tr td:first-child a[data-card-id]') || [])];
    const ids = [...new Set(printLinks.map(link => link.dataset.cardId))];
    if (!ids.length || ids.length > 75) return;
    request({ type: 'finishes', ids }).then(byId => {
      const marked = [];
      for (const link of printLinks) {
        const entry = byId[link.dataset.cardId];
        const finishes = Array.isArray(entry) ? entry : entry?.finishes;
        if (!Array.isArray(finishes)) continue;
        const special = entry?.promoTypes?.find(type => /^(surgefoil|textured|galaxyfoil|confettifoil|fracturefoil|halofoil|gilded|rainbowfoil|cosmicfoil)$/.test(type));
        const kind = special && finishes.length === 1 && finishes.includes('foil') ? 'special' : finishes.length === 1 ? finishes[0] : null;
        if (!['foil','nonfoil','etched','special'].includes(kind)) continue;
        // Scryfall already prints ★ in a foil-only collector number.
        if (kind === 'foil' && /★|✶/.test(link.textContent)) continue;
        marked.push({ link, kind, special });
      }
      if (!marked.length || !table || table.querySelector('.stk-finish-header')) return;
      const header = document.createElement('th');
      header.className = 'stk-finish-header';
      header.title = t('Отделка выпуска');
      header.setAttribute('aria-label', header.title);
      table.querySelector('thead th')?.after(header);
      const byLink = new Map(marked.map(item => [item.link, item]));
      for (const link of printLinks) {
        const cell = document.createElement('td');
        cell.className = 'stk-finish-cell';
        link.closest('tr')?.children[0]?.after(cell);
        const item = byLink.get(link);
        if (!item) continue;
        const badge = document.createElement('span');
        badge.className = `stk-finish-badge stk-finish-${item.kind}`;
        badge.title = item.kind === 'special' ? (language === 'ru' ? `Особый фойл: ${item.special}` : `Special foil: ${item.special}`) : t({ foil:'Только Foil', nonfoil:'Только Nonfoil', etched:'Только Etched Foil' }[item.kind]);
        badge.setAttribute('aria-label', badge.title);
        badge.textContent = { foil:'✶', nonfoil:'○', etched:'◈', special:'✧' }[item.kind];
        cell.append(badge);
      }
    }).catch(() => {});
  }

  function initExpandedPrints() {
    const table = document.querySelector('#main .prints > .prints-table');
    const native = document.querySelector('#main .prints .prints-all a') ||
      [...(table?.querySelectorAll('a[href]') || [])].find(link => /^(?:view all prints|показать все издания)/i.test(link.textContent.trim()));
    if (!native || document.getElementById('stk-all-prints')) return;
    const panel = document.createElement('section');
    panel.id = 'stk-all-prints';
    panel.hidden = true;
    const newPage = document.createElement('a');
    newPage.href = native.href;
    newPage.target = '_blank';
    newPage.rel = 'noopener noreferrer';
    newPage.textContent = language === 'ru' ? 'Открыть отдельной страницей ↗' : 'Open on a new page ↗';
    newPage.className = 'stk-prints-new-page';
    panel.append(newPage);
    table.after(panel);
    let loaded = false;
    native.setAttribute('aria-expanded', 'false');
    native.addEventListener('click', async event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      panel.hidden = !panel.hidden;
      native.setAttribute('aria-expanded', String(!panel.hidden));
      if (panel.hidden || loaded) return;
      const status = document.createElement('p');
      status.textContent = language === 'ru' ? 'Загружаю издания…' : 'Loading printings…';
      panel.append(status);
      try {
        let oracleId = document.querySelector('meta[name="scryfall:oracle:id"]')?.content;
        if (!oracleId) {
          const id = document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
          if (!id) throw new Error('Card identity unavailable');
          oracleId = (await request({type:'card', id})).oracle_id;
        }
        const {prints, truncated} = await request({type:'allPrints', oracleId});
        const categories = (settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideDigitalSets)
          ? await request({type:'setCategories'}).catch(() => ({})) : {};
        const excluded = new Set([
          ...(settings.hideDigitalSets ? categories.digital || [] : []),
          ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
          ...(settings.hideOversizedSets ? categories.oversized || [] : []),
          ...(settings.hideForeignBlackBorder ? categories.foreignBlackBorder || [] : [])
        ]);
        const groups = new Map();
        for (const card of prints) {
          if (excluded.has(card.set) || settings.hideDigitalSets && card.digital ||
              settings.hideNonEnglishPrints && card.lang !== 'en') continue;
          const group = groups.get(card.set) || [];
          group.push(card);
          groups.set(card.set, group);
        }
        status.remove();
        for (const cards of groups.values()) {
          const group = document.createElement('details');
          group.className = 'stk-print-group';
          if (cards.length === 1) group.open = true;
          const summary = document.createElement('summary');
          summary.textContent = `${cards[0].setName} (${cards[0].set.toUpperCase()}) · ${cards.length}`;
          group.append(summary);
          for (const card of cards) {
            const row = document.createElement('div');
            row.className = 'stk-print-entry';
            const link = document.createElement('a');
            link.href = card.uri;
            link.textContent = `#${card.number}${card.lang !== 'en' ? ` · ${card.lang.toUpperCase()}` : ''}`;
            const finish = document.createElement('span');
            finish.className = 'stk-print-finish';
            finish.textContent = (card.finishes || []).join(' / ');
            const price = document.createElement('span');
            price.className = 'stk-print-price';
            price.textContent = card.prices?.eur ? `€${card.prices.eur}` : card.prices?.eur_foil ? `✶ €${card.prices.eur_foil}` : '';
            row.append(link, finish, price);
            if (settings.clipboard && settings.printAddButtons) {
              const add = button('+', async () => {
                add.disabled = true;
                try { add.textContent = await window.STK_ADD_PRINT(card) ? '✓' : '+'; }
                finally { add.disabled = false; }
              });
              add.className = 'stk-print-add';
              add.title = language === 'ru' ? 'Добавить конкретное издание с кодом сета в буфер' : 'Add this printing with its set code to the clipboard';
              add.setAttribute('aria-label', add.title);
              row.append(add);
            }
            group.append(row);
          }
          panel.append(group);
        }
        if (truncated) {
          const note = document.createElement('p');
          note.textContent = language === 'ru' ? 'Часть изданий не загрузилась; откройте полную страницу.' : 'More printings are available on the full page.';
          panel.append(note);
        }
        loaded = true;
      } catch {
        status.textContent = language === 'ru' ? 'Не удалось загрузить издания. Откройте отдельную страницу.' : 'Could not load printings. Open the separate page.';
      }
    });
  }

  function initNativePrintButtons() {
    const name = [...document.querySelectorAll('#main .card-text-card-name')].map(node => node.textContent.trim()).filter(Boolean).join(' // ');
    if (!name) return;
    for (const row of document.querySelectorAll('#main .prints > .prints-table tbody tr:not(.current)')) {
      const link = row.querySelector('td:first-child a[href^="/card/"],td:first-child a[href^="https://scryfall.com/card/"]');
      const parts = link && new URL(link.href,location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!parts || row.querySelector('.stk-native-print-add')) continue;
      const add = button('+', async () => {
        add.disabled = true;
        try { add.textContent = await window.STK_ADD_PRINT({name,uri:link.href,set:parts[1],number:decodeURIComponent(parts[2])}) ? '✓' : '+'; }
        finally { add.disabled = false; }
      });
      add.className = 'stk-native-print-add';
      add.title = language === 'ru' ? 'Добавить это издание с сетом' : 'Add this printing with its set';
      add.setAttribute('aria-label', add.title);
      row.querySelector('td:first-child').append(add);
    }
  }

  async function initClipboard() {
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
    const copy = iconButton('duplicate', t('Копировать карты'), async () => {
      const format = (await chrome.storage.local.get({ exportFormat: "names" })).exportFormat;
      const text = cards.map(c => formatCard(c, format)).join("\n");
      try { await navigator.clipboard.writeText(text); copy.title = t('Скопировано'); copy.classList.add('stk-copied'); }
      catch { copy.title = t('Ошибка копирования'); }
      setTimeout(() => { copy.title = t('Копировать карты'); copy.classList.remove('stk-copied'); }, 1800);
    });
    const clear = iconButton('trash', t('Очистить буфер карт'), async () => {
      if (!cards.length || !confirm(t('Очистить буфер карт?'))) return;
      cards = [];
      await persist();
    });
    toolbar.append(copy, clear, open);
    root.append(toolbar, list);
    document.body.append(root);
    list.hidden = true;

    async function persist() {
      await chrome.storage.local.set({ cards });
      render();
      scan();
    }
    function formatCard(card, format) {
      const suffix = (format === 'moxfield' || card.forceSet) && card.set && card.number ? ` (${card.set.toUpperCase()}) ${card.number}` : '';
      return `1 ${card.name}${suffix}`;
    }
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
          const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'names' });
          try { await navigator.clipboard.writeText(formatCard(card, exportFormat)); copyCard.title = t('Скопировано'); copyCard.classList.add('stk-copied'); }
          catch { copyCard.title = t('Ошибка копирования'); }
          setTimeout(() => { copyCard.title = `${t('Копировать карту')} ${card.name}`; copyCard.classList.remove('stk-copied'); }, 1800);
        });
        copyCard.classList.add('stk-copy-card');
        const remove = button("×", async () => {
          cards.splice(index, 1);
          await persist();
        });
        remove.setAttribute("aria-label", `${t('Удалить')} ${card.name}`);
        row.append(link, copyCard, remove);
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
        let add = target.querySelector(":scope > .stk-add");
        if (!add) {
          add = button("+", async () => {
            const idx = cards.findIndex(c => c.name === name);
            if (idx >= 0) cards.splice(idx, 1);
            else cards.push({ name, url: link, set: match[1], number: decodeURIComponent(match[2]) });
            await persist();
          });
          add.className = "stk-add";
          target.append(add);
        }
        const selected = cards.some(c => c.name === name);
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
      if (changes.cards && Array.isArray(changes.cards.newValue)) { cards = changes.cards.newValue; render(); scan(); }
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

  function iconButton(name, label, onClick) {
    const control = button('', onClick);
    control.className = `stk-icon-button stk-icon-${name}`;
    control.title = label;
    control.setAttribute('aria-label', label);
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = chrome.runtime.getURL(`icons/${name}.svg`);
    control.append(icon);
    return control;
  }

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
    let preview, previewTimer, hideTimer, activePreview;
    function hidePreview(immediate = false) {
      clearTimeout(previewTimer);
      clearTimeout(hideTimer);
      if (immediate) { activePreview = null; if (preview) preview.hidden = true; return; }
      hideTimer = setTimeout(() => {
        if (preview?.matches(':hover')) return;
        activePreview = null;
        if (preview) preview.hidden = true;
      }, 450);
    }
    function positionPreview(link) {
      const rect = link.getBoundingClientRect();
      const width = 240, height = 340;
      const left = rect.left > width + 24 ? rect.left - width - 12 : rect.right + 12;
      preview.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
      preview.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))}px`;
    }
    function enablePreview(link, kind, id) {
      const show = () => {
        hidePreview(true);
        activePreview = link;
        previewTimer = setTimeout(async () => {
          try {
            if (!preview) {
              preview = document.createElement('div');
              preview.id = 'stk-card-preview';
              preview.addEventListener('mouseenter', () => clearTimeout(hideTimer));
              preview.addEventListener('mouseleave', () => hidePreview());
              document.body.append(preview);
              window.addEventListener('scroll', () => hidePreview(true), { passive: true });
            }
            preview.textContent = t('Загружаю карту…');
            preview.classList.add('stk-card-preview-loading');
            positionPreview(link);
            preview.hidden = false;
            const card = await request({ type: 'preview', kind, id });
            if (activePreview !== link) return;
            if (card.uri) link.href = card.uri;
            const img = document.createElement('img');
            img.src = card.image;
            img.alt = card.name;
            preview.setAttribute('aria-label', card.name);
            preview.replaceChildren(img);
            preview.classList.remove('stk-card-preview-loading');
            positionPreview(link);
            preview.hidden = false;
          } catch { if (activePreview === link) hidePreview(true); }
        }, 160);
      };
      link.addEventListener('mouseenter', show);
      link.addEventListener('focus', show);
      link.addEventListener('mouseleave', () => hidePreview());
      link.addEventListener('blur', () => hidePreview());
    }
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
      if (["COMES_BEFORE", "DEPICTS", "REFERENCES_TO", "BETTER_THAN"].includes(type)) icon.classList.add("icon-flipped");
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
              enablePreview(a, kind, tag.targetId);
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
  }

  function button(label, click) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", click);
    return b;
  }
})();
