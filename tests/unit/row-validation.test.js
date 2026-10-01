/**
 * Unit tests for the row-sanitising guards in docs/scripts/app.js.
 *
 * These are the functions that decide whether a CSV row becomes a searchable
 * product at all, so a regression here silently shrinks the catalog.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, toHost } = require("../helpers/load-app");

test("isLikelySlug", async t => {
  const { app } = await loadApp();

  await t.test("accepts multi-segment hyphenated tokens", () => {
    assert.equal(app.isLikelySlug("turmeric-powder"), true);
    assert.equal(app.isLikelySlug("mdh-garam-masala-100g"), true);
  });

  await t.test("rejects single words and real product names", () => {
    assert.equal(app.isLikelySlug("turmeric"), false);
    assert.equal(app.isLikelySlug("Laxmi Turmeric Powder"), false);
  });

  await t.test("rejects empty and non-string input", () => {
    assert.equal(app.isLikelySlug(""), false);
    assert.equal(app.isLikelySlug("   "), false);
    assert.equal(app.isLikelySlug(null), false);
    assert.equal(app.isLikelySlug(undefined), false);
    assert.equal(app.isLikelySlug(42), false);
  });

  await t.test("rejects dangling hyphens", () => {
    assert.equal(app.isLikelySlug("-turmeric"), false);
    assert.equal(app.isLikelySlug("turmeric-"), false);
  });
});

test("looksLikeKeywordOnlyValue", async t => {
  const { app } = await loadApp();

  await t.test("flags bracketed list literals", () => {
    assert.equal(app.looksLikeKeywordOnlyValue("['haldi', 'turmeric']"), true);
  });

  await t.test("flags lowercase pipe-delimited keyword dumps", () => {
    assert.equal(app.looksLikeKeywordOnlyValue("haldi|turmeric|pasupu"), true);
  });

  await t.test("does not flag a real name containing a pipe and capitals", () => {
    // Capitalisation is the signal that this is a display name, not keywords.
    assert.equal(app.looksLikeKeywordOnlyValue("Haldi|Turmeric"), false);
  });

  await t.test("does not flag a single pipe-free value", () => {
    assert.equal(app.looksLikeKeywordOnlyValue("turmeric powder"), false);
    assert.equal(app.looksLikeKeywordOnlyValue(""), false);
  });

  await t.test("requires at least two pieces around the pipe", () => {
    assert.equal(app.looksLikeKeywordOnlyValue("haldi|"), false);
  });
});

test("normalizeProductCell", async t => {
  const { app } = await loadApp();

  await t.test("passes a normal value straight through, trimmed", () => {
    assert.equal(app.normalizeProductCell("  Laxmi Ghee "), "Laxmi Ghee");
  });

  await t.test("returns the fallback for blank input", () => {
    assert.equal(app.normalizeProductCell("", "FB"), "FB");
    assert.equal(app.normalizeProductCell("   ", "FB"), "FB");
    assert.equal(app.normalizeProductCell(null, "FB"), "FB");
  });

  await t.test("treats 'Uncategorized' as missing", () => {
    assert.equal(app.normalizeProductCell("Uncategorized", "FB"), "FB");
    assert.equal(app.normalizeProductCell("uncategorized", "FB"), "FB");
  });

  await t.test("humanises a slug that leaked into a name column", () => {
    assert.equal(app.normalizeProductCell("turmeric-powder"), "Turmeric Powder");
  });

  await t.test("defaults the fallback to the empty string", () => {
    assert.equal(app.normalizeProductCell(""), "");
  });
});

test("isValidProductRow", async t => {
  const { app } = await loadApp();

  await t.test("accepts a row with any one usable name", () => {
    assert.equal(app.isValidProductRow({ en: "Turmeric Powder", te: "", hi: "" }), true);
    assert.equal(app.isValidProductRow({ en: "", te: "పసుపు", hi: "" }), true);
  });

  await t.test("rejects a row with no names at all", () => {
    assert.equal(app.isValidProductRow({ en: "", te: "", hi: "" }), false);
  });

  await t.test("rejects a row whose name column holds a keyword dump", () => {
    assert.equal(app.isValidProductRow({ en: "['haldi','turmeric']", te: "", hi: "" }), false);
    assert.equal(app.isValidProductRow({ en: "haldi|turmeric|pasupu", te: "", hi: "" }), false);
  });

  await t.test("rejects a row whose name column holds a raw slug", () => {
    assert.equal(app.isValidProductRow({ en: "turmeric-powder", te: "", hi: "" }), false);
  });

  await t.test("rejects a single-character name", () => {
    assert.equal(app.isValidProductRow({ en: "x", te: "", hi: "" }), false);
  });

  await t.test("one bad column poisons the whole row", () => {
    // Guard is `.some(...)`: a good `en` does not rescue a slug in `te`.
    assert.equal(app.isValidProductRow({ en: "Turmeric Powder", te: "turmeric-powder", hi: "" }), false);
  });
});

test("getHash", async t => {
  const { app } = await loadApp();

  await t.test("is deterministic and non-negative", () => {
    assert.equal(app.getHash("turmeric-powder"), app.getHash("turmeric-powder"));
    assert.ok(app.getHash("turmeric-powder") >= 0);
    assert.ok(app.getHash("") >= 0);
  });

  await t.test("distributes distinct slugs to distinct values", () => {
    const seen = new Set(["rice", "ghee", "haldi", "jeera", "dahi"].map(s => app.getHash(s)));
    assert.equal(seen.size, 5);
  });

  await t.test("derived rack numbers stay inside 1..30", () => {
    for (const slug of ["rice", "ghee", "haldi", "jeera", "dahi", "a", "zzzzzzzz"]) {
      const rack = (app.getHash(slug) % 30) + 1;
      assert.ok(rack >= 1 && rack <= 30, `${slug} -> ${rack}`);
    }
  });
});

test("formatLocationRack", async t => {
  const { app } = await loadApp();

  await t.test("prefixes a bare number", () => {
    assert.equal(app.formatLocationRack(7), "Rack 7");
    assert.equal(app.formatLocationRack("7"), "Rack 7");
  });

  await t.test("leaves an already-labelled rack alone", () => {
    assert.equal(app.formatLocationRack("Rack 7"), "Rack 7");
    assert.equal(app.formatLocationRack("A12"), "A12");
  });

  await t.test("returns '' for missing values", () => {
    assert.equal(app.formatLocationRack(null), "");
    assert.equal(app.formatLocationRack(undefined), "");
    assert.equal(app.formatLocationRack("  "), "");
  });

  await t.test("rack 0 is still formatted, not dropped", () => {
    assert.equal(app.formatLocationRack(0), "Rack 0");
  });
});

test("buildAisleMapFromDictionary", async t => {
  const { app } = await loadApp();

  await t.test("returns an empty map when the dictionary is empty", () => {
    assert.deepEqual(toHost(app.buildAisleMapFromDictionary()), {});
  });

  await t.test("derives aisle metadata from dictionary entries", () => {
    app.MULTILINGUAL_DICTIONARY = {
      turmeric: { te: "Pasupu", hi: "Haldi", keywords: ["turmeric"], aisle: 1 },
      rice: { te: "Biyyam", hi: "Chawal", keywords: ["rice"], aisle: 2 }
    };
    const map = toHost(app.buildAisleMapFromDictionary());
    assert.deepEqual(Object.keys(map).sort(), ["1", "2"]);
    assert.equal(map[1].name, "Spices & Masala");
    assert.equal(map[2].name, "Atta, Rice & Grains");
    assert.ok(Array.isArray(map[1].keywords));
    app.MULTILINGUAL_DICTIONARY = {};
  });

  await t.test("skips entries with no aisle", () => {
    app.MULTILINGUAL_DICTIONARY = { mystery: { te: "", hi: "", keywords: [] } };
    assert.deepEqual(toHost(app.buildAisleMapFromDictionary()), {});
    app.MULTILINGUAL_DICTIONARY = {};
  });
});
