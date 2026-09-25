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

const ROOT = __dirname;

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

  const chrome = {
    runtime,
    storage: { local, sync: local, onChanged: { addListener: fn => changeListeners.push(fn) } },
    alarms: { create() {}, onAlarm: { addListener: fn => alarmListeners.push(fn) } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    tabs: { sendMessage() {}, onUpdated: { addListener() {} } }
  };

  return {
    chrome, state, sentMessages, clipboardWrites, openOptionsPageCalls,
    messageListeners, installedListeners, alarmListeners, changeListeners, fireChanges
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
    navigator: { clipboard: { writeText: text => { mock.clipboardWrites.push(text); return Promise.resolve(); } } },
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

  return {
    window: context,
    document,
    location,
    chrome: mock.chrome,
    mock,
    context,
    script(file) {
      const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return vm.runInContext(code, context, { filename: file });
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

module.exports = {
  ROOT,
  assert,
  assertEqual,
  summary,
  sleep,
  waitFor,
  createChrome,
  createPage,
  click,
  keyDown,
  fireEvent,
  dataTransferObject
};
