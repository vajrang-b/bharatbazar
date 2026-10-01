/**
 * Unit tests for the CSV / keyword parsing primitives in docs/scripts/app.js.
 *
 * These call the real production functions through the vm harness -- there is
 * no re-implementation here, so a behaviour change in app.js breaks these.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, toHost } = require("../helpers/load-app");

test("CSV parsing primitives", async t => {
  const { app } = await loadApp();

  await t.test("parseCsvLine splits a plain row", () => {
    assert.deepEqual(toHost(app.parseCsvLine("a,b,c")), ["a", "b", "c"]);
  });

  await t.test("parseCsvLine honours quoted commas", () => {
    assert.deepEqual(toHost(app.parseCsvLine('a,"b,c",d')), ["a", "b,c", "d"]);
  });

  await t.test("parseCsvLine unescapes doubled quotes", () => {
    assert.deepEqual(toHost(app.parseCsvLine('a,"b,c","d""e",')), ["a", "b,c", 'd"e', ""]);
  });

  await t.test("parseCsvLine trims surrounding whitespace per cell", () => {
    assert.deepEqual(toHost(app.parseCsvLine("  a ,  b  ,c  ")), ["a", "b", "c"]);
  });

  await t.test("parseCsvLine always yields one more cell than commas", () => {
    assert.equal(app.parseCsvLine("").length, 1);
    assert.equal(app.parseCsvLine(",").length, 2);
    assert.equal(app.parseCsvLine("a,b,c,d,e,f,g").length, 7);
  });

  await t.test("parseCsvLine keeps empty trailing cells", () => {
    assert.deepEqual(toHost(app.parseCsvLine("a,,")), ["a", "", ""]);
  });

  await t.test("parseCsvLine tolerates an unterminated quote", () => {
    // Unbalanced quotes must not throw or drop the row.
    assert.deepEqual(toHost(app.parseCsvLine('a,"b,c')), ["a", "b,c"]);
  });
});

test("keyword parsing", async t => {
  const { app } = await loadApp();

  await t.test("parseKeywords returns [] for blank input", () => {
    assert.deepEqual(toHost(app.parseKeywords("")), []);
    assert.deepEqual(toHost(app.parseKeywords("   ")), []);
    assert.deepEqual(toHost(app.parseKeywords(undefined)), []);
    assert.deepEqual(toHost(app.parseKeywords(null)), []);
  });

  await t.test("parseKeywords reads python-style list literals", () => {
    assert.deepEqual(toHost(app.parseKeywords("['haldi', 'turmeric']")), ["haldi", "turmeric"]);
    assert.deepEqual(toHost(app.parseKeywords('["Haldi", "Turmeric Powder"]')), ["haldi", "turmeric powder"]);
  });

  await t.test("parseKeywords reads pipe-delimited lists", () => {
    assert.deepEqual(toHost(app.parseKeywords("haldi|turmeric|pasupu")), ["haldi", "turmeric", "pasupu"]);
  });

  await t.test("parseKeywords lowercases and drops empties", () => {
    assert.deepEqual(toHost(app.parseKeywords("Haldi||  TURMERIC  |")), ["haldi", "turmeric"]);
  });

  await t.test("parseKeywords falls back to pipe-split for a bracketed value with no quotes", () => {
    assert.deepEqual(toHost(app.parseKeywords("[haldi|turmeric]")), ["haldi", "turmeric"]);
  });

  await t.test("parseKeywords treats a bare word as a single keyword", () => {
    assert.deepEqual(toHost(app.parseKeywords("turmeric")), ["turmeric"]);
  });
});

test("slug helpers", async t => {
  const { app } = await loadApp();

  await t.test("slugifyProductName lowercases and hyphenates", () => {
    assert.equal(app.slugifyProductName("Laxmi Turmeric Powder"), "laxmi-turmeric-powder");
  });

  await t.test("slugifyProductName strips diacritics via NFD", () => {
    assert.equal(app.slugifyProductName("Café Crème"), "cafe-creme");
  });

  await t.test("slugifyProductName collapses punctuation runs", () => {
    assert.equal(app.slugifyProductName("MDH -- Garam  Masala (100g)"), "mdh-garam-masala-100g");
  });

  await t.test("slugifyProductName trims leading/trailing separators", () => {
    assert.equal(app.slugifyProductName("  ...Rice!!!  "), "rice");
  });

  await t.test("slugifyProductName returns '' for empty-ish input", () => {
    assert.equal(app.slugifyProductName(""), "");
    assert.equal(app.slugifyProductName(null), "");
    assert.equal(app.slugifyProductName("!!!"), "");
  });

  await t.test("slugifyProductName is idempotent", () => {
    const once = app.slugifyProductName("Amul Pure Ghee 1L");
    assert.equal(app.slugifyProductName(once), once);
  });

  await t.test("formatProductName round-trips a slug into a display name", () => {
    assert.equal(app.formatProductName("laxmi-turmeric-powder"), "Laxmi Turmeric Powder");
  });

  await t.test("normalizeProductCell treats sheet formula errors as empty", () => {
    assert.equal(app.normalizeProductCell("#VALUE!"), "");
    assert.equal(app.normalizeProductCell(" #N/A "), "");
    assert.equal(app.normalizeProductCell("#REF!", "x"), "x");
    assert.equal(app.normalizeProductCell("#1 Masala"), "#1 Masala");
  });

  await t.test("a blank sheet row with #VALUE! translations adds nothing", async () => {
    const { app: fresh, loadCatalog } = await loadApp();
    await loadCatalog("en,te,hi,keywords,categories,aisle,rack\n,#VALUE!,#VALUE!,,,,\nRice,బియ్యం,चावल,rice,Grains,2,10\n");
    assert.deepEqual(Object.keys(fresh.MULTILINGUAL_DICTIONARY), ["rice"]);
  });
});
