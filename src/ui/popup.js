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

// The toolbar popup. Every control here writes the same setting the full
// settings page writes, so the two views cannot drift apart; there is one set
// of values and two ways to reach it.
(() => {
  // The same defaults the full settings page and the content scripts use. `null` here read every
  // missing key as off, so on a fresh profile the popup showed Tags and CardClip switched off
  // while both are on everywhere else — the popup is a view of the same settings, and a view that
  // invents its own defaults is a second answer to the same question.
  chrome.storage.local.get({
    darkTheme: 'auto', tags: true, clipboard: true,
    edhrecUsage: false, cardtraderPrices: false, settingsLanguage: 'auto'
  }, values => {
    const language = window.STK_I18N.resolveSettingsLanguage(values.settingsLanguage);
    if (window.STK_I18N) window.STK_I18N.localizeOptions(language);

    const theme = document.getElementById('darkTheme');
    // Installations that predate the three-way choice stored a boolean: true is the dark theme
    // the user asked for, false is the light page they were seeing. The full page reads it that
    // way; the popup showed both as Auto.
    const storedTheme = values.darkTheme === true ? 'dark' : values.darkTheme === false ? 'light' : values.darkTheme;
    theme.value = ['auto', 'light', 'dark'].includes(storedTheme) ? storedTheme : 'auto';

    for (const id of ['tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices']) {
      const box = document.getElementById(id);
      box.checked = Boolean(values[id]);
    }

// EDHREC and CardTrader are optional, and so is the access they need. The browser
// only grants these hosts when the user turns one of them on -- turning a switch
// off and on again is also how access is put back after an update or a revoke.
const OPTIONAL_HOSTS = {
  edhrecUsage: ['https://json.edhrec.com/*'],
  edhrecSalt: ['https://json.edhrec.com/*'],
  cardtraderPrices: ['https://api.cardtrader.com/*']
};
// Asks for a host. Only ever from inside a click, and the refusal is always read.
//
// Two things went wrong here once. Chrome grants an optional permission only inside a
// gesture, so a request made after an await — or on load — is refused, and it is refused
// through the callback rather than by throwing. Unread, chrome.runtime.lastError is
// printed as "Unchecked runtime.lastError" and the reader is left with a console line and
// a switch that quietly did not change.
function requestHostAccess(key) {
  const origins = OPTIONAL_HOSTS[key];
  if (!origins || !chrome.permissions || !chrome.permissions.request) {
    return Promise.resolve({ granted: true, reason: '' });
  }
  return new Promise(resolve => {
    try {
      chrome.permissions.request({ origins }, granted => {
        const refusal = chrome.runtime.lastError;
        resolve({
          granted: Boolean(granted),
          reason: refusal ? refusal.message || String(refusal) : ''
        });
      });
    } catch (error) {
      resolve({ granted: false, reason: (error && error.message) || String(error) });
    }
  });
}

    const status = document.getElementById('status');
    const saved = () => {
      status.textContent = window.STK_I18N ? window.STK_I18N.t('Сохранено', language) : 'Saved';
    };

    theme.addEventListener('change', () => {
      chrome.storage.local.set({ darkTheme: theme.value }, saved);
    });

    for (const id of ['tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices']) {
      document.getElementById(id).addEventListener('change', event => {
        const wanted = event.target.checked;
        if (wanted && OPTIONAL_HOSTS[id]) {
          requestHostAccess(id).then(answer => {
            if (!answer.granted) {
              // A switch that goes back without a word reads as a checkbox that does not
              // work; the browser's own refusal is the useful thing to show.
              event.target.checked = false;
              status.textContent = answer.reason
                ? (window.STK_I18N ? window.STK_I18N.t('Браузер не дал спросить: ', language) : 'Browser would not ask: ') +
                  answer.reason
                : (window.STK_I18N ? window.STK_I18N.t('Доступ не выдан.', language) : 'Access not granted.');
              return;
            }
            chrome.storage.local.set({ [id]: true }, saved);
          });
          return;
        }
        chrome.storage.local.set({ [id]: wanted }, saved);
      });
    }

    // The popup is deliberately short. Everything else lives on the full page,
    // which opens in a tab where it has room.
    document.getElementById('openAll').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  });
})();
