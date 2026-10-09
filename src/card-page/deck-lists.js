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

// The deck page: token list, stacked cards, and the No Prices switch.
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

  // The deck's own cards, by set and collector number.
  //
  // One reader for the token lookup and the legality check alike. They were separate
  // readings of the same list a moment ago, and two readers of one list is two things
  // that can disagree about which cards are in the deck.
  function deckEntries() {
    if (!/^\/@[^/]+\/decks\//.test(location.pathname)) return [];
    const anchors = [...document.querySelectorAll('.deck-list-entry .deck-list-entry-name a, a.card-grid-item-card[href]')];
    return [...new Map(anchors.map(a => {
      const path = new URL(a.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      return path && [path[1] + '/' + path[2], { set: path[1], collector_number: decodeURIComponent(path[2]) }];
    }).filter(Boolean)).values()].slice(0, 150);
  }

  // Where a deck page's buttons go, which is not always the same place.
  //
  // Scryfall's stylesheet shows `.sidebar` only from 800px up and keeps one on a narrow
  // screen with the class `always-visible`, so below that the sidebar is `display:none` —
  // present in the markup, zero pixels on the screen. A button prepended into it is a button
  // nobody can press, which is how both these features were unreachable on a phone.
  //
  // It is Scryfall's layout and this does not change it. The fix is to stop putting a control
  // into a box that is not on the page: the sidebar is used when it is actually visible and
  // the deck list's own container is used when it is not, which is also where the second
  // placement already pointed — it was simply never reached, because the test was whether
  // the sidebar was *absent* rather than whether it was *shown*.
  //
  // `getClientRects()` is the browser's own answer and the reason this works: an element
  // with `display:none` produces no boxes, so a button in one measures 0x0 rather than
  // merely looking wrong. `offsetParent` is null for the same reason and is not used, since
  // it is also null for anything with `position:fixed`.
  function deckButtonPlace() {
    const shown = element => {
      if (!element) return false;
      if (typeof element.getClientRects === 'function') return element.getClientRects().length > 0;
      // A browser without layout cannot answer this, and neither can the test harness, which
      // runs on linkedom. Guessing "hidden" there would move the buttons to a place the tests
      // never look and fail for a reason that is not a defect; guessing "shown" is what this
      // code did before there was a question to answer. So the answer is: ask who can say.
      return true;
    };
    const sidebar = document.querySelector('#main .sidebar');
    if (shown(sidebar)) return sidebar;
    const besideDeckList = document.querySelector('#main .deck-list')?.parentElement;
    return besideDeckList || sidebar;
  }

  // Put a button where a reader can see it, and ask again once the page has been laid out.
  //
  // The first attempt is made immediately because in a browser the stylesheet is already
  // applied by the time a content script runs, so the answer is right the first time and the
  // repeat is a no-op. It is asked again because the one place this code runs where layout
  // does not exist is the harness, and a decision made without layout is a decision made
  // without the question's answer — `npm run render` loads the result into Chrome, and a
  // button placed by a script that could not see the page is exactly the defect this exists
  // to fix. Asking twice costs one frame and is the difference between the check being able
  // to see the fix and not being able to.
  function placeDeckButton(button) {
    const put = () => {
      const place = deckButtonPlace();
      // The parent, not the ancestor: the fallback is `#main` and the sidebar is inside it,
      // so `contains` is true while the button is in exactly the wrong place — which is how
      // the first version of this left it in a hidden box and reported success.
      if (place && button.parentElement !== place) place.prepend(button);
    };
    put();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(put);
    return put;
  }

  function initDeckTokens() {
    const entries = deckEntries();
    // Where the button goes is `deckButtonPlace`'s question; this only asks whether there is
    // anywhere at all, since a deck page with no deck list and no sidebar has neither.
    if (!entries.length || !document.querySelector('#main .sidebar, #main .deck-list')) return;
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
    placeDeckButton(button);
  }

  function initStackedDeckCards() {
    if (!document.querySelector('.deck-list')) return;
    const grid = document.querySelector('.card-grid');
    const cards = [...(grid?.querySelectorAll('.card-grid-item[data-card-id]') || [])];
    if (!cards.length) return;
    grid.classList.add('stk-stacked-deck');
    cards.at(-1).classList.add('stk-stacked-last');
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


  // Which cards Scryfall does not accept in Commander, and the limit of what that is.
  //
  // The panel opens with the answer and closes with what the answer is not. A legality
  // check that reports "your deck is fine" when it has only asked Scryfall about each
  // card in turn is the check that guesses, which is the thing this project has declined
  // to ship three times; so the panel names the rules it did not apply, where it can be
  // read before the reader acts on a list.
  // Scryfall's other verdicts, in the reader's words rather than the API's. Read off
  // live answers: Black Lotus and Ancestral Recall both say `banned` for Commander, and a
  // card restricted in a format says `restricted` - Scryfall uses four words across all of
  // `legalities`, and a panel that called all three of them "not legal" would be
  // paraphrasing a distinction Scryfall took the trouble to make.
  const VERDICT_TEXT = {
    banned: t => t('запрещена в Commander'),
    restricted: t => t('ограничена в Commander')
  };

  function initDeckLegality() {
    const entries = deckEntries();
    if (!entries.length || !document.querySelector('#main .sidebar, #main .deck-list')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button-n stk-legality-button';
    button.textContent = t('Проверить карты в Commander');
    const dialog = document.createElement('dialog');
    dialog.id = 'stk-deck-legality';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button-n';
    close.textContent = t('Закрыть');
    close.addEventListener('click', () => dialog.close());
    const title = document.createElement('h2');
    title.textContent = t('Допустимость карт в Commander');
    const content = document.createElement('div');
    content.className = 'stk-legality-result';
    dialog.append(title, close, content);
    document.body.append(dialog);

    let pending;
    const line = text => {
      const p = document.createElement('p');
      p.className = 'stk-legality-note';
      p.textContent = text;
      return p;
    };
    button.addEventListener('click', async () => {
      dialog.showModal();
      if (!pending) {
        content.textContent = t('Проверяю карты…');
        pending = request({ type: 'deckLegality', entries })
          .catch(error => { pending = null; throw error; });
      }
      try {
        const answer = await pending;
        content.replaceChildren();
        if (!answer.checked) {
          content.append(line(t('Scryfall не ответил ни по одной карте.')));
          return;
        }
        if (!answer.notLegal.length && !answer.unknown) {
          content.append(line(t('Все карты колоды Scryfall считает легальными в Commander.')));
        } else if (answer.notLegal.length) {
          const list = document.createElement('ul');
          list.className = 'stk-legality-list';
          for (const card of answer.notLegal) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = card.uri;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = card.name;
            item.append(link, document.createTextNode(
              ' — ' + (card.set || '').toUpperCase() + ' #' + card.collector_number));
            // Scryfall's own word for why, when it is not simply "outside this format".
            // A banned card is a different problem from a card that was never legal here,
            // and "not legal" alone would say so misleadingly about both.
            const why = VERDICT_TEXT[card.verdict];
            if (why) {
              const mark = document.createElement('span');
              mark.className = 'stk-legality-verdict';
              mark.textContent = ' · ' + why(t);
              item.append(mark);
            }
            list.append(item);
          }
          content.append(line(t('Scryfall считает эти карты нелегальными в Commander:')));
          content.append(list);
        }
        if (answer.unknown) {
          content.append(line(t('Про %s карт Scryfall не сказал ничего; это не то же самое, что «легально».').replace('%s', String(answer.unknown))));
        }
        // Always last, and never omitted: it is the half of the answer a list of card
        // names cannot give.
        content.append(line(t(
          'Проверена только легальность каждой карты отдельно. Цветовая идентичность командира, ограничение в 100 карт и правило одной копии для карт с надписью «только Commander» не проверялись.')));
      } catch {
        content.replaceChildren(line(t('Не удалось проверить легальность.')));
      }
    });
    placeDeckButton(button);
  }

  self.STK_CONTENT.on("deckTokens", () => initDeckTokens());
  self.STK_CONTENT.on("deckLegality", () => initDeckLegality());
  self.STK_CONTENT.on("stackedDeckCards", () => initStackedDeckCards());
  self.STK_CONTENT.on("deckPriceOption", () => initDeckPriceOption());
})();
