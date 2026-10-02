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
'use strict';
// Shared mocks and helpers for the extension tests.
// The extension scripts are plain browser/service-worker scripts, so they are
// executed in a vm context over a linkedom document with a chrome mock.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

// The project root, one folder up. These files used to sit in it.
const ROOT = path.join(__dirname, '..') + path.sep;

// Surface async failures instead of letting them vanish between polls.
process.on('unhandledRejection', error => {
  console.error('UNHANDLED REJECTION:', error);
});

let passed = 0;

function assert(condition, label) {
  if (!condition) {
    process.exitCode = 1;
    console.error(`  FAIL: ${label}`);
    throw new Error(label);
  }
  passed += 1;
  console.log(`  ok: ${label}`);
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${label} — expected ${e}, got ${a}`);
}

function summary(name) {
  console.log(`${name}: ${passed} assertions passed`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(check, label, timeout = 3000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let value;
    try { value = check(); } catch { value = undefined; }
    if (value) return value;
    if (Date.now() > deadline) {
      process.exitCode = 1;
      throw new Error(`timeout waiting for ${label}`);
    }
    await sleep(10);
  }
}

function createChrome(options = {}) {
  const state = options.state || {};
  const routes = options.routes || {};
  const changeListeners = [];
  const messageListeners = [];
  const installedListeners = [];
  const alarmListeners = [];
  const sentMessages = [];
  const clipboardWrites = [];
  const openOptionsPageCalls = [];

  const normalize = keys => {
    if (keys == null) return { ...state };
    if (typeof keys === 'string') return keys in state ? { [keys]: state[keys] } : {};
    if (Array.isArray(keys)) {
      const picked = {};
      for (const key of keys) if (key in state) picked[key] = state[key];
      return picked;
    }
    const picked = { ...keys };
    for (const key of Object.keys(keys)) if (key in state) picked[key] = state[key];
    return picked;
  };

  function fireChanges(changes) {
    for (const listener of changeListeners) {
      try { listener(changes, 'local'); } catch (error) { console.error(error); }
    }
  }

  const local = {
    get(keys, callback) {
      const result = normalize(keys);
      if (typeof callback === 'function') { callback(result); return undefined; }
      return Promise.resolve(result);
    },
    set(items, callback) {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: state[key], newValue: value };
        state[key] = value;
      }
      fireChanges(changes);
      if (typeof callback === 'function') { callback(); return undefined; }
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key];
      if (typeof callback === 'function') { callback(); return undefined; }
      return Promise.resolve();
    },
    clear(callback) {
      for (const key of Object.keys(state)) delete state[key];
      if (typeof callback === 'function') { callback(); return undefined; }
      return Promise.resolve();
    }
  };

  const runtime = {
    lastError: undefined,
    getURL: resource => `chrome-extension://scryfall-toolkit/${resource}`,
    openOptionsPage() { openOptionsPageCalls.push(true); return Promise.resolve(); },
    sendMessage(message, callback) {
      sentMessages.push(message);
      const route = routes[message.type];
      Promise.resolve()
        .then(() => {
          if (!route) throw new Error(`Unhandled message type: ${message.type}`);
          return route(message);
        })
        .then(
          data => callback({ ok: true, data }),
          error => callback({ ok: false, error: (error && error.message) || String(error) })
        );
    },
    onMessage: { addListener: fn => messageListeners.push(fn) },
    onInstalled: { addListener: fn => installedListeners.push(fn) },
    connect: () => ({ onDisconnect: { addListener() {} }, onMessage: { addListener() {} } })
  };

  // EDHREC and CardTrader take optional host permissions, granted when the user
  // turns them on. Set deny to watch what happens when it is refused.
  const permissions = {
    grantedOrigins: [],
    deny: false,
    // When set, the browser refuses the question outright — which is what Chrome does
    // to a permission request made outside a user gesture.
    refuseWith: null,
    // Refusals the code under test did not look at. Real Chrome prints each of these
    // as "Unchecked runtime.lastError", which is the line a reader sees in the console
    // and the reason this is recorded rather than merely returned.
    unchecked: [],
    requestCount: 0,
    request(options, callback) {
      permissions.requestCount = (permissions.requestCount || 0) + 1;
      const refusal = permissions.refuseWith;
      const granted = refusal ? false : permissions.deny !== true;
      if (granted) permissions.grantedOrigins.push(...(options.origins || []));

      // The error is delivered by assignment and taken by reading — so whether it was
      // read is observable, and nothing else can tell.
      let read = false;
      chrome.__lastError = refusal ? { message: refusal } : undefined;
      Object.defineProperty(chrome.runtime, 'lastError', {
        configurable: true,
        get() { read = true; return chrome.__lastError; },
        set(value) { chrome.__lastError = value; },
        enumerable: true
      });

      const done = typeof callback === 'function' ? callback : null;
      if (done) {
        done(granted);
        if (refusal && !read) permissions.unchecked.push(refusal);
        chrome.__lastError = undefined;
        return undefined;
      }
      // No callback: nothing can read the error, which is the other way to get an
      // unchecked one, and it is recorded as such.
      if (refusal) permissions.unchecked.push(refusal);
      return Promise.resolve(granted);
    },
    contains(options, callback) {
      const wanted = options.origins || [];
      const has = wanted.every(origin => permissions.grantedOrigins.includes(origin));
      if (typeof callback === 'function') { callback(has); return undefined; }
      return Promise.resolve(has);
    },
    remove(options, callback) {
      for (const origin of (options.origins || [])) {
        const at = permissions.grantedOrigins.indexOf(origin);
        if (at >= 0) permissions.grantedOrigins.splice(at, 1);
      }
      if (typeof callback === 'function') { callback(); return undefined; }
      return Promise.resolve();
    }
  };

  const chrome = {
    runtime,
    permissions,
    storage: { local, sync: local, onChanged: { addListener: fn => changeListeners.push(fn) } },
    alarms: { create() {}, onAlarm: { addListener: fn => alarmListeners.push(fn) } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    tabs: { sendMessage() {}, onUpdated: { addListener() {} } }
  };

  return {
    chrome, state, sentMessages, clipboardWrites, openOptionsPageCalls,
    messageListeners, installedListeners, alarmListeners, changeListeners, fireChanges,
    permissions
  };
}

function createLocalStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { for (const key of Object.keys(store)) delete store[key]; },
    store
  };
}

function createPage(options) {
  const url = options.url;
  const mock = options.mock || createChrome({ state: options.state, routes: options.routes });
  const { window, document } = parseHTML(options.html);
  // linkedom parses a <dialog> but gives the element no modal behaviour, so a page
  // that opens one throws a TypeError on the click. Patched here rather than through
  // the context's HTMLDialogElement, because the element was already built by the
  // parser and a class in the context does not reach it. The attribute stands in for
  // the state a browser tracks in the element itself, so `open` reads back.
  for (const dialog of document.querySelectorAll('dialog')) {
    if (typeof dialog.showModal === 'function') continue;
    dialog.showModal = function () { dialog.setAttribute('open', ''); };
    dialog.close = function () { dialog.removeAttribute('open'); };
  }

  // linkedom has no HTMLSelectElement.value. Every settings handler reads it, so
  // without this a test cannot drive a select at all.
  for (const select of document.querySelectorAll('select')) {
    const choices = () => [...select.querySelectorAll('option')];
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() {
        const chosen = choices().find(o => o.hasAttribute('selected')) || choices()[0];
        return chosen ? chosen.getAttribute('value') : '';
      },
      set(next) {
        for (const option of choices()) {
          if (option.getAttribute('value') === String(next)) option.setAttribute('selected', '');
          else option.removeAttribute('selected');
        }
      }
    });
  }
  // linkedom has no layout: scripts only need a stable rectangle.
  window.Element.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const location = {
    href: url,
    origin: new URL(url).origin,
    protocol: new URL(url).protocol,
    host: new URL(url).host,
    hostname: new URL(url).hostname,
    pathname: new URL(url).pathname,
    search: new URL(url).search,
    assigned: [],
    assign(target) { location.assigned.push(target); }
  };
  const confirmQueue = options.confirmQueue || [];
  const observers = [];
  // Listeners the page registers on its own window, by event type.
  const windowListeners = {};
  // A test can ask the page about the system colour scheme and then flip it,
  // the way a computer or phone switches its own appearance at dusk.
  const mediaListeners = {};
  // linkedom does not run observers, so a test can ask for a small working one
  // to prove that late DOM changes are handled.
  const liveObserver = options.mutationObserver ? class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(node, config = {}) { this.targets.push({ node, config }); }
    disconnect() { this.targets = []; }
    takeRecords() { return []; }
  } : class { observe() {} disconnect() {} takeRecords() { return []; } };
  const context = {
    console,
    URL,
    URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    document,
    location,
    chrome: mock.chrome,
    // The settings language follows the browser. Tests run as a Russian browser
    // so the Russian interface is exercised; resolveSettingsLanguage is checked
    // against other languages separately.
    navigator: { language: 'ru-RU', languages: ['ru-RU', 'ru', 'en-US'], clipboard: { writeText: text => { mock.clipboardWrites.push(text); return Promise.resolve(); } } },
    localStorage: createLocalStorage(options.localStorage),
    confirm: () => (confirmQueue.length ? confirmQueue.shift() : true),
    MutationObserver: liveObserver,
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    getComputedStyle: () => ({ color: 'rgb(99, 68, 150)', backgroundColor: 'rgba(0, 0, 0, 0)', getPropertyValue: () => '' }),
    matchMedia: query => mediaListeners[query] = {
      media: query,
      matches: query.includes('dark') ? Boolean(options.mediaDark) : true,
      listeners: {},
      addEventListener: (type, listener) => { (mediaListeners[query].listeners[type] ||= []).push(listener); },
      removeEventListener: () => {},
      dispatch(type) { for (const listener of mediaListeners[query].listeners[type] || []) listener(); }
    },
    innerWidth: 1280,
    innerHeight: 900,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    // linkedom has no window-level event target, and the theme listens for the
    // load event to know Scryfall's stylesheet has arrived. A test fires it here.
    addEventListener: (type, listener) => { (windowListeners[type] ||= []).push(listener); },
    removeEventListener: (type, listener) => {
      windowListeners[type] = (windowListeners[type] || []).filter(entry => entry !== listener);
    },
    // linkedom has no window-level message port either. The deck features talk
    // to the page world through postMessage, so a stand-in delivers to the
    // registered listeners from this window. A real window queues these as
    // tasks; delivering straight away is close enough for what is checked.
    postMessage: data => {
      for (const listener of windowListeners.message || []) listener({ source: context, data });
    },
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    HTMLInputElement: window.HTMLInputElement,
    fetch: options.fetch || (() => { throw new Error('Unexpected fetch'); })
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);

  const loadedScripts = new Set();

  return {
    window: context,
    document,
    location,
    chrome: mock.chrome,
    mock,
    context,
    // Loading the same file twice is a no-op rather than a second run.
    //
    // The callers below load some scripts themselves and then ask cardPage() for the
    // manifest's list, and the manifest's list is the whole point of cardPage(). Making
    // this idempotent is what lets it be the whole list instead of a filtered one:
    // a filter is a place for a newly added file to be left out, and the one time that
    // happened here a module the card page needed went missing from every test and the
    // only symptom was a TypeError about an undefined property.
    script(file) {
      if (loadedScripts.has(file)) return undefined;
      loadedScripts.add(file);
      const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return vm.runInContext(code, context, { filename: file });
    },
    // The card page's own scripts, in the order the manifest lists them, which is
    // what a browser injects them in.
    //
    // These used to be one file called content.js. They are eleven now, and a test
    // that loaded one of them alone would be testing that file in isolation and
    // calling it the page — which is how a whole class of "works on its own"
    // passes hides a feature that does not work next to the others. So the list
    // comes from the manifest: add a file there and every test here runs it.
    //
    // The whole list, not the src/card-page/ part of it. A content-script group mixes
    // card-page features with shared modules that live in src/core/, and filtering by
    // prefix is what kept a newly added shared module out of every test.
    async cardPage() {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      const group = (manifest.content_scripts || []).find(entry =>
        (entry.js || []).some(file => file.startsWith('src/card-page/')));
      if (!group) throw new Error('the manifest lists no src/card-page/ scripts');
      // script() skips what has already run, so the callers that load i18n and the
      // catalogs themselves first are not run twice and the manifest order still holds.
      for (const file of group.js) await this.script(file);
      return group.js;
    },
    // Delivers one childList batch to every observer the page registered, which
    // is what a real DOM does after the test changed something.
    flushObservers() {
      const record = [{ type: 'childList', addedNodes: [], removedNodes: [] }];
      for (const observer of observers) {
        if (observer.targets.length) observer.callback(record, observer);
      }
    },
    // Turns the emulated system scheme over and tells the page about it.
    setSystemDark(dark) {
      const entry = mediaListeners['(prefers-color-scheme: dark)'];
      if (!entry) return;
      entry.matches = Boolean(dark);
      entry.dispatch('change');
    },
    // Tells the page its window fired an event, the way a finished page does.
    fireWindow(type) {
      for (const listener of [...(windowListeners[type] || [])]) listener({ type });
    },
    // How many colours the page's own listeners can still be waiting on.
    windowListenerCount(type) { return (windowListeners[type] || []).length; }
  };
}

function eventFor(target, type, extra = {}) {
  const view = target.ownerDocument && target.ownerDocument.defaultView;
  const EventCtor = (view && view.Event) || globalThis.Event;
  const event = new EventCtor(type, { bubbles: true, cancelable: true });
  event.button = 0;
  event.ctrlKey = false;
  event.metaKey = false;
  event.shiftKey = false;
  event.altKey = false;
  for (const [key, value] of Object.entries(extra)) event[key] = value;
  return event;
}

function click(target, extra = {}) {
  const event = eventFor(target, 'click', extra);
  target.dispatchEvent(event);
  return event;
}

function keyDown(target, key) {
  const event = eventFor(target, 'keydown', { key });
  target.dispatchEvent(event);
  return event;
}

function fireEvent(target, type, extra = {}) {
  const event = eventFor(target, type, extra);
  target.dispatchEvent(event);
  return event;
}

function dataTransferObject() {
  const store = {};
  return {
    effectAllowed: '',
    dropEffect: '',
    setData(type, value) { store[type] = value; },
    getData(type) { return store[type] || ''; },
    store
  };
}

// The dark theme as one stylesheet, in the order a browser loads it: the parts
// the manifest lists, in the order it lists them.
//
// It is seven files. A check that read one of them would be checking a page of the
// theme and calling it the theme, which is the quiet half-check this project has
// been bitten by more than once — the card page was split into eleven scripts and a
// test went on loading nine of them.
//
// The list comes from the manifest for the same reason cardPage() takes its list
// from there: a part that is written and not listed loads nothing at all, and
// nothing anywhere would say so.
function themeCss() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const group = (manifest.content_scripts || []).find(entry =>
    (entry.css || []).some(file => file.startsWith('src/styles/theme/')));
  if (!group) throw new Error('the manifest lists no src/styles/theme/ stylesheets');
  const files = group.css.filter(file => file.startsWith('src/styles/theme/'));
  return {
    files,
    text: files.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n')
  };
}

module.exports = {
  ROOT,
  assert,
  assertEqual,
  summary,
  sleep,
  waitFor,
  createChrome,
  createPage,
  themeCss,
  click,
  keyDown,
  fireEvent,
  dataTransferObject
};
