const defaults = {
  settingsLanguage: 'ru', siteLanguage: 'en',
  clipboard: true, printAddButtons: true, darkTheme: false, hideDigitalSets: false, hideNonTournamentSets: false, hideOversizedSets: false, hideForeignBlackBorder: false, hideNonEnglishPrints: false, tags: true, cardTags: true, artTags: true, relationships: true, onlyCardmarket: false,
  finishBadges: true, cardtraderPrices: false, cardtraderToken: '', euroPriceSources: 'cm',
  edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: true, edhrecUsageDisplay: 'both',
  usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
  usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
  hideCasterIndicator: false, printPageSameTab: false,
  taggerSearchLinks: false, cardSearchLinks: false, cardNicknames: false, deckNoPrices: true, stackedDeckCards: false, deckTokens: false,
  legalities: true, exportFormat: "moxfield", formatOrder: null, formatVisibility: null,
  discoveredFormats: [], premodern: true, heritage: false, classic: false, peak: false
};
const basicFields = ["clipboard", "printAddButtons", "printPageSameTab", "darkTheme", "hideCasterIndicator", "hideDigitalSets", "hideNonTournamentSets", "hideOversizedSets", "hideForeignBlackBorder", "hideNonEnglishPrints", "tags", "cardTags", "artTags", "relationships", "finishBadges", "onlyCardmarket", "cardtraderPrices", "euroPriceSources", "edhrecUsage", "edhrecSalt", "showSaltScale", "edhrecLink", "edhrecUsageDisplay", "usageColorMetric", "legalities", "exportFormat", "taggerSearchLinks", "cardSearchLinks", "cardNicknames", "deckNoPrices", "stackedDeckCards", "deckTokens"];
const status = document.getElementById("status");
chrome.storage.local.get(defaults, values => {
  let language = values.settingsLanguage === 'en' ? 'en' : 'ru';
  const t = text => window.STK_I18N.t(text, language);
  const settingsLanguage = document.getElementById('settingsLanguage');
  const siteLanguage = document.getElementById('siteLanguage');
  settingsLanguage.value = language;
  siteLanguage.value = values.siteLanguage === 'ru' ? 'ru' : 'en';
  window.STK_I18N.localizeOptions(language);
  const token = document.getElementById('cardtraderToken');
  const tokenStatus = document.getElementById('tokenStatus');
  const label = document.getElementById('cardtraderTokenLabel');
  const save = document.getElementById('saveToken');
  const remove = document.getElementById('removeToken');
  function showTokenState(stored) {
    tokenStatus.dataset.stored = stored ? 'yes' : 'no';
    label.textContent = t(stored ? 'Личный API-токен CardTrader · сохранён ✓' : 'Личный API-токен CardTrader · не задан');
    token.placeholder = t(stored ? 'Введите новый токен для замены сохранённого' : 'Вставь личный токен');
    save.textContent = t(stored ? 'Заменить' : 'Сохранить');
    remove.disabled = !stored;
    tokenStatus.textContent = t(stored ? 'Токен сохранён. Пустое поле означает, что текущий токен продолжает работать. Он передаётся только в API CardTrader.' : 'Для цен CardTrader нужен личный токен. Он хранится локально и передаётся только в API CardTrader.');
  }
  showTokenState(Boolean(values.cardtraderToken));
  settingsLanguage.addEventListener('change', () => {
    language = settingsLanguage.value === 'en' ? 'en' : 'ru';
    window.STK_I18N.localizeOptions(language);
    showTokenState(tokenStatus.dataset.stored === 'yes');
    document.querySelectorAll('#formatList .format-item').forEach(row => { row.title = language === 'ru' ? `Перетащи ${formats.get(row.dataset.key)} в нужную колонку` : `Drag ${formats.get(row.dataset.key)} to either column`; });
    status.textContent = t('Сохранено');
    chrome.storage.local.set({ settingsLanguage: language });
  });
  siteLanguage.addEventListener('change', () => {
    chrome.storage.local.set({ siteLanguage: siteLanguage.value === 'ru' ? 'ru' : 'en' }, () => { status.textContent = t('Сохранено'); });
  });
  document.getElementById('saveToken').addEventListener('click', () => {
    const value = token.value.trim();
    if (!value || /\s/.test(value)) { status.textContent = t('Вставь токен без пробелов'); return; }
    chrome.storage.local.set({ cardtraderToken: value }, () => {
      token.value = '';
      showTokenState(true);
      tokenStatus.dataset.stored = 'yes';
      status.textContent = t('Токен сохранён; цены проверятся на странице карты');
    });
  });
  document.getElementById('removeToken').addEventListener('click', () => {
    chrome.storage.local.remove('cardtraderToken', () => {
      document.getElementById('cardtraderPrices').checked = false;
      document.getElementById('euroPriceSources').value = 'cm';
      chrome.storage.local.set({ cardtraderPrices: false, euroPriceSources: 'cm' });
      token.value = '';
      showTokenState(false);
      tokenStatus.dataset.stored = 'no';
      status.textContent = t('Токен удалён');
    });
  });
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  for (const key of basicFields) {
    const element = document.getElementById(key);
    if (element.type === "checkbox") element.checked = Boolean(values[key]);
    else element.value = values[key];
    element.addEventListener("change", () => {
      chrome.storage.local.set({ [key]: element.type === "checkbox" ? element.checked : element.value }, () => {
        status.textContent = t('Сохранено');
      });
    });
  }
  const usageMetric = document.getElementById('usageColorMetric');
  function showUsageThresholds() {
    document.getElementById('usageCountThresholds').hidden = usageMetric.value === 'percent';
    document.getElementById('usagePercentThresholds').hidden = usageMetric.value !== 'percent';
  }
  usageMetric.addEventListener('change', showUsageThresholds);
  showUsageThresholds();
  for (const [mediumKey,highKey,max] of [['usageMediumDecks','usageHighDecks',Infinity],['usageMediumPercent','usageHighPercent',100]]) {
    const low = document.getElementById(mediumKey);
    const high = document.getElementById(highKey);
    low.value = values[mediumKey];
    high.value = values[highKey];
    function save() {
      const a = Number(low.value), b = Number(high.value);
      if (!low.value || !high.value || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || b > max) {
        status.textContent = t('Пороги популярности: красный должен быть выше жёлтого');
        return;
      }
      chrome.storage.local.set({ [mediumKey]: a, [highKey]: b }, () => { status.textContent = t('Пороги популярности сохранены'); });
    }
    low.addEventListener('change', save);
    high.addEventListener('change', save);
  }
  const saltMedium = document.getElementById('saltMediumThreshold');
  const saltHigh = document.getElementById('saltHighThreshold');
  saltMedium.value = values.saltMediumThreshold;
  saltHigh.value = values.saltHighThreshold;
  function saveSaltThresholds() {
    const medium = Number(saltMedium.value);
    const high = Number(saltHigh.value);
    if (!saltMedium.value || !saltHigh.value || !Number.isFinite(medium) || !Number.isFinite(high) || medium < 0 || high <= medium || high > 4) {
      status.textContent = t('Укажи пороги от 0 до 4; красный должен быть выше жёлтого');
      return;
    }
    chrome.storage.local.set({ saltMediumThreshold: medium, saltHighThreshold: high }, () => {
      status.textContent = t('Пороги Salt сохранены');
    });
  }
  saltMedium.addEventListener('change', saveSaltThresholds);
  saltHigh.addEventListener('change', saveSaltThresholds);

  const catalog = [...window.STK_FORMAT_CATALOG, ...values.discoveredFormats.map(({ key, label }) => [key, label])];
  const formats = new Map(catalog);
  const order = [...new Set([...(values.formatOrder || []), ...formats.keys()])].filter(key => formats.has(key));
  const visibility = { ...(values.formatVisibility || {}) };
  const isVisible = key => Object.prototype.hasOwnProperty.call(visibility, key)
    ? visibility[key] : ["premodern", "heritage", "classic", "peak"].includes(key) ? values[key] : true;
  const container = document.getElementById("formatList");
  const persist = () => {
    chrome.storage.local.set({ formatOrder: [...order], formatVisibility: { ...visibility } }, () => {
      status.textContent = t('Порядок и видимость сохранены');
    });
  };
  function render() {
    container.replaceChildren();
    order.forEach(key => {
      const row = document.createElement("div");
      row.className = "format-item";
      row.classList.toggle('is-hidden', !isVisible(key));
      row.draggable = true;
      row.tabIndex = 0;
      row.dataset.key = key;
      row.title = language === 'ru' ? `Перетащи ${formats.get(key)} в нужную колонку` : `Drag ${formats.get(key)} to either column`;
      const handle = document.createElement('span');
      handle.className = 'handle';
      handle.textContent = '⠿';
      handle.setAttribute('aria-hidden', 'true');
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isVisible(key);
      checkbox.addEventListener("change", () => { visibility[key] = checkbox.checked; row.classList.toggle('is-hidden', !checkbox.checked); persist(); });
      label.append(checkbox, document.createTextNode(` ${formats.get(key)}`));
      row.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', key);
        event.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drag-over');
        const from = event.dataTransfer.getData('text/plain');
        if (!formats.has(from) || from === key) return;
        order.splice(order.indexOf(from), 1);
        order.splice(order.indexOf(key), 0, from);
        render(); persist();
      });
      row.addEventListener('keydown', event => {
        if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key) || event.target !== row) return;
        event.preventDefault();
        const index = order.indexOf(key);
        const step = event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : event.key === 'ArrowLeft' ? -1 : 1;
        const target = index + step;
        if (target < 0 || target >= order.length) return;
        [order[index], order[target]] = [order[target], order[index]];
        render(); persist();
        container.querySelector(`[data-key="${key}"]`)?.focus();
      });
      row.append(handle, label);
      container.append(row);
    });
  }
  render();
});
