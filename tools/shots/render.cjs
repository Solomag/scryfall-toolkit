// Rendering a page of this project to a PNG, by driving the browser that is
// already installed rather than by adding a renderer as a dependency.
//
// Chrome's command line is not enough here. `--screenshot` captures the window it
// is given, so a page taller than the window is cut off and a page shorter than it
// is padded with background; `--dump-dom`, which would let a page report its own
// height, produces nothing at all in current Chrome. What is left is the debugging
// protocol, which Node can speak on its own: WebSocket and fetch are both built in.
//
// That buys three things the command line does not have, and each is needed:
//
//   the document's real height, so a full-page shot is not cut off and not padded;
//   the box of a single element, so an illustration is a crop of one panel rather
//   than a picture of a page with the panel somewhere in it;
//   a promise of "the page has finished", so the shot is not of a half-built DOM.
//
// The chrome.* surface these pages use is stubbed. An extension page is given
// storage, permissions and tabs by the browser, and a file:// page is given
// nothing, so the stub is what makes the real page renderable at all. It answers
// with empty storage, which is the state a profile that has never opened the
// settings page is in, and so every section is at its default.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..') + path.sep;

// STK_CHROME overrides the search, for a machine where the browser is elsewhere.
function findChrome() {
  if (process.env.STK_CHROME && fs.existsSync(process.env.STK_CHROME)) return process.env.STK_CHROME;
  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium'
  ];
  for (const candidate of candidates) if (candidate && fs.existsSync(candidate)) return candidate;
  console.error('no Chrome, Edge or Chromium found, so nothing can be rendered.');
  console.error('  set STK_CHROME to the browser and run this again');
  process.exit(1);
}

function fileUrl(file) {
  return 'file:///' + path.resolve(file).split(path.sep).join('/');
}

// Only what the pages actually call.
//
// storage.local.get is the part that has to be right. In the browser the keys it
// is given carry the values to use when nothing is stored, so on a fresh profile it
// answers with those defaults. A stub that answers with an empty object makes the
// page render in a state no user ever sees: every feature off, every sub-setting
// greyed out, every select blank. It is a plausible-looking picture of the settings
// page and it is not the settings page a reader will get.
const STUB = (seed = {}) => `
// The chrome.* surface these pages use, standing in for the one an extension page
// is given. Injected only for rendering; never shipped.
(function () {
  var stored = ${JSON.stringify(seed)};
  function keysOf(arg) {
    if (Array.isArray(arg)) {
      var out = {};
      arg.forEach(function (key) { out[key] = undefined; });
      return out;
    }
    return (arg && typeof arg === 'object') ? Object.assign({}, arg) : {};
  }
  window.chrome = {
    storage: {
      local: {
        get(arg, callback) {
          var fallback = keysOf(arg);
          var out = {};
          Object.keys(fallback).forEach(function (key) {
            out[key] = key in stored ? stored[key] : fallback[key];
          });
          if (typeof callback === 'function') { callback(out); return; }
          return Promise.resolve(out);
        },
        set(items, callback) {
          Object.assign(stored, items);
          if (callback) callback();
          return Promise.resolve();
        },
        remove(key, callback) {
          delete stored[key];
          if (callback) callback();
          return Promise.resolve();
        }
      }
    },
    permissions: {
      contains(request, callback) { callback(false); },
      request(request, callback) { callback(false); }
    },
    tabs: { getCurrent(callback) { callback({ id: 1 }); } },
    runtime: {
      openOptionsPage() {},
      getURL(file) { return file; },
      getManifest() { return { version: '0' }; },
      lastError: null
    }
  };
})();
`;

// Copies a page out of the project so it can be rendered, with its relative
// references made absolute and the stub in front of its own scripts. The page
// itself is not edited, so what is rendered is what ships.
//
// `storage` is what the page finds already in the extension's storage, which is the only
// way to choose a starting state: the settings page is Russian or English according to a
// stored language, and it picks one by itself from the browser otherwise. A picture of
// the settings page in a language nobody asked for is a picture of the wrong page.
function copyPage(pageFile, outFile, { stub = null, css = [], storage = {} } = {}) {
  const dir = path.dirname(pageFile);
  let html = fs.readFileSync(pageFile, 'utf8');

  const absolute = reference => {
    if (/^(?:[a-z]+:)?\/\//i.test(reference) || reference.startsWith('#') || reference.startsWith('data:')) {
      return reference;
    }
    return fileUrl(path.resolve(dir, reference));
  };
  html = html.replace(/(src|href)="([^"]+)"/g, (match, attribute, reference) =>
    attribute + '="' + absolute(reference) + '"');
  for (const sheet of css) {
    html = html.replace('</head>',
      '<link rel="stylesheet" href="' + fileUrl(path.resolve(ROOT, sheet)) + '"></head>');
  }
  const script = '<script>' + (stub || STUB(storage)) + '</script>';
  html = html.includes('</head>') ? html.replace('</head>', script + '</head>') : script + html;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  return outFile;
}

// --- the browser session ------------------------------------------------------

// One browser, many pages. Launching per shot costs about a second each and adds
// up, and the profile is what makes the port discoverable: Chrome writes it there.
//
// There is no way to load this extension into this browser, which is worth saying
// here because it was tried. Stable Chrome 154 refuses --load-extension outright:
// headless or not, in front of an offscreen window, with --enable-unsafe-extension-
// debugging or with the removal feature flag turned off. The extension simply never
// appears among the targets. So a shot cannot be a picture of the extension on
// scryfall.com from here, and the data in it comes from Scryfall and Tagger instead.
// An option that accepts an extension path is therefore deliberately absent: it
// would launch a browser without the extension and photograph our panels anyway,
// which is the quiet failure this project keeps running into.
class Session {
  constructor() {
    this.chrome = findChrome();
    this.dir = path.join(os.tmpdir(), 'stk-shot-profile-' + process.pid);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.child = spawn(this.chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--remote-debugging-port=0',
      '--user-data-dir=' + this.dir,
      'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    this.nextId = 1;
    this.waiting = new Map();
    this.events = [];
  }

  async port() {
    const file = path.join(this.dir, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 100; attempt++) {
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        if (text[0] && text[0].trim()) return Number(text[0].trim());
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('the browser never wrote its debugging port');
  }

  async open() {
    const port = await this.port();
    // The target that is already open, rather than asking for a new one: newer
    // Chrome requires PUT for /json/new and refuses GET.
    let target = null;
    for (let attempt = 0; attempt < 40 && !target; attempt++) {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      target = list.find(entry => entry.type === 'page' && entry.webSocketDebuggerUrl);
      if (!target) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!target) throw new Error('the browser offered no page to drive');

    this.socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.waiting.has(message.id)) {
        const { resolve, reject } = this.waiting.get(message.id);
        this.waiting.delete(message.id);
        if (message.error) reject(new Error(message.method + ': ' + message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  // Navigates, waits for load, then gives the page a moment to settle: these pages
  // build their contents in script after the load event, and a shot taken at load
  // is a shot of an empty section.
  async open_(file, { width = 1280, height = 900 } = {}) {
    this.events.length = 0;
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false
    });
    await this.send('Page.navigate', { url: fileUrl(file) });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (this.events.some(e => e.method === 'Page.loadEventFired')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await new Promise(resolve => setTimeout(resolve, 600));
    return this;
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error('the page threw while measuring: ' +
        (result.exceptionDetails.exception || {}).description);
    }
    return result.result.value;
  }

  async fullHeight() {
    return this.evaluate(
      'Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)');
  }

  // The box of an element, in document coordinates, so it can be clipped.
  async boxOf(selector) {
    return this.evaluate(`(function () {
      var el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    })()`);
  }

  // A shot. Without a clip the browser captures the viewport, which is whatever
  // height was asked for — so a page taller than that is cut off at the bottom and
  // one shorter is padded with its own background. A clip of the whole document,
  // with captureBeyondViewport, is what makes the picture match the page.
  async shoot(outPng, { clip = null, width = 1280, height = 900, scale = 1 } = {}) {
    const params = { format: 'png' };
    if (clip) {
      params.clip = { ...clip, scale };
      params.captureBeyondViewport = true;
    }
    const shot = await this.send('Page.captureScreenshot', params);
    fs.mkdirSync(path.dirname(outPng), { recursive: true });
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
    return { file: outPng, bytes: fs.statSync(outPng).size, clip: clip || { width, height } };
  }

  // The whole document, as tall as it is.
  async shootWholePage(outPng, { width = 1280 } = {}) {
    const height = await this.fullHeight();
    return this.shoot(outPng, { clip: { x: 0, y: 0, width, height, scale: 1 } });
  }


  close() {
    try { this.socket && this.socket.close(); } catch (error) { /* already gone */ }
    // Chrome keeps the profile locked for a moment after it is told to stop, and
    // a temporary folder that outlives the run is not worth failing over.
    try { this.child.kill(); } catch (error) { /* already gone */ }
    try { fs.rmSync(this.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch (error) { /* the operating system will have it */ }
  }
}

// Reads a PNG's dimensions out of its header, so a caller can check what it got
// rather than trusting the browser.
function sizeOf(png) {
  const head = fs.readFileSync(png).subarray(0, 24);
  if (head.readUInt32BE(0) !== 0x89504e47) throw new Error(png + ' is not a PNG');
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

module.exports = { ROOT, findChrome, copyPage, Session, sizeOf, STUB, fileUrl };
