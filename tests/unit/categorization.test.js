/**
 * Unit tests for categorizeProduct in docs/scripts/app.js.
 *
 * categorizeProduct has a strict precedence chain -- the multilingual
 * dictionary, then a keyword scan over STORE_AISLES, then a hash fallback. Each rung is pinned separately here because a reordering would not
 * be visible in the UI until a specific product landed in the wrong aisle.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, toHost } = require("../helpers/load-app");

test("categorizeProduct precedence", async t => {
  const { app } = await loadApp();

  await t.test("a location saved by the old public edit form is ignored", async () => {
    // The public site is read-only; racks come from the Google Sheet only. A
    // stale entry left in a visitor's browser must not move the product.
    const { app: fresh } = await loadApp({
      storage: { bharath_bazar_location_overrides: JSON.stringify({ rice: { aisle: 7, rack: 42 } }) }
    });
    fresh.loadStorageData();
    fresh.MULTILINGUAL_DICTIONARY = {
      rice: { te: "Biyyam", hi: "Chawal", keywords: ["rice"], aisle: 6, rack: 9 }
    };
    const res = toHost(fresh.categorizeProduct("rice"));
    assert.equal(res.aisle, 6);
    assert.equal(res.rack, 9);
  });

  await t.test("the dictionary wins over the keyword scan", () => {
    // "rice" would keyword-match aisle 2; the dictionary forces aisle 6.
    app.MULTILINGUAL_DICTIONARY = {
      rice: { te: "Biyyam", hi: "Chawal", keywords: ["rice"], aisle: 6, rack: 9 }
    };
    const res = toHost(app.categorizeProduct("rice"));
    assert.equal(res.aisle, 6);
    assert.equal(res.rack, 9);
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("a dictionary entry with no rack falls back to the hash", () => {
    app.MULTILINGUAL_DICTIONARY = {
      rice: { te: "", hi: "", keywords: [], aisle: 6 }
    };
    const res = toHost(app.categorizeProduct("rice"));
    assert.equal(res.rack, (app.getHash("rice") % 30) + 1);
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("the keyword scan routes by STORE_AISLES keywords", () => {
    const cases = [
      ["laxmi-turmeric-powder", 1],
      ["sujata-chakki-atta", 2],
      ["vadilal-frozen-samosa", 3],
      ["haldiram-bhujia", 4],
      ["amul-ghee", 5],
      ["mtr-pickle", 6]
    ];
    for (const [slug, aisle] of cases) {
      assert.equal(toHost(app.categorizeProduct(slug)).aisle, aisle, slug);
    }
  });

  await t.test("the scan takes the lowest-numbered matching aisle", () => {
    // "ghee" is aisle 5 and "masala" is aisle 1; iteration order stops at 1.
    assert.equal(toHost(app.categorizeProduct("masala-ghee")).aisle, 1);
  });

  await t.test("an unmatched slug defaults to aisle 1", () => {
    const res = toHost(app.categorizeProduct("zzz-unknown-item-qqq"));
    assert.equal(res.aisle, 1);
    assert.equal(res.categoryName, "Spices & Masala");
  });

  await t.test("the fallback rack is the deterministic hash, in 1..30", () => {
    const slug = "zzz-unknown-item-qqq";
    const res = toHost(app.categorizeProduct(slug));
    assert.equal(res.rack, (app.getHash(slug) % 30) + 1);
    assert.ok(res.rack >= 1 && res.rack <= 30);
  });

  await t.test("categorising the same slug twice is stable", () => {
    const a = toHost(app.categorizeProduct("some-random-product"));
    const b = toHost(app.categorizeProduct("some-random-product"));
    assert.deepEqual(a, b);
  });

  await t.test("every result carries aisle, rack, categoryName and icon", () => {
    const res = toHost(app.categorizeProduct("amul-butter"));
    assert.deepEqual(Object.keys(res).sort(), ["aisle", "categoryName", "icon", "rack"]);
  });
});

test("getMultilingualAliases", async t => {
  const { app } = await loadApp();

  await t.test("returns [] when the dictionary is empty", () => {
    app.MULTILINGUAL_DICTIONARY = {};
    assert.deepEqual(toHost(app.getMultilingualAliases("turmeric-powder", "Turmeric Powder")), []);
  });

  await t.test("emits TE/HI aliases for the first keyword hit", () => {
    app.MULTILINGUAL_DICTIONARY = {
      turmeric: { te: "Pasupu", hi: "Haldi", keywords: ["turmeric"] }
    };
    assert.deepEqual(
      toHost(app.getMultilingualAliases("turmeric-powder", "Turmeric Powder")),
      ["TE: Pasupu", "HI: Haldi"]
    );
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("stops at the first match rather than accumulating", () => {
    app.MULTILINGUAL_DICTIONARY = {
      turmeric: { te: "Pasupu", hi: "Haldi", keywords: ["turmeric"] },
      powder: { te: "Podi", hi: "Powder", keywords: ["powder"] }
    };
    assert.equal(toHost(app.getMultilingualAliases("turmeric-powder", "Turmeric Powder")).length, 2);
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("matches against slug and name together, case-insensitively", () => {
    app.MULTILINGUAL_DICTIONARY = { ghee: { te: "Neyyi", hi: "Ghee", keywords: ["ghee"] } };
    assert.equal(toHost(app.getMultilingualAliases("amul-123", "Amul GHEE 1L")).length, 2);
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("throws if a dictionary entry has no keywords array", () => {
    // Documents a real fragility: the `.some()` call is unguarded.
    app.MULTILINGUAL_DICTIONARY = { broken: { te: "a", hi: "b" } };
    // Matched by name: the error is thrown inside the vm sandbox, so it is a
    // different realm's TypeError and fails an instanceof check.
    assert.throws(() => app.getMultilingualAliases("x", "y"), { name: "TypeError" });
    app.MULTILINGUAL_DICTIONARY = {};
  });
});
