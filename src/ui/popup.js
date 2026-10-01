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
  const KEYS = ['darkTheme', 'tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices', 'settingsLanguage'];

  chrome.storage.local.get(Object.fromEntries(KEYS.map(key => [key, null])), values => {
    const language = window.STK_I18N.resolveSettingsLanguage(values.settingsLanguage);
    if (window.STK_I18N) window.STK_I18N.localizeOptions(language);

    const theme = document.getElementById('darkTheme');
    theme.value = ['auto', 'light', 'dark'].includes(values.darkTheme) ? values.darkTheme : 'auto';

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
  edhrecLink: ['https://json.edhrec.com/*'],
  cardtraderPrices: ['https://api.cardtrader.com/*']
};
function requestHostAccess(key) {
  const origins = OPTIONAL_HOSTS[key];
  if (!origins || !chrome.permissions || !chrome.permissions.request) return Promise.resolve(true);
  return new Promise(resolve => {
    try {
      chrome.permissions.request({ origins }, granted => resolve(Boolean(granted)));
    } catch (error) {
      resolve(false);
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
          requestHostAccess(id).then(granted => {
            if (!granted) { event.target.checked = false; return; }
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
