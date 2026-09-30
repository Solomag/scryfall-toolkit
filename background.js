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
// Bundled compact tag data originates from MoxTags v1.8.3 (MIT).
importScripts("data/set-platforms.js");
importScripts("format-overrides.js");
const cache = new Map();
const traderCache = new Map();
let digitalSetRequest;
let setPlatformRequest;
// The bundled snapshot answers almost every digital set; Scryfall's own index
// never says which client carries one. See data/set-platforms.js.
const bundledSetPlatforms = self.__STK_SET_PLATFORMS || {};
delete self.__STK_SET_PLATFORMS;
// Marketplace calls are spaced 1.1s apart by CardTrader's own expectations, and
// the moment until which the next one must wait is kept in storage: a global
// would reset to zero when the worker is unloaded and let the next start burst.
let traderNextMarketplaceRequest = 0;
let traderThrottleLoading = null;
function loadTraderThrottle() {
  if (!traderThrottleLoading) {
    traderThrottleLoading = chrome.storage.local.get('traderThrottle').then(stored => {
      const saved = stored && stored.traderThrottle;
      if (Number.isFinite(saved)) traderNextMarketplaceRequest = saved;
    }).catch(() => {});
  }
  return traderThrottleLoading;
}
chrome.storage.onChanged?.addListener(changes => { if (changes.cardtraderToken) traderCache.clear(); });
function traderMemo(key, ttl, load) {
  const old = traderCache.get(key);
  if (old && old.expires > Date.now()) return old.promise;
  const promise = load().catch(error => { traderCache.delete(key); throw error; });
  traderCache.set(key, { expires: Date.now() + ttl, promise });
  return promise;
}
async function cardTrader(path, token) {
  if (path.startsWith('marketplace/products?')) {
    await loadTraderThrottle();
    const wait = Math.max(0, traderNextMarketplaceRequest - Date.now());
    traderNextMarketplaceRequest = Date.now() + wait + 1100;
    Promise.resolve(chrome.storage.local.set({ traderThrottle: traderNextMarketplaceRequest })).catch(() => {});
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  }
  return getJSON(`https://api.cardtrader.com/api/v2/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, credentials: 'omit'
  });
}
async function cardTraderPrices(id, set, token) {
  const expansions = await traderMemo('trader:expansions', 24 * 3600000, () => cardTrader('expansions', token));
  const expansion = expansions.find(item => item.game_id === 1 && item.code?.toLowerCase() === set.toLowerCase());
  if (!expansion) return { available: false };
  const blueprints = await traderMemo(`trader:blueprints:${expansion.id}`, 24 * 3600000,
    () => cardTrader(`blueprints/export?expansion_id=${expansion.id}`, token));
  const blueprint = blueprints.find(item => item.scryfall_id?.toLowerCase() === id.toLowerCase());
  if (!blueprint) return { available: false };
  const raw = await traderMemo(`trader:products:${blueprint.id}`, 5 * 60000,
    () => cardTrader(`marketplace/products?blueprint_id=${blueprint.id}`, token));
  const products = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data :
    Object.values(raw || {}).flatMap(value => Array.isArray(value) ? value : []);
  const cheapest = { foil: null, nonfoil: null };
  for (const product of products) {
    if (product.blueprint_id !== blueprint.id || product.quantity <= 0) continue;
    const cents = product.price?.cents ?? product.price_cents;
    const currency = product.price?.currency ?? product.price_currency;
    if (!Number.isFinite(cents) || !/^[A-Z]{3}$/.test(currency || '')) continue;
    const kind = product.properties_hash?.mtg_foil === true || product.properties?.mtg_foil === true ? 'foil' : 'nonfoil';
    if (!cheapest[kind] || (cheapest[kind].currency === currency && cents < cheapest[kind].cents)) {
      cheapest[kind] = { cents, currency };
    }
  }
  return { available: true, url: `https://www.cardtrader.com/en/cards/${blueprint.id}`, ...cheapest };
}
// EDHREC publishes a data policy for community projects: at most one request a
// second, at least two seconds before trying again after a 429, and no repeated
// attempts while something is broken -- "requestors that violate this may be
// banned". The requests are made by the user's own browser, which is the case
// their policy exempts from the User-Agent requirement.
//
// What makes this hold up rather than merely look like it does:
//
//   - Every request joins one queue and the next slot is taken before waiting,
//     so two callers cannot wake into the same second.
//   - The cache and the backoff live in chrome.storage.local, because an MV3
//     worker is unloaded when idle and its globals go with it. In memory a
//     "six hour" cache is six hours at most, and the hold-back after a 429
//     disappears exactly when it matters.
let edhrecState = { cache: {}, nextRequest: 0, heldUntil: 0, failures: 0 };
let edhrecStateLoading = null;
let edhrecQueue = Promise.resolve();
let edhrecInFlight = new Map();
let edhrecSaveTimer = null;

const EDHREC_TTL = 6 * 3600000;

function loadEdhrecState() {
  if (!edhrecStateLoading) {
    edhrecStateLoading = chrome.storage.local.get('edhrecState').then(stored => {
      const saved = stored && stored.edhrecState;
      if (saved && typeof saved === 'object') {
        edhrecState = {
          cache: saved.cache && typeof saved.cache === 'object' ? saved.cache : {},
          nextRequest: Number.isFinite(saved.nextRequest) ? saved.nextRequest : 0,
          heldUntil: Number.isFinite(saved.heldUntil) ? saved.heldUntil : 0,
          failures: Number.isFinite(saved.failures) ? saved.failures : 0
        };
      }
    }).catch(() => {});
  }
  return edhrecStateLoading;
}

// Coalesced onto the next turn, so a page that looks up ten cards costs one
// write rather than ten.
function saveEdhrecState() {
  if (edhrecSaveTimer !== null) return;
  edhrecSaveTimer = setTimeout(() => {
    edhrecSaveTimer = null;
    Promise.resolve(chrome.storage.local.set({ edhrecState })).catch(() => {});
  }, 0);
}

function edhrecPenalty() {
  edhrecState.failures = Math.min(edhrecState.failures + 1, 6);
  // Well over the two seconds EDHREC asks for rather than exactly two: measured
  // from the request that follows, in-flight work already eats a millisecond or
  // two, and "at least" should not mean "by a hair". Doubles to a minute.
  edhrecState.heldUntil = Date.now() + Math.min(60000, 2500 * 2 ** (edhrecState.failures - 1));
  saveEdhrecState();
}

function edhrecCached(slug) {
  const hit = edhrecState.cache[slug];
  return hit && hit.expires > Date.now() ? hit : null;
}

// Two tabs on the same card ask for the same slug; only one request goes out.
// EDHREC's commander page carries its card lists already grouped, each card with
// the Scryfall id this extension needs to add it to a deck. Only what the feature
// shows is taken; the rest of their page is not stored here.
function edhrecCommanderLists(body) {
  const lists = body && body.container && body.container.json_dict &&
    body.container.json_dict.cardlists;
  if (!Array.isArray(lists)) throw new Error('EDHREC returned no card lists');
  return lists.map(list => ({
    header: String(list && list.header || '').slice(0, 60),
    cards: (Array.isArray(list && list.cardviews) ? list.cardviews : [])
      .filter(card => /^[0-9a-f-]{36}$/.test(card && card.id || ''))
      .map(card => ({
        id: card.id,
        name: String(card.name || '').slice(0, 120),
        synergy: Number.isFinite(card.synergy) ? Math.round(card.synergy * 1000) / 1000 : null,
        numDecks: Number.isFinite(card.num_decks) ? card.num_decks : null,
        potentialDecks: Number.isFinite(card.potential_decks) ? card.potential_decks : null
      }))
  })).filter(list => list.cards.length > 0);
}

function edhrecFetch(path) {
  const running = edhrecInFlight.get(path);
  if (running) return running;
  const run = edhrecQueue.then(() => edhrecRoundTrip(path));
  edhrecQueue = run.then(() => {}, () => {});
  edhrecInFlight.set(path, run);
  run.then(() => {}, () => {}).then(() => { edhrecInFlight.delete(path); });
  return run;
}

// `path` is what follows /pages/ on json.edhrec.com — `cards/<slug>` for a card,
// `commanders/<slug>` for a commander's page. Both are the same public JSON
// family and both go through this one queue, so a card lookup and a commander
// lookup can never outrun the rate EDHREC asks for.
async function edhrecRoundTrip(path) {
  await loadEdhrecState();
  // The slot is taken before the wait, not after. Taking it afterwards is what
  // let three callers sleep into the same second and fetch together.
  // One request a second at most. The slot is taken before the wait, not after.
  // Taking it afterwards is what let three callers sleep into the same second
  // and fetch together.
  //
  // The extra 20 ms is deliberate and is not slack for the tests. EDHREC's rule
  // is a ceiling, so erring slow is the right side to err on: a timer that wakes
  // a hair early or a wall clock that steps between two Date.now() calls must
  // never turn "one a second" into "just under one a second".
  const EDHREC_MIN_GAP_MS = 1020;
  for (;;) {
    const now = Date.now();
    const waitUntil = Math.max(edhrecState.nextRequest, edhrecState.heldUntil);
    if (waitUntil <= now) break;
    // Re-read on the way round: a 429 raised while this one slept must hold it
    // back too.
    await new Promise(resolve => setTimeout(resolve, waitUntil - now));
  }
  edhrecState.nextRequest = Date.now() + EDHREC_MIN_GAP_MS;
  saveEdhrecState();

  let response;
  try {
    response = await fetch(`https://json.edhrec.com/pages/${path}.json`,
      { headers: { Accept: 'application/json' }, credentials: 'omit' });
  } catch (error) {
    edhrecPenalty();
    throw error;
  }
  if (response.status === 429) {
    edhrecPenalty();
    throw new Error('EDHREC HTTP 429');
  }
  if (!response.ok) {
    edhrecPenalty();
  } else {
    edhrecState.failures = 0;
  }
  return response;
}

// The bundled tag snapshot ships as upstream wrote it: JavaScript that assigns a
// global. Its value is JSON, so it is read as text and parsed here rather than
// executed -- and rather than being parsed at every worker start through
// importScripts, which cannot be deferred.
const BUNDLED_TAG_FILES = {
  oracle: 'data/oracle-tags.js',
  art1: 'data/illustration-tags-1.js',
  art2: 'data/illustration-tags-2.js'
};

async function loadBundledIndex(part) {
  const response = await fetch(chrome.runtime.getURL(BUNDLED_TAG_FILES[part]));
  if (!response.ok) throw new Error('Bundled tag index unavailable: ' + part);
  const text = await response.text();
  const at = text.indexOf('=');
  if (at === -1) throw new Error('Bundled tag index is not in the expected shape: ' + part);
  return JSON.parse(text.slice(at + 1).trim().replace(/;\s*$/, ''));
}

let tagIndexes = { oracle: null, art1: null, art2: null };
let indexesLoading = null;

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "stk-tags-refresh") refreshIndexes().catch(() => {});
});
// A service worker starts and stops on its own, and some Chromium builds do not
// keep alarms across that. Checking at every start and putting the alarm back is
// what Chrome recommends for one that matters; onInstalled alone only runs on
// install and update.
function ensureRefreshAlarm() {
  if (!chrome.alarms?.get || !chrome.alarms?.create) return;
  chrome.alarms.get("stk-tags-refresh", existing => {
    if (chrome.runtime.lastError || !existing) {
      chrome.alarms.create("stk-tags-refresh", { periodInMinutes: 7 * 24 * 60 });
    }
  });
}
ensureRefreshAlarm();

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("stk-tags-refresh", { periodInMinutes: 7 * 24 * 60 });
  refreshIndexes().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.url?.startsWith("https://scryfall.com/") &&
      !sender.url?.startsWith("https://www.scryfall.com/")) return;
  (async () => {
    if (message.type === "tags") {
      const set = String(message.set || "");
      const number = String(message.number || "");
      if (!/^[a-zA-Z0-9_-]{1,16}$/.test(set) || !/^[a-zA-Z0-9★-]{1,24}$/.test(number)) {
        throw new Error("Invalid card identity");
      }
      const key = `${set}/${number}`;
      if (!cache.has(key)) cache.set(key, fetchTags(set, number));
      try { return await cache.get(key); }
      catch (error) { cache.delete(key); throw error; }
    }
    if (message.type === "card") {
      if (!/^[0-9a-f-]{36}$/.test(String(message.id))) throw new Error("Invalid Scryfall ID");
      return await scryfallJSON(`https://api.scryfall.com/cards/${message.id}`);
    }
    if (message.type === 'digitalSets' || message.type === 'setCategories') {
      const categories = await loadSetCategories();
      return message.type === 'digitalSets' ? categories.digital : categories;
    }
    if (message.type === 'setPlatforms') {
      if (!setPlatformRequest) setPlatformRequest = loadSetPlatforms().finally(() => { setPlatformRequest = null; });
      return await setPlatformRequest;
    }
    if (message.type === "finishes") {
      const ids = message.ids;
      if (!Array.isArray(ids) || ids.length > 75 || ids.some(id => !/^[0-9a-f-]{36}$/.test(String(id)))) {
        throw new Error("Invalid printing IDs");
      }
      const result = await scryfallJSON("https://api.scryfall.com/cards/collection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: ids.map(id => ({ id })) })
      });
      return Object.fromEntries((result.data || []).map(card => [card.id, {
        finishes: card.finishes || [], promoTypes: card.promo_types || []
      }]));
    }
    if (message.type === "cardImages") {
      // Card art and the type line for a set of cards, so the deck editor's
      // panels can show what a card is rather than only what it is called. Same
      // batched collection call the finish column uses, at Scryfall's limit.
      const ids = message.ids;
      if (!Array.isArray(ids) || ids.length > 75 || ids.some(id => !/^[0-9a-f-]{36}$/.test(String(id)))) {
        throw new Error("Invalid card IDs");
      }
      const result = await scryfallJSON("https://api.scryfall.com/cards/collection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: ids.map(id => ({ id })) })
      });
      return (result.data || []).map(card => {
        const image = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || "";
        return {
          id: /^[0-9a-f-]{36}$/.test(card.id || "") ? card.id : "",
          image: /^https:\/\/cards\.scryfall\.io\//.test(image) ? image : "",
          typeLine: String(card.type_line || "").slice(0, 120),
          manaCost: String(card.mana_cost || "").slice(0, 60)
        };
      }).filter(card => card.id);
    }
    if (message.type === 'deckTokens') {
      const entries = message.entries;
      if (!Array.isArray(entries) || entries.length > 150 || entries.some(item =>
        !/^[a-z0-9_-]{1,16}$/i.test(item?.set || '') ||
        !/^[a-z0-9★-]{1,24}$/i.test(item?.collector_number || ''))) throw new Error('Invalid deck cards');
      const collect = async identifiers => {
        const output = [];
        for (let i = 0; i < identifiers.length; i += 75) {
          const result = await scryfallJSON('https://api.scryfall.com/cards/collection', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({identifiers:identifiers.slice(i,i+75)})
          });
          output.push(...(result.data || []));
        }
        return output;
      };
      const cards = await collect(entries);
      const ids = [...new Set(cards.flatMap(card => (card.all_parts || [])
        .filter(part => part.component === 'token' && /^[0-9a-f-]{36}$/.test(part.id || ''))
        .map(part => part.id)))].slice(0,150);
      const tokens = await collect(ids.map(id => ({ id })));
      return tokens.map(token => ({ name:token.name, uri:token.scryfall_uri,
        image:token.image_uris?.normal || token.card_faces?.[0]?.image_uris?.normal }))
        .filter(token => /^https:\/\/scryfall\.com\//.test(token.uri || '') &&
          /^https:\/\/cards\.scryfall\.io\//.test(token.image || ''))
        .sort((a,b) => a.name.localeCompare(b.name));
    }
    if (message.type === 'edhrec' || message.type === 'edhrecCommander') {
      const name = String(message.name || '').trim();
      if (!name || name.length > 180 || /[<>\u0000-\u001f]/.test(name)) throw new Error('Invalid card name');
      const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
        .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (!slug || slug.length > 180) throw new Error('Invalid EDHREC slug');
      const path = (message.type === 'edhrecCommander' ? 'commanders/' : 'cards/') + slug;
      await loadEdhrecState();
      const already = edhrecCached(path);
      if (already) return already.value;
      const promise = (async () => {
        const response = await edhrecFetch(path);
        if (!response.ok) throw new Error(`EDHREC HTTP ${response.status}`);
        const body = await response.json();
        if (message.type === 'edhrecCommander') return edhrecCommanderLists(body);
        const card = body?.container?.json_dict?.card;
        const canonical = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
        if (!card || (canonical(card.name) !== canonical(name) &&
          !card.names?.some(part => canonical(part) === canonical(name)))) throw new Error('EDHREC card mismatch');
        return {
          numDecks: Number.isFinite(card.num_decks) ? card.num_decks : null,
          potentialDecks: Number.isFinite(card.potential_decks) ? card.potential_decks : null,
          salt: Number.isFinite(card.salt) && card.salt >= 0 && card.salt <= 4 ? card.salt : null,
          url: `https://edhrec.com/cards/${slug}`
        };
      })().then(value => {
        // Bounded so the storage entry cannot grow with browsing: the oldest
        // entries go first, and a card is asked for again only after six hours.
        const cache = edhrecState.cache;
        delete cache[path];
        cache[path] = { value, expires: Date.now() + EDHREC_TTL };
        const keys = Object.keys(cache);
        for (let i = 0; i < keys.length - 250; i++) delete cache[keys[i]];
        saveEdhrecState();
        return value;
      });
      return promise;
    }
    if (message.type === "cardIdentity") {
      // A search can be narrowed to the commander's colours, which needs to know
      // what those are. One lookup, through the same Scryfall queue.
      const name = String(message.name || "").trim();
      if (!name || name.length > 120 || /[<>\u0000-\u001f]/.test(name)) throw new Error("Invalid card name");
      const card = await getJSON(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
      const identity = Array.isArray(card.color_identity) ? card.color_identity : [];
      return { colorIdentity: identity.filter(c => /^[wubrg]$/.test(c)).join("") };
    }
    if (message.type === "scryfallSearch") {
      // A search typed into the deck editor. The query is the user's own, but it
      // is still going into a URL and out of this worker, so it is bounded here
      // rather than trusted.
      const query = String(message.query || "").trim();
      const page = Math.min(200, Math.max(1, Number(message.page) || 1));
      if (!query || query.length > 300 || /[<>\u0000-\u001f]/.test(query)) throw new Error("Invalid search query");
      const result = await getJSON(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&page=${page}`
      );
      const cards = (result.data || []).slice(0, 60).map(card => {
        // The same size the EDHREC panel shows. The small one is a thumbnail and
        // reads as blur on a screen where the art is the point.
        const image = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || "";
        return {
          id: /^[0-9a-f-]{36}$/.test(card.id || "") ? card.id : "",
          name: String(card.name || "").slice(0, 120),
          typeLine: String(card.type_line || "").slice(0, 120),
          manaCost: String(card.mana_cost || "").slice(0, 60),
          image: /^https:\/\/cards\.scryfall\.io\//.test(image) ? image : ""
        };
      }).filter(card => card.id);
      return { cards, hasMore: Boolean(result.has_more), page };
    }
    if (message.type === 'cardtrader') {
      const id = String(message.id), set = String(message.set);
      if (!/^[0-9a-f-]{36}$/.test(id) || !/^[a-z0-9_-]{1,16}$/i.test(set)) throw new Error('Invalid card');
      const stored = await chrome.storage.local.get(['cardtraderToken','cardtraderPrices','euroPriceSources']);
      if ((!stored.cardtraderPrices && !['ct','both'].includes(stored.euroPriceSources)) || !stored.cardtraderToken) throw new Error('CardTrader is not configured');
      return cardTraderPrices(id, set, stored.cardtraderToken);
    }
    if (message.type === "preview") {
      if (!/^(oracleid|illustrationid)$/.test(String(message.kind)) ||
          !/^[0-9a-f-]{36}$/.test(String(message.id))) throw new Error("Invalid preview identity");
      const key = `preview:${message.kind}:${message.id}`;
      if (!cache.has(key)) cache.set(key, getJSON(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${message.kind}:${message.id}`)}`
      ).then(result => {
        const card = result.data?.[0];
        const image = card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal;
        const imageURL = image && new URL(image);
        if (imageURL?.protocol !== 'https:' || imageURL.hostname !== "cards.scryfall.io") throw new Error("No preview available");
        const page = card?.scryfall_uri && new URL(card.scryfall_uri);
        if (page?.protocol !== 'https:' || !['scryfall.com','www.scryfall.com'].includes(page.hostname) || !page.pathname.startsWith('/card/')) throw new Error('Invalid card page');
        return { name: card.name, image, uri: page.href };
      }));
      try { return await cache.get(key); }
      catch (error) { cache.delete(key); throw error; }
    }
    if (message.type === 'allPrints') {
      const oracleId = String(message.oracleId || '');
      if (!/^[0-9a-f-]{36}$/i.test(oracleId)) throw new Error('Invalid Oracle ID');
      const key = `allPrints:${oracleId}`;
      if (!cache.has(key)) cache.set(key, (async () => {
        let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${oracleId}`)}&unique=prints&order=released&dir=desc`;
        const prints = [];
        let truncated = false;
        for (let page = 0; page < 8 && url; page++) {
          if (page) await new Promise(resolve => setTimeout(resolve, 120));
          const response = await getJSON(url);
          if (!Array.isArray(response.data)) throw new Error('Invalid print list');
          prints.push(...response.data.map(card => ({
            id: card.id, name: card.name, uri: card.scryfall_uri, set: card.set,
            setName: card.set_name, number: card.collector_number, lang: card.lang,
            digital: card.digital, finishes: card.finishes, prices: card.prices,
            // The row preview reuses the printing's own art, so it needs no
            // extra request once the print list is in.
            image: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null
          })));
          const next = response.has_more && response.next_page ? new URL(response.next_page) : null;
          if (next && (next.protocol !== 'https:' || next.hostname !== 'api.scryfall.com' || next.pathname !== '/cards/search')) throw new Error('Invalid next page');
          url = next?.href || '';
          truncated = Boolean(url);
        }
        return { prints, truncated };
      })());
      try { return await cache.get(key); }
      catch (error) { cache.delete(key); throw error; }
    }
    if (message.type === "query") {
      if (!/^[0-9a-f-]{36}$/.test(String(message.oracleId))) throw new Error("Invalid Oracle ID");
      if (!/^(classic|peak|heritage)$/.test(String(message.format))) throw new Error("Invalid format");
      const override = self.STK_FORMAT_OVERRIDES?.[message.format]?.[message.oracleId];
      if (override) return { legality: override };
      const clauses = {
        classic: "legal:legacy AND date<=roe",
        peak: "legal:legacy AND date<=emn",
        heritage: "(st:core OR st:expansion) AND -atag:external-ip"
      };
      const q = `oracleid:${message.oracleId} AND ${clauses[message.format]}`;
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
      if (response.status === 404) return { legality: "not_legal" };
      if (!response.ok) throw new Error(`Scryfall API: ${response.status}`);
      const result = await response.json();
      return { legality: result.total_cards > 0 ? result.data?.[0]?.legalities?.legacy : "not_legal" };
    }
    throw new Error("Unknown request");
  })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: String(error.message || error) }));
  return true;
});

// Scryfall asks that traffic to api.scryfall.com stay under ten requests a
// second. The extension reached it from several places and two of them paced
// themselves while the rest did not, so the pacing is in one place now: a slot
// every 130 ms, which keeps a burst of card pages well inside that.
let scryfallNextRequest = 0;
async function scryfallJSON(url, options = {}) {
  const wait = Math.max(0, scryfallNextRequest - Date.now());
  scryfallNextRequest = Date.now() + wait + 130;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  return getJSON(url, options);
}

async function getJSON(url, options = {}) {
  // No cookies go out on any of these calls: the extension asks services for
  // data, it does not act as the user on them. Set once here rather than at
  // thirteen call sites, one of which used to forget.
  const response = await fetch(url, { credentials: 'omit', ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function loadSetCategories() {
  if (!digitalSetRequest) digitalSetRequest = (async () => {
    const { digitalSetIndex } = await chrome.storage.local.get('digitalSetIndex');
    if (digitalSetIndex?.categories?.foreignBlackBorder && digitalSetIndex.expires > Date.now()) return digitalSetIndex.categories;
    try {
      const result = await scryfallJSON('https://api.scryfall.com/sets',
        {headers:{Accept:'application/json'},credentials:'omit'});
      if (!Array.isArray(result?.data) || result.has_more) throw new Error('Incomplete set index');
      const categories = {digital:[],nonTournament:[],oversized:[],foreignBlackBorder:[]};
      for (const set of result.data) {
        if (!/^[a-z0-9_-]+$/i.test(set.code || '')) continue;
        const code = set.code.toLowerCase();
        // Oversized memorabilia are a separate preference: they can be
        // useful as Commander display cards even when not sanctioned.
        const oversized = /oversiz/i.test(set.name || '') || /^o(?:cmd|cd|pr|pd)/i.test(code);
        if (set.digital === true) categories.digital.push(code);
        if (/foreign black border/i.test(set.name || '')) categories.foreignBlackBorder.push(code);
        if (oversized) categories.oversized.push(code);
        else if (['memorabilia','minigame','vanguard','token'].includes(set.set_type) ||
          /^(?:30a|cei|ced|wc97|wc98|wc99|wc0[0-4])$/.test(code)) categories.nonTournament.push(code);
      }
      await chrome.storage.local.set({ digitalSetIndex:{ categories, expires:Date.now() + 24 * 3600000 } });
      return categories;
    } catch (error) {
      if (digitalSetIndex?.categories) return digitalSetIndex.categories;
      throw error;
    }
  })().finally(() => { digitalSetRequest = null; });
  return digitalSetRequest;
}

// Scryfall answers 10 requests a second, so a burst of set lookups earns a 429.
// The walk is sequential on purpose: it keeps the platform index cheap without
// ever asking for more than one request at a time.
let setPlatformNextRequest = 0;
async function setPlatformGames(code) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Pacing lives in scryfallJSON now.
    try {
      const result = await getJSON(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`e:${code}`)}&unique=cards&page_size=1`,
        {headers:{Accept:'application/json'},credentials:'omit'});
      const games = Array.isArray(result?.data?.[0]?.games) ? result.data[0].games : [];
      if (games.length) return games;
    } catch (error) {
      // A rate limit or a hiccup is worth one more try; a set that stays
      // unknown is reported as such instead of being guessed at.
    }
    await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
  }
  return null;
}

async function loadSetPlatforms() {
  const { setPlatformIndex } = await chrome.storage.local.get('setPlatformIndex');
  const stale = !setPlatformIndex || setPlatformIndex.expires <= Date.now();
  // The snapshot ages with the cache: a month later every set is asked again
  // in case Scryfall moved a printing to another client.
  const platforms = stale ? { ...bundledSetPlatforms } : { ...bundledSetPlatforms, ...(setPlatformIndex.platforms || {}) };
  let digital;
  try { digital = (await loadSetCategories()).digital; }
  catch (error) {
    if (Object.keys(platforms).length) return platforms;
    throw error;
  }
  const unknown = digital.filter(code => !(code in platforms));
  if (!stale && !unknown.length) return platforms;
  const found = {};
  try {
    for (const code of unknown) {
      const games = await setPlatformGames(code);
      if (games) { found[code] = games; platforms[code] = games; }
    }
  } finally {
    if (Object.keys(found).length) {
      await chrome.storage.local.set({ setPlatformIndex:{ platforms, expires:Date.now() + 30 * 24 * 3600000 } }).catch(() => {});
    }
  }
  return platforms;
}

async function fetchTags(set, number) {
  await loadStoredIndexes();
  const cardRequest = scryfallJSON(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`)
    .then(card => ({ card }), error => ({ error }));
  let live = null;
  // Tagger exposes relationship edges that are absent from the bulk tag files.
  try {
    const response = await getJSON(
      `https://tagger.scryfall.com/graphql/registry?name=shambleshark_card_edges&set=${encodeURIComponent(set)}&number=${encodeURIComponent(number)}`,
      { method: "POST", headers: { Accept: "application/json" }, credentials: "omit" }
    );
    if (Array.isArray(response?.data?.card?.edges)) live = parseTaggerCard(response.data.card);
  } catch { /* Keep the bundled index usable if Tagger changes or is unavailable. */ }
  const { card, error } = await cardRequest;
  if (error) throw error;
  const illustrationId = card.illustration_id || card.card_faces?.[0]?.illustration_id;
  const bundled = {
    card: lookup(tagIndexes.oracle, card.oracle_id),
    art: [...lookup(tagIndexes.art1, illustrationId), ...lookup(tagIndexes.art2, illustrationId)]
  };
  if (!live) return { ...bundled, fallback: true };
  for (const kind of ["card", "art"]) {
    const known = new Set(live[kind].filter(item => !item.relation).map(item => item.slug));
    for (const item of bundled[kind]) {
      if (!known.has(item.slug)) { live[kind].push(item); known.add(item.slug); }
    }
  }
  return live;
}

function parseTaggerCard(card) {
  const result = { card: [], art: [], fallback: false };
  const tagKinds = { ORACLE_CARD_TAG: "card", ILLUSTRATION_TAG: "art", PRINTING_TAG: "art" };
  for (const edge of card.edges) {
    if (edge?.__typename === "Tagging" && edge.tag) {
      const kind = tagKinds[edge.tag.type];
      if (!kind || !edge.tag.name || !edge.tag.slug) continue;
      result[kind].push({ name: edge.tag.name, slug: edge.tag.slug, tagType: edge.tag.type });
    } else if (edge?.__typename === "Relationship") {
      const kind = edge.foreignKey === "oracleId" ? "card" : edge.foreignKey === "illustrationId" ? "art" : null;
      if (!kind) continue;
      const reverse = card[edge.foreignKey] === edge.relatedId;
      const name = reverse ? edge.subjectName : edge.relatedName;
      const targetId = reverse ? edge.subjectId : edge.relatedId;
      // Label the relationship from the card currently being viewed. Tagger's
      // edge classifier describes the opposite endpoint in this payload.
      const type = reverse ? edge.classifierInverse : edge.classifier;
      if (!name || !/^[0-9a-f-]{36}$/.test(String(targetId))) continue;
      result[kind].push({ name, targetId, tagType: type, relation: true, targetKind: kind });
    }
  }
  return result;
}

function lookup(compact, id) {
  if (!compact || !id) return [];
  return (compact.d[id] || []).map(i => ({ name: compact.t[i], slug: compact.t[i] }));
}

async function loadStoredIndexes() {
  if (!indexesLoading) {
    indexesLoading = (async () => {
      const stored = await chrome.storage.local.get("tagIndexes");
      const saved = stored.tagIndexes;
      if (saved?.oracle && saved?.art1 && saved?.art2) {
        tagIndexes = saved;
        return;
      }
      // Nothing fresher in storage: read the bundled snapshot. This is the only
      // place it is paid for, and a tag lookup is the only thing that needs it.
      const [oracle, art1, art2] = await Promise.all([
        loadBundledIndex('oracle'), loadBundledIndex('art1'), loadBundledIndex('art2')
      ]);
      tagIndexes = { oracle, art1, art2 };
    })().catch(error => { indexesLoading = null; throw error; });
  }
  await indexesLoading;
}

function compact(tags, idKey) {
  const labels = [];
  const labelIds = new Map();
  const byId = {};
  for (const tag of tags) {
    const label = tag?.slug || tag?.label || tag?.name;
    const ids = Array.isArray(tag?.taggings)
      ? tag.taggings.map(tagging => tagging[idKey]).filter(Boolean)
      : tag?.[idKey === "oracle_id" ? "oracle_ids" : "illustration_ids"];
    if (!label || !Array.isArray(ids)) continue;
    let tagId = labelIds.get(label);
    if (tagId === undefined) { tagId = labels.length; labels.push(label); labelIds.set(label, tagId); }
    for (const id of ids) (byId[id] ||= []).push(tagId);
  }
  return { t: labels, d: byId };
}

async function refreshIndexes() {
  const headers = { Accept: "application/json" };
  // Download URIs are read from Scryfall's documented public bulk-data API.
  const [oracleMeta, artMeta] = await Promise.all([
    scryfallJSON("https://api.scryfall.com/bulk-data/oracle_tags", { headers }),
    scryfallJSON("https://api.scryfall.com/bulk-data/art_tags", { headers })
  ]);
  const download = async metadata => {
    const uri = new URL(metadata.download_uri);
    if (uri.protocol !== "https:" || uri.hostname !== "data.scryfall.io") throw new Error("Unexpected tag download host");
    return getJSON(uri.href, { headers });
  };
  const [oracle, art] = await Promise.all([download(oracleMeta), download(artMeta)]);
  if (!Array.isArray(oracle) || !Array.isArray(art)) throw new Error("Invalid tag data");
  const oracleCompact = compact(oracle, "oracle_id");
  const artCompact = compact(art, "illustration_id");
  if (Object.keys(oracleCompact.d).length < 100 || Object.keys(artCompact.d).length < 100) {
    throw new Error("Incomplete tag index");
  }
  const entries = Object.entries(artCompact.d);
  const middle = Math.ceil(entries.length / 2);
  const next = {
    oracle: oracleCompact,
    art1: { t: artCompact.t, d: Object.fromEntries(entries.slice(0, middle)) },
    art2: { t: artCompact.t, d: Object.fromEntries(entries.slice(middle)) }
  };
  await chrome.storage.local.set({ tagIndexes: next });
  tagIndexes = next;
  cache.clear();
}
