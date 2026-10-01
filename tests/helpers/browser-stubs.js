"use strict";
/**
 * Minimal, deterministic browser surface for running docs/scripts/*.js under node:vm.
 *
 * Deliberately hand-written instead of jsdom: the production scripts only touch a
 * small slice of the DOM, and a hand-rolled stub keeps the core suite at ZERO
 * dependencies (see tests/README.md).
 */

function createElementStub(id) {
  const el = {
    id: id || "",
    tagName: "DIV",
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    checked: false,
    dataset: {},
    style: {},
    children: [],
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      toggle(c, force) {
        const on = force === undefined ? !this._set.has(c) : !!force;
        if (on) this._set.add(c); else this._set.delete(c);
        return on;
      },
      contains(c) { return this._set.has(c); }
    },
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      (this._listeners[evt && evt.type] || []).forEach(fn => fn.call(this, evt));
      return true;
    },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] === undefined ? null : this[k]; },
    removeAttribute(k) { delete this[k]; },
    focus() {}, blur() {}, click() { this.dispatchEvent({ type: "click", target: this }); },
    scrollIntoView() {}, closest() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  };
  return el;
}

function createLocalStorage(seed) {
  const store = new Map(Object.entries(seed || {}));
  return {
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] ?? null; },
    getItem(k) { return store.has(String(k)) ? store.get(String(k)) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); },
    _dump() { return Object.fromEntries(store); }
  };
}

/**
 * @param {object} opts
 * @param {boolean} [opts.serviceWorker=false] expose navigator.serviceWorker. The
 *        app registers a SW at top level, so the default is OFF to keep loading
 *        side-effect free; the PWA test flips it ON on purpose.
 * @param {string}  [opts.hash=""] initial location.hash (drives getInitialTab()).
 * @param {object}  [opts.storage] seed values for localStorage.
 */
function createBrowserStubs(opts = {}) {
  const calls = { fetch: [], swRegister: [], intervals: [], timeouts: [], warn: [], error: [] };
  const elements = new Map();

  const location = {
    href: "https://vajrang-b.github.io/bharatbazar/",
    origin: "https://vajrang-b.github.io",
    pathname: "/bharatbazar/",
    hostname: "vajrang-b.github.io",
    protocol: "https:",
    search: "",
    hash: opts.hash || "",
    reload() {}, assign() {}, replace() {}
  };

  const document = {
    _listeners: {},
    readyState: "loading",
    title: "Bharath Bazar",
    documentElement: createElementStub("html"),
    body: createElementStub("body"),
    cookie: "",
    visibilityState: "visible",
    hidden: false,
    getElementById(id) { return elements.has(id) ? elements.get(id) : null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByClassName() { return []; },
    createElement(tag) { const e = createElementStub(""); e.tagName = String(tag).toUpperCase(); return e; },
    createDocumentFragment() { return createElementStub(""); },
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      (this._listeners[evt && evt.type] || []).forEach(fn => fn.call(this, evt));
      return true;
    }
  };

  const navigator = {
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    language: "en-US",
    languages: ["en-US"],
    platform: "Linux armv8l",
    onLine: true,
    hardwareConcurrency: 8,
    maxTouchPoints: 5,
    sendBeacon() { return true; },
    clipboard: { writeText: async () => {} }
  };

  if (opts.serviceWorker) {
    navigator.serviceWorker = {
      _listeners: {},
      controller: null,
      register(path) {
        calls.swRegister.push(path);
        return Promise.resolve({ scope: "/bharatbazar/", update() {} });
      },
      addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
    };
  }

  const win = {
    location,
    document,
    navigator,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    scrollY: 0,
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] || []).filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      (this._listeners[evt && evt.type] || []).forEach(fn => fn.call(this, evt));
      return true;
    },
    matchMedia(q) { return { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
    getComputedStyle() { return { getPropertyValue: () => "" }; },
    scrollTo() {}, open() { return null; }, alert() {}, confirm() { return true; }, prompt() { return null; },
    requestAnimationFrame(fn) { return setTimeout(() => fn(Date.now()), 0); },
    cancelAnimationFrame(h) { clearTimeout(h); }
  };

  const quietConsole = {
    log() {},
    info() {},
    debug() {},
    warn(...a) { calls.warn.push(a); },
    error(...a) { calls.error.push(a); }
  };

  const sandbox = {
    window: win,
    self: win,
    globalThis: undefined, // replaced by vm.createContext
    document,
    navigator,
    location,
    screen: { width: 390, height: 844, colorDepth: 24, availWidth: 390, availHeight: 844 },
    localStorage: createLocalStorage(opts.storage),
    sessionStorage: createLocalStorage(),
    console: opts.console === "passthrough" ? console : quietConsole,
    fetch: async (url) => { calls.fetch.push(String(url)); return { ok: false, status: 404, async text() { return ""; }, async json() { return {}; } }; },
    // Timers are recorded rather than actually scheduled: the app sets a 5-minute
    // SW update interval and a 300ms focus timeout at load, neither of which
    // should keep the test process alive.
    setTimeout: (fn, ms, ...a) => { calls.timeouts.push({ fn, ms, args: a }); return calls.timeouts.length; },
    clearTimeout: () => {},
    setInterval: (fn, ms, ...a) => { calls.intervals.push({ fn, ms, args: a }); return calls.intervals.length; },
    clearInterval: () => {},
    queueMicrotask,
    URL, URLSearchParams, TextEncoder, TextDecoder, Intl, Math, Date, JSON,
    btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
    atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000", getRandomValues: (a) => a.fill(7) },
    Promise, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set, Symbol
  };

  return { sandbox, calls, elements, createElementStub, window: win, document, navigator, location };
}

module.exports = { createBrowserStubs, createElementStub, createLocalStorage };
