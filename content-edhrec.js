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

// EDHREC's usage and salt, and the panel beside the legalities.
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
      // The panel's two columns have to sit exactly under the two status
      // columns of the legality block above. Those columns are content-sized,
      // so the few-pixel offset depends on the format names, the column width
      // and the browser zoom: it is measured instead of hard-coded.
      shared.realignStatsPanel = () => {
        const salt = panel.querySelector('.stk-edhrec-salt');
        const meter = panel.querySelector('.stk-salt-meter');
        if (!salt || !meter) return;
        salt.style.marginLeft = '0px';
        const pills = [...legality.querySelectorAll('.card-legality-item dd')];
        const target = meter.getBoundingClientRect().left;
        let best = null;
        let bestGap = Infinity;
        for (const pill of pills) {
          const gap = Math.abs(pill.getBoundingClientRect().left - target);
          if (gap < bestGap) { bestGap = gap; best = pill; }
        }
        if (best && bestGap < 40) {
          salt.style.marginLeft = `${best.getBoundingClientRect().left - target}px`;
        }
      };
      shared.realignStatsPanel();
      let realignTimer;
      addEventListener('resize', () => {
        clearTimeout(realignTimer);
        realignTimer = setTimeout(shared.realignStatsPanel, 120);
      }, { passive: true });
    }).catch(() => {});
  }


  self.STK_CONTENT.on("edhrecStats", () => initEdhrecStats());
})();
