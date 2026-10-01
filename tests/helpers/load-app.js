"use strict";
/**
 * Loads the production browser scripts into a node:vm sandbox and exposes their
 * top-level declarations for testing.
 *
 * WHY THIS IS NOT A `require()`:
 * docs/scripts/app.js and docs/scripts/route-optimizer.js are plain browser
 * scripts. They have no module system -- route-optimizer.js:393-402 even has a
 * `module.exports` block that is commented out. Everything is declared with
 * top-level `function` / `let` / `const`.
 *
 * `let` and `const` at the top level of a script are SCRIPT-SCOPED, not
 * properties of globalThis. So two things follow:
 *
 *   1. Both files must be evaluated as ONE vm script (route-optimizer.js first,
 *      matching the <script> order in docs/index.html at lines 362-363), or
 *      route-optimizer cannot see app.js's `allProducts` / `STORE_AISLES`.
 *   2. Exports must be harvested by an epilogue appended INSIDE that same
 *      lexical scope. The epilogue defines accessors, not a snapshot, so tests
 *      always observe the live value of mutable globals like `allProducts`.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createBrowserStubs } = require("./browser-stubs.js");

const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.join(ROOT, "docs");

const SOURCES = [
  path.join(DOCS, "scripts", "route-optimizer.js"),
  path.join(DOCS, "scripts", "app.js")
];

/** Top-level declarations, i.e. those starting at column 0. */
function collectTopLevelNames(source) {
  const names = new Set();
  const fn = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;
  const bind = /^(?:let|const|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = fn.exec(source))) names.add(m[1]);
  while ((m = bind.exec(source))) names.add(m[1]);
  return names;
}

function buildExportEpilogue(names) {
  const accessors = [...names].map(n =>
    // `typeof` on a TDZ/undeclared identifier is the only safe probe here.
    `  get ${n}() { return typeof ${n} === "undefined" ? undefined : ${n}; },\n` +
    `  set ${n}(v) { ${n} = v; }`
  );
  return `\n;globalThis.__appExports__ = {\n${accessors.join(",\n")}\n};\n`;
}

let cachedBundle = null;
function buildBundle() {
  if (cachedBundle) return cachedBundle;
  const parts = SOURCES.map(file => ({
    file,
    code: fs.readFileSync(file, "utf8")
  }));
  const names = new Set();
  parts.forEach(p => collectTopLevelNames(p.code).forEach(n => names.add(n)));
  const code =
    parts.map(p => `/* ==== ${path.relative(ROOT, p.file)} ==== */\n${p.code}`).join("\n") +
    buildExportEpilogue(names);
  cachedBundle = { code, names: [...names].sort() };
  return cachedBundle;
}

/**
 * Evaluate the app in a fresh sandbox.
 *
 * @param {object} [opts] forwarded to createBrowserStubs (serviceWorker, hash,
 *        storage, console).
 * @returns {{app: object, sandbox: object, calls: object, elements: Map,
 *            names: string[], setElement: Function, loadCatalog: Function,
 *            fireDomContentLoaded: Function}}
 */
function loadApp(opts = {}) {
  const stubs = createBrowserStubs(opts);
  const context = vm.createContext(stubs.sandbox);
  context.globalThis = context;

  const { code, names } = buildBundle();
  const script = new vm.Script(code, { filename: "bharathbazar-bundle.js" });
  script.runInContext(context);

  const app = context.__appExports__;

  /** Register a stub element so a DOM-coupled function can find it. */
  function setElement(id, overrides = {}) {
    const el = Object.assign(stubs.createElementStub(id), overrides);
    stubs.elements.set(id, el);
    return el;
  }

  /**
   * Populate `allProducts` through the REAL production loader by stubbing fetch,
   * so tests exercise loadExternalDataFiles() / parseMultilingualCsv() rather
   * than a reimplementation of them.
   *
   * @param {string} csvText   contents served for json/product_data.csv
   * @param {object|string} [storeMap] contents served for json/store_map.json
   */
  async function loadCatalog(csvText, storeMap) {
    const mapBody = storeMap === undefined
      ? null
      : (typeof storeMap === "string" ? storeMap : JSON.stringify(storeMap));

    context.fetch = async (url) => {
      const u = String(url);
      stubs.calls.fetch.push(u);
      if (u.includes("product_data.csv")) {
        return { ok: true, status: 200, async text() { return csvText; } };
      }
      if (u.includes("store_map.json")) {
        if (mapBody === null) return { ok: false, status: 404, async text() { return ""; }, async json() { return {}; } };
        return { ok: true, status: 200, async text() { return mapBody; }, async json() { return JSON.parse(mapBody); } };
      }
      return { ok: false, status: 404, async text() { return ""; }, async json() { return {}; } };
    };

    await app.loadExternalDataFiles();
    return app.allProducts;
  }

  /** Run the app's real boot sequence (app.js:677). */
  async function fireDomContentLoaded() {
    stubs.document.readyState = "interactive";
    const handlers = stubs.document._listeners.DOMContentLoaded || [];
    for (const fn of handlers) {
      await fn.call(stubs.document, { type: "DOMContentLoaded" });
    }
  }

  return {
    app,
    sandbox: context,
    calls: stubs.calls,
    elements: stubs.elements,
    window: stubs.window,
    document: stubs.document,
    location: stubs.location,
    names,
    setElement,
    loadCatalog,
    fireDomContentLoaded
  };
}

/** Read a real data file from docs/json. */
function readDataFile(name) {
  return fs.readFileSync(path.join(DOCS, "json", name), "utf8");
}
function readJsonDataFile(name) {
  return JSON.parse(readDataFile(name));
}

/**
 * Values created inside the vm context are built from THAT realm's intrinsics,
 * so `[1,2]` from the sandbox is not an instance of the host realm's Array and
 * `assert.deepStrictEqual` rejects it on the prototype check alone. `toHost`
 * deep-copies arrays and plain objects into host-realm equivalents so tests can
 * use strict assertions. Anything that is not an array or a plain object
 * (primitives, functions, dates, maps) is passed through untouched.
 */
function toHost(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  const tag = Object.prototype.toString.call(value);

  if (tag === "[object Array]") {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(toHost(item, seen));
    return out;
  }

  if (tag === "[object Object]") {
    const out = {};
    seen.set(value, out);
    for (const key of Object.keys(value)) out[key] = toHost(value[key], seen);
    return out;
  }

  return value;
}

module.exports = {
  toHost, loadApp, buildBundle, collectTopLevelNames, readDataFile, readJsonDataFile, ROOT, DOCS };
