/**
 * Bharath Bazar Mobile-First Multilingual Store Inventory & Product Locator Logic
 * Single source of truth:
 * - Multilingual product catalog + aisle/category metadata: product_data.csv
 */

// ========================================
// SERVICE WORKER REGISTRATION (Offline Support)
// ========================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        console.log("[App] Service Worker registered:", registration);

        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch((error) => {
        console.warn("[App] Service Worker registration failed:", error);
      });
  });

  // Listen for service worker updates
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[App] Service Worker controller changed - updates available");
  });
}

const DEFAULT_STORE_AISLES = {
  1: { name: "Spices & Masala", icon: "🌶️", color: "var(--aisle-1)", keywords: ["masala", "powder", "spice", "chili", "chilli", "coriander", "cumin", "turmeric", "seeds", "mdh", "everest", "laxmi", "curry", "garam", "hing", "salt", "jeera", "dhania", "haldi", "saunf", "methi", "cardamom", "clove", "cinnamon"] },
  2: { name: "Atta, Rice & Grains", icon: "🌾", color: "var(--aisle-2)", keywords: ["atta", "flour", "rice", "basmati", "sujata", "rava", "dal", "lentil", "chana", "moong", "toor", "urad", "wheat", "poha", "sooji", "besan", "maida", "matar", "rajma", "pulao", "biryani"] },
  3: { name: "Frozen Foods", icon: "❄️", color: "var(--aisle-3)", keywords: ["frozen", "paneer", "samosa", "naan", "kulcha", "vadilal", "tindora", "okra", "roti", "vegetable", "paratha", "cut-veg", "peas", "gobi", "tikka", "patra", "sweet-corn"] },
  4: { name: "Snacks & Sweets", icon: "🍬", color: "var(--aisle-4)", keywords: ["muruku", "murukku", "mix", "mixture", "haldiram", "gulab", "jamun", "snack", "chevda", "laddu", "chips", "biscuit", "namkeen", "sweet", "cookie", "mathri", "bhujia", "khakhra", "chikki", "rasgulla"] },
  5: { name: "Dairy, Oils & Ghee", icon: "🧈", color: "var(--aisle-5)", keywords: ["ghee", "oil", "amul", "butter", "milk", "cheese", "paneer-raw", "mustard-oil", "sesame-oil", "sunflower", "coconut-oil", "dahi", "yogurt", "cream"] },
  6: { name: "Pickles, Sauces & Instant", icon: "🫙", color: "var(--aisle-6)", keywords: ["pickle", "sauce", "chutney", "paste", "mtr", "ready", "gravy", "chings", "noodle", "soup", "papad", "achaar", "schezwan", "ketchup", "soy"] },
  7: { name: "Tea & Beverages", icon: "☕", color: "var(--aisle-7)", keywords: ["tea", "chai", "coffee", "drink", "badam", "label", "wagh", "bakri", "juice", "syrup", "rooh", "afza", "sharbat", "thums", "limca", "maaza", "bournvita", "horlicks"] },
  8: { name: "Personal Care & Household", icon: "🧼", color: "var(--aisle-8)", keywords: ["dettol", "soap", "herbal", "shampoo", "incense", "agarbatti", "puja", "cleaner", "toothpaste", "dabur", "patanjali", "neem", "oil-hair", "face"] }
};

// Global State Data Containers (Populated asynchronously from data files)
let MULTILINGUAL_DICTIONARY = {};
let STORE_AISLES = { ...DEFAULT_STORE_AISLES };
let STORE_MAP_DATA = null;
let activeMapAisleFilter = "all";
let activeHighlightedRack = null;
let allProducts = [];
let filteredProducts = [];
let searchAnalytics = {};
let currentAisleFilter = "all";
let currentView = "searchView";
let visitorProfile = null;
let deviceAnalyticsList = [];
let headerLanguagePreference = { en: true, te: false, hi: false };
let pendingSearchLog = null;
let pendingSearchTimer = null;
let lastSubmittedSearch = "";
let submittedSearchLog = new Map();
let trackingConsent = null;

const CONSENT_STORAGE_KEY = "bharath_bazar_tracking_consent";
const GOOGLE_FORM_SUBMIT_URL = "https://docs.google.com/forms/d/1M3cdxsTWw84__S5XQdH5xHva7VhBZ-71HP7EKpiT0Kc/formResponse";
const SEARCH_FORM_SUBMIT_URL = "https://docs.google.com/forms/d/e/1FAIpQLScPPLZH3SKzXA5KjWo52io3NwoMx7YZ8Bckau002OkQ20t9Gw/formResponse";
const GOOGLE_FORM_ENTRY_IDS = {
  payload: "entry.1906332860"
};
const SEARCH_FORM_ENTRY_IDS = {
  query: "entry.271605241"
};

// Wait this long after the last keystroke before logging a search, so a
// slowly typed query lands in the "Search log" sheet as one row, not one
// row per pause. A committed search (Enter / blur / product tap) and any
// page-exit flush bypass the wait.
const SEARCH_LOG_IDLE_MS = 9000;
// The same query from the same session is not logged again within this window.
const SEARCH_LOG_REPEAT_WINDOW_MS = 10 * 60 * 1000;

// -------------------------------------------------------------
// ASYNCHRONOUS DATA LOADERS (Separating Data from Code)
// -------------------------------------------------------------
async function loadExternalDataFiles() {
  try {
    STORE_AISLES = { ...DEFAULT_STORE_AISLES };

    let csvResponse = await fetch("json/product_data.csv");
    if (!csvResponse.ok) csvResponse = await fetch("product_data.csv");
    
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      parseMultilingualCsv(csvText);

      const aisleMap = buildAisleMapFromDictionary();
      STORE_AISLES = { ...DEFAULT_STORE_AISLES, ...aisleMap };

      const keys = Object.keys(MULTILINGUAL_DICTIONARY);
      allProducts = keys.map((slug, idx) => {
        const dict = MULTILINGUAL_DICTIONARY[slug];
        const loc = categorizeProduct(slug);
        const name = dict.en || formatProductName(slug);

        const translations = {
          en: name,
          te: dict.te || "",
          hi: dict.hi || ""
        };

        const aliases = [];
        if (translations.te) aliases.push(`${translations.te}`);
        if (translations.hi) aliases.push(`${translations.hi}`);

        // Extra racks this product also lives in (primary aisle/rack excluded).
        const extraLocations = (dict.locations || []).filter(l => {
          if (l.aisle !== loc.aisle) return true;
          return String(l.rack ?? "") !== String(loc.rack ?? "");
        });

        return {
          id: idx,
          slug: slug,
          name: name,
          aisle: loc.aisle,
          rack: loc.rack,
          categoryName: loc.categoryName,
          icon: loc.icon,
          aliases: aliases,
          keywords: Array.isArray(dict.keywords) ? dict.keywords : [],
          translations: translations,
          extraLocations: extraLocations
        };
      });

      const totalBadge = document.getElementById("totalBadge");
      if (totalBadge) {
        totalBadge.textContent = `Catalog`;
      }
    }

    try {
      let mapResponse = await fetch("json/store_map.json");
      if (!mapResponse.ok) mapResponse = await fetch("store_map.json");
      if (mapResponse.ok) {
        STORE_MAP_DATA = await mapResponse.json();
        console.log("[App] Store Map loaded successfully:", STORE_MAP_DATA.metadata || "visual array");
      }
    } catch (mapErr) {
      console.warn("[App] Could not load store_map.json:", mapErr);
    }
  } catch (err) {
    console.error("Error loading external data files:", err);
  }
}

function parseCsvLine(text) {
  const result = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cell.trim());
      cell = "";
    } else {
      cell += c;
    }
  }

  result.push(cell.trim());
  return result;
}

function parseKeywords(keywordsStr) {
  const raw = (keywordsStr || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    const matches = [...raw.matchAll(/['"]([^'"]+)['"]/g)];
    if (matches.length) {
      return matches.map(match => match[1].trim().toLowerCase()).filter(Boolean);
    }
  }

  return raw
    .split("|")
    .map(k => k.replace(/^[\[\]'"\s]+|[\[\]'"\s]+$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function buildAisleMapFromDictionary() {
  const map = {};

  Object.values(MULTILINGUAL_DICTIONARY).forEach(item => {
    if (!item.aisle) return;

    const aisleName = item.aisle_name || item.categories || item.category || DEFAULT_STORE_AISLES[item.aisle]?.name || `Aisle ${item.aisle}`;
    const aisleIcon = item.aisle_icon || DEFAULT_STORE_AISLES[item.aisle]?.icon || "📦";
    const aisleColor = DEFAULT_STORE_AISLES[item.aisle]?.color || "var(--aisle-1)";
    const aisleKeywords = DEFAULT_STORE_AISLES[item.aisle]?.keywords || [];

    map[item.aisle] = {
      name: aisleName,
      icon: aisleIcon,
      color: aisleColor,
      keywords: aisleKeywords
    };
  });

  return map;
}

function slugifyProductName(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function looksLikeKeywordOnlyValue(value) {
  const text = (value || "").trim();
  if (!text) return false;
  if (text.startsWith("[") && text.endsWith("]")) return true;
  if (text.includes("|")) {
    const pieces = text.split("|").map(p => p.trim()).filter(Boolean);
    return pieces.length >= 2 && pieces.every(piece => /^[a-z0-9\s\-_/]+$/i.test(piece) && !/[A-Z]/.test(piece));
  }
  return false;
}

function isLikelySlug(value) {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(trimmed);
}

function normalizeProductCell(value, fallback = "") {
  if (!value || typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  if (text === "Uncategorized" || text === "uncategorized") return fallback;
  // Formula errors from the sheet (e.g. GOOGLETRANSLATE on an empty row gives "#VALUE!").
  if (/^#(?:VALUE!|N\/A|REF!|NAME\?|ERROR!|DIV\/0!|NUM!|NULL!)$/i.test(text)) return fallback;
  if (isLikelySlug(text)) return formatProductName(text);
  return text;
}

function isValidProductRow({ en, te, hi }) {
  const nameFields = [en, te, hi].filter(Boolean);
  if (!nameFields.length) return false;

  if (nameFields.some(field => looksLikeKeywordOnlyValue(field))) return false;
  if (nameFields.some(field => isLikelySlug(field))) return false;

  const joined = nameFields.join(" ");
  if (joined.length < 2) return false;

  return true;
}

function parseMultilingualCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (!lines.length) return;

  const header = parseCsvLine(lines[0]);
  const headerMap = Object.fromEntries(header.map((col, index) => [col.trim().toLowerCase(), index]));
  MULTILINGUAL_DICTIONARY = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    const valueAt = (index) => index >= 0 && index < parts.length ? parts[index].trim() : "";

    const rawKey = valueAt(headerMap.key ?? -1);
    let en = normalizeProductCell(valueAt(headerMap.en ?? 0));
    let te = normalizeProductCell(valueAt(headerMap.te ?? 1));
    let hi = normalizeProductCell(valueAt(headerMap.hi ?? 2));
    const keywordsStr = valueAt(headerMap.keywords ?? 3);
    const category = normalizeProductCell(valueAt(headerMap.categories ?? headerMap.category ?? 4));
    const categoryKeywords = valueAt(headerMap.category_keywords ?? 5);
    const aisleVal = valueAt(headerMap.aisle ?? 5);
    const explicitAisleName = valueAt(headerMap.aisle_name ?? -1);
    const explicitAisleIcon = valueAt(headerMap.aisle_icon ?? -1);
    const rackVal = valueAt(headerMap.rack ?? 6);

    if (en && isLikelySlug(en)) {
      en = formatProductName(en);
    }
    if (te === "Uncategorized" || te === "uncategorized") te = "";
    if (hi === "Uncategorized" || hi === "uncategorized") hi = "";

    if (!isValidProductRow({ en, te, hi })) {
      continue;
    }

    const key = rawKey ? rawKey.toLowerCase() : slugifyProductName(en || te || hi || keywordsStr || `item-${i}`);
    if (!key) continue;

    const aisleDigits = (aisleVal || "").toString().replace(/\D+/g, "");
    const aisle = aisleDigits ? parseInt(aisleDigits, 10) : NaN;
    const rawRack = (rackVal || "").trim();
    const isInvalidRack = !rawRack || rawRack.toLowerCase() === "n/a" || rawRack.toLowerCase() === "rack number";
    const rack = isInvalidRack ? null : rawRack;
    const keywords = parseKeywords(keywordsStr || categoryKeywords);
    const resolvedCategory = category || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.name || "" : "");
    const derivedAisleName = explicitAisleName || resolvedCategory || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.name || `Aisle ${aisle}` : "");

    // A product can legitimately sit in several racks. The CSV lists one row per
    // location, so merge them instead of letting the last row clobber the rest.
    // The last row still supplies the primary aisle/rack, keeping every existing
    // consumer of .aisle / .rack working unchanged.
    const prevEntry = MULTILINGUAL_DICTIONARY[key];
    const resolvedAisle = Number.isInteger(aisle) && aisle > 0 ? aisle : null;
    const locations = Array.isArray(prevEntry?.locations) ? prevEntry.locations.slice() : [];
    if (resolvedAisle !== null || rack !== null) {
      const isDuplicateLocation = locations.some(l => l.aisle === resolvedAisle && l.rack === rack);
      if (!isDuplicateLocation) locations.push({ aisle: resolvedAisle, rack: rack });
    }

    // Keep translations/keywords a later blank row would otherwise wipe out.
    const mergedKeywords = prevEntry && Array.isArray(prevEntry.keywords)
      ? Array.from(new Set([...prevEntry.keywords, ...keywords]))
      : keywords;

    MULTILINGUAL_DICTIONARY[key] = {
      en: en || prevEntry?.en || "",
      te: te || prevEntry?.te || "",
      hi: hi || prevEntry?.hi || "",
      keywords: mergedKeywords,
      category: resolvedCategory || prevEntry?.category || "",
      categories: resolvedCategory || prevEntry?.categories || "",
      category_keywords: categoryKeywords || prevEntry?.category_keywords || "",
      aisle: resolvedAisle,
      aisle_name: derivedAisleName,
      aisle_icon: explicitAisleIcon || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.icon || "" : ""),
      rack: rack,
      locations: locations
    };
  }
}

function formatLocationRack(rack) {
  if (rack === null || rack === undefined) return "";
  const s = String(rack).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    return `Rack ${s}`;
  }
  return s;
}

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Whole-word keyword test for the aisle scan: "haldi" must not match
// "haldiram-bhujia", but a plural ("mtr-pickles", "red-chillies") still does.
// Hyphenated keywords such as "mustard-oil" match the same words in the slug.
const keywordPatternCache = new Map();
function slugHasKeyword(slug, keyword) {
  let pattern = keywordPatternCache.get(keyword);
  if (pattern === undefined) {
    const words = String(keyword).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    pattern = words.length
      ? new RegExp(`(?:^|[^a-z0-9])${words.join("[^a-z0-9]+")}(?:e?s)?(?:[^a-z0-9]|$)`)
      : null;
    keywordPatternCache.set(keyword, pattern);
  }
  return pattern ? pattern.test(slug) : false;
}

function categorizeProduct(slug) {
  const lower = slug.toLowerCase();

  if (MULTILINGUAL_DICTIONARY[lower] && MULTILINGUAL_DICTIONARY[lower].aisle) {
    const dict = MULTILINGUAL_DICTIONARY[lower];
    const aisleData = STORE_AISLES[dict.aisle] || { name: dict.aisle_name || "General Aisle", icon: dict.aisle_icon || "📦" };
    const rack = dict.rack || ((getHash(slug) % 30) + 1);
    return { aisle: dict.aisle, rack: rack, categoryName: aisleData.name, icon: aisleData.icon };
  }

  let assignedAisle = 1;
  for (const [id, meta] of Object.entries(STORE_AISLES)) {
    if (meta.keywords && meta.keywords.some(kw => slugHasKeyword(lower, kw))) {
      assignedAisle = parseInt(id);
      break;
    }
  }

  const rack = (getHash(slug) % 30) + 1;
  const aisleMeta = STORE_AISLES[assignedAisle] || { name: "General Spices", icon: "🌶️" };
  return { aisle: assignedAisle, rack: rack, categoryName: aisleMeta.name, icon: aisleMeta.icon };
}

function getMultilingualAliases(slug, name) {
  const text = `${slug} ${name}`.toLowerCase();
  const aliases = [];

  for (const [key, item] of Object.entries(MULTILINGUAL_DICTIONARY)) {
    if (item.keywords.some(kw => text.includes(kw))) {
      aliases.push(`TE: ${item.te}`);
      aliases.push(`HI: ${item.hi}`);
      break;
    }
  }

  return aliases;
}

// Anonymous Device Profiler
function generateDeviceFingerprint() {
  const components = [];

  // Screen properties
  components.push(window.screen.width + 'x' + window.screen.height);
  components.push(window.screen.colorDepth);
  components.push(window.devicePixelRatio || 1);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Platform & language
  components.push(navigator.platform);
  components.push(navigator.language);
  components.push(navigator.hardwareConcurrency || 'unknown');

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('BharatBazar🛒', 2, 15);
    components.push(canvas.toDataURL().slice(-50));
  } catch (e) {
    components.push('no-canvas');
  }

  // WebGL renderer
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        components.push(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    components.push('no-webgl');
  }

  // Hash all components into a short hex ID
  const raw = components.join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return 'DID-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

function detectDeviceProfile() {
  const ua = navigator.userAgent;
  let deviceType = "Desktop";
  if (/mobile/i.test(ua)) deviceType = "Mobile";
  if (/ipad|tablet/i.test(ua)) deviceType = "Tablet";

  let os = "Unknown OS";
  if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh/i.test(ua)) os = "macOS";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";

  const screenRes = `${window.screen.width}x${window.screen.height}`;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const deviceId = generateDeviceFingerprint();

  return {
    deviceType,
    os,
    browser,
    screenRes,
    isTouch,
    deviceId
  };
}

function postDeviceProfileToGoogleForm(profile) {
  if (!profile) return;

  const fieldId = GOOGLE_FORM_ENTRY_IDS.payload;
  if (!fieldId) return;

  const payload = JSON.stringify({
    visitorId: profile.visitorId,
    deviceType: profile.deviceType,
    os: profile.os,
    browser: profile.browser,
    screenRes: profile.screenRes,
    isTouch: profile.isTouch,
    visitCount: profile.visitCount,
    firstVisit: profile.firstVisit,
    lastVisit: profile.lastVisit,
    deviceId: profile.deviceId
  });

  const formData = new URLSearchParams();
  formData.append(fieldId, payload);

  fetch(GOOGLE_FORM_SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString(),
    mode: "no-cors",
    credentials: "omit"
  }).catch(() => {});
}

function initVisitorProfile() {
  try {
    const info = detectDeviceProfile();
    let saved = localStorage.getItem("bharath_bazar_visitor_profile");
    const isNewVisitor = !saved;

    if (saved) {
      visitorProfile = JSON.parse(saved);
      visitorProfile.visitCount = (visitorProfile.visitCount || 1) + 1;
      visitorProfile.lastVisit = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      visitorProfile.deviceId = info.deviceId;
    } else {
      const randomID = 'BB-DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      visitorProfile = {
        visitorId: randomID,
        deviceId: info.deviceId,
        deviceType: info.deviceType,
        os: info.os,
        browser: info.browser,
        screenRes: info.screenRes,
        isTouch: info.isTouch,
        firstVisit: new Date().toLocaleDateString(),
        lastVisit: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        visitCount: 1,
        recentSearches: []
      };
    }

    localStorage.setItem("bharath_bazar_visitor_profile", JSON.stringify(visitorProfile));
    registerDeviceAnalytics(visitorProfile);
    if (isNewVisitor) {
      postDeviceProfileToGoogleForm(visitorProfile);
    }
    renderVisitorWelcomeBanner();
  } catch (e) {}
}

function registerDeviceAnalytics(profile) {
  try {
    let savedLog = localStorage.getItem("bharath_bazar_device_log");
    let devices = savedLog ? JSON.parse(savedLog) : [];

    const existingIdx = devices.findIndex(d => d.visitorId === profile.visitorId);
    if (existingIdx >= 0) {
      devices[existingIdx] = profile;
    } else {
      devices.push(profile);
    }

    localStorage.setItem("bharath_bazar_device_log", JSON.stringify(devices));
    deviceAnalyticsList = devices;
  } catch (e) {}
}

function renderVisitorWelcomeBanner() {
  if (!visitorProfile) return;

  const hintBar = document.getElementById("langHintBar");
  if (!hintBar) return;

  if (visitorProfile.recentSearches && visitorProfile.recentSearches.length > 0) {
    const recentChips = visitorProfile.recentSearches.slice(0, 3).map(s => 
      `<span class="lang-chip" data-search="${escapeHtml(s)}" style="border-color: var(--primary-saffron); color: #FFF; background: rgba(230, 81, 0, 0.25);">⭐ ${escapeHtml(s)}</span>`
    ).join("");
    
    hintBar.insertAdjacentHTML("afterbegin", recentChips);
  }
}

function updateVisitorSearches(query) {
  if (!visitorProfile || !query || query.length < 2) return;
  const q = query.toLowerCase().trim();
  
  if (!visitorProfile.recentSearches) visitorProfile.recentSearches = [];
  
  visitorProfile.recentSearches = visitorProfile.recentSearches.filter(s => s !== q);
  visitorProfile.recentSearches.unshift(q);
  visitorProfile.recentSearches = visitorProfile.recentSearches.slice(0, 5);

  try {
    localStorage.setItem("bharath_bazar_visitor_profile", JSON.stringify(visitorProfile));
    registerDeviceAnalytics(visitorProfile);
  } catch (e) {}
}

function getTrackingConsentState() {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value || "accepted";
  } catch (e) {
    return "accepted";
  }
}

function setTrackingConsentState(value) {
  trackingConsent = value;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch (e) {}
}

function isTrackingAllowed() {
  return true;
}

function initPrivacyConsent() {
  trackingConsent = getTrackingConsentState();
  const banner = document.getElementById("cookieConsentBanner");
  if (!banner) return;

  banner.classList.remove("visible");

  const acceptBtn = document.getElementById("acceptCookiesBtn");
  const rejectBtn = document.getElementById("rejectCookiesBtn");

  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      setTrackingConsentState("accepted");
      if (visitorProfile) {
        postDeviceProfileToGoogleForm(visitorProfile);
      }
      banner.classList.remove("visible");
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => {
      setTrackingConsentState("accepted");
      if (visitorProfile) {
        postDeviceProfileToGoogleForm(visitorProfile);
      }
      banner.classList.remove("visible");
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadStorageData();
  initPrivacyConsent();
  initVisitorProfile();

  // Async load data from decoupled files
  await loadExternalDataFiles();

  setupEventListeners();
  renderMobileMap();
  applySearchAndFilter();
  renderAnalyticsList();
  renderTypoSearchList();
  renderDeviceAnalyticsDashboard();

  // Restore active tab from URL hash or sessionStorage on page refresh
  const initialTab = getInitialTab();
  if (initialTab !== "searchView") {
    switchTab(initialTab, false);
  } else {
    setTimeout(() => {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.focus({ preventScroll: true });
      }
    }, 300);
  }

  // Handle browser back/forward buttons with hash navigation
  window.addEventListener("hashchange", () => {
    const targetTab = getInitialTab();
    if (targetTab !== currentView) {
      switchTab(targetTab, false);
    }
  });
});

function loadStorageData() {
  try {
    const savedAnalytics = localStorage.getItem("bharath_bazar_search_analytics");
    if (savedAnalytics) {
      searchAnalytics = JSON.parse(savedAnalytics);
    } else {
      searchAnalytics = {};
      localStorage.setItem("bharath_bazar_search_analytics", JSON.stringify(searchAnalytics));
    }
  } catch (e) {}
}

function saveStorageData() {
  try {
    localStorage.setItem("bharath_bazar_search_analytics", JSON.stringify(searchAnalytics));
  } catch (e) {}
}

// -------------------------------------------------------------
// SEARCH LOG PIPELINE
// A search is only logged once the shopper has stopped typing, so that
// intermediate prefixes ("gar", "garli", "garlic pic") never reach the
// "Search log" sheet as separate rows. Every logged row also carries the
// number of products the shopper actually saw, so zero-result searches
// can be filtered out of the sheet later.
// -------------------------------------------------------------
function buildSearchLogPayload(entry) {
  const deviceId = visitorProfile?.deviceId || visitorProfile?.visitorId || "unknown-device";
  const results = Number.isFinite(entry.results) ? entry.results : -1;
  const status = results === 0 ? "NO_RESULTS" : "OK";
  return `${entry.query} | deviceId=${deviceId} | results=${results} | status=${status}`;
}

function isRecentlyLoggedSearch(query) {
  const last = submittedSearchLog.get(query);
  if (last == null) return false;
  if (Date.now() - last < SEARCH_LOG_REPEAT_WINDOW_MS) return true;
  submittedSearchLog.delete(query);
  return false;
}

// The shopper kept typing past the idle window: "garlic" is now only a
// prefix of what is on screen, so it was never a real search.
function isAbandonedSearchPrefix(query) {
  const input = document.getElementById("searchInput");
  const live = input ? input.value.trim().toLowerCase() : "";
  return live.length > query.length && live.startsWith(query);
}

function sendSearchLogPayload(payload) {
  const formData = new URLSearchParams();
  formData.append(SEARCH_FORM_ENTRY_IDS.query, payload);
  const encodedBody = formData.toString();

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([encodedBody], {
        type: "application/x-www-form-urlencoded;charset=UTF-8"
      });
      if (navigator.sendBeacon(SEARCH_FORM_SUBMIT_URL, blob)) return;
    }
  } catch (e) {}

  fetch(SEARCH_FORM_SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: encodedBody,
    mode: "no-cors",
    credentials: "omit"
  }).catch(() => {});
}

function flushPendingSearchLog(options = {}) {
  if (pendingSearchTimer) {
    clearTimeout(pendingSearchTimer);
    pendingSearchTimer = null;
  }

  const entry = pendingSearchLog;
  pendingSearchLog = null;

  if (!entry || !SEARCH_FORM_ENTRY_IDS.query) return;

  const query = String(entry.query || "").trim();
  if (query.length < 2) return;
  if (isRecentlyLoggedSearch(query)) return;
  if (!options.committed && isAbandonedSearchPrefix(query)) return;

  const payload = buildSearchLogPayload({ query, results: entry.results });
  if (lastSubmittedSearch === payload) return;

  lastSubmittedSearch = payload;
  submittedSearchLog.set(query, Date.now());
  sendSearchLogPayload(payload);
}

function flushPendingSearchLogOnLifecycleChange() {
  if (pendingSearchLog) {
    flushPendingSearchLog({ committed: true });
  }
}

// Called when the shopper clearly finished the search (Enter, blur, or
// opening a product) — no point waiting out the idle window.
function commitPendingSearchLog() {
  if (pendingSearchLog) {
    flushPendingSearchLog({ committed: true });
  }
}

function scheduleSearchLog(query, results) {
  const term = String(query || "").toLowerCase().trim();
  if (term.length < 2) return;

  const count = Number.isFinite(results) ? results : (Array.isArray(filteredProducts) ? filteredProducts.length : -1);

  // Replacing the pending entry is what collapses "gar" -> "garlic pickle"
  // into a single row instead of one row per keystroke burst.
  pendingSearchLog = { query: term, results: count };

  if (pendingSearchTimer) clearTimeout(pendingSearchTimer);
  pendingSearchTimer = setTimeout(() => {
    pendingSearchTimer = null;
    flushPendingSearchLog();
  }, SEARCH_LOG_IDLE_MS);
}

function postSearchQueryToGoogleForm(query) {
  scheduleSearchLog(query);
}

function trackSearchQuery(query) {
  if (!query || query.trim().length < 2) return;
  const term = query.toLowerCase().trim();
  const results = Array.isArray(filteredProducts) ? filteredProducts.length : -1;

  if (!searchAnalytics[term] || typeof searchAnalytics[term] !== "object") {
    const legacyCount = typeof searchAnalytics[term] === "number" ? searchAnalytics[term] : 0;
    searchAnalytics[term] = { count: legacyCount, results };
  }
  searchAnalytics[term].count += 1;
  searchAnalytics[term].results = results;

  saveStorageData();
  updateVisitorSearches(term);
  scheduleSearchLog(term, results);
  renderAnalyticsList();
  renderTypoSearchList();
  renderDeviceAnalyticsDashboard();
}

// Normalises both the current { count, results } shape and the older
// plain-number shape that may still sit in localStorage.
function getSearchAnalyticsEntries() {
  return Object.entries(searchAnalytics).map(([term, value]) => {
    if (value && typeof value === "object") {
      return {
        term,
        count: Number(value.count) || 0,
        results: Number.isFinite(value.results) ? value.results : -1,
        corrected: typeof value.corrected === "string" ? value.corrected : ""
      };
    }
    return { term, count: Number(value) || 0, results: -1, corrected: "" };
  });
}

function getZeroResultSearches() {
  return getSearchAnalyticsEntries()
    .filter(e => e.results === 0)
    .sort((a, b) => b.count - a.count);
}

function renderAnalyticsList() {
  const container = document.getElementById("analyticsList");
  const emptyContainer = document.getElementById("noResultSearchList");
  if (!container && !emptyContainer) return;

  const deviceId = visitorProfile?.deviceId || visitorProfile?.visitorId || "unknown-device";
  const entries = getSearchAnalyticsEntries();

  if (container) {
    const sorted = entries.sort((a, b) => b.count - a.count).slice(0, 10);
    container.innerHTML = sorted.map(({ term, count, results }) => `
      <li style="margin-bottom: 0.4rem;">
        <strong style="text-transform: capitalize; color: #FFF;">${escapeHtml(term)}</strong>: 
        <span style="color: var(--accent-amber); font-weight: 700;">${count} searches</span>
        ${results === 0 ? `<span style="color: var(--accent-red, #E53935); font-weight: 700;"> · no products</span>` : ""}
        <span style="display: block; margin-top: 0.2rem; font-size: 0.72rem; color: var(--text-muted);">
          Device: ${escapeHtml(deviceId)}
        </span>
      </li>
    `).join("");
  }

  if (emptyContainer) {
    const empties = getZeroResultSearches();
    emptyContainer.innerHTML = empties.length
      ? empties.map(({ term, count }) => `
        <li style="margin-bottom: 0.4rem;">
          <strong style="text-transform: capitalize; color: #FFF;">${escapeHtml(term)}</strong>
          <span style="color: var(--text-muted);"> — ${count} search${count === 1 ? "" : "es"}, 0 products</span>
        </li>
      `).join("")
      : `<li style="color: var(--text-muted);">Every search so far matched at least one product.</li>`;
  }
}

// Ranks the mistypes the resolver rescued, so staff can see which spellings
// shoppers actually use and promote the common ones into search_aliases.json.
function renderTypoSearchList() {
  const container = document.getElementById("typoSearchList");
  if (!container) return;

  const typos = getSearchAnalyticsEntries()
    .filter(e => e.corrected && e.corrected !== e.term)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  container.innerHTML = typos.length
    ? typos.map(({ term, count, corrected }) => `
      <li style="margin-bottom: 0.4rem;">
        <strong style="text-transform: capitalize; color: #FFF;">${escapeHtml(term)}</strong>
        <span style="color: var(--text-muted);"> → </span>
        <span style="color: #4ADE80; font-weight: 700; text-transform: capitalize;">${escapeHtml(corrected)}</span>
        <span style="color: var(--text-muted);"> · ${count} search${count === 1 ? "" : "es"}</span>
      </li>
    `).join("")
    : `<li style="color: var(--text-muted);">No corrected misspellings recorded yet.</li>`;
}

function renderDeviceAnalyticsDashboard() {
  const container = document.getElementById("deviceAnalyticsContainer");
  if (!container) return;

  let devices = [];
  try {
    const savedLog = localStorage.getItem("bharath_bazar_device_log");
    const parsed = savedLog ? JSON.parse(savedLog) : [];
    if (Array.isArray(parsed)) devices = parsed;
  } catch (e) {
    // A single corrupt entry should not blank the panel.
    devices = [];
  }

  if (devices.length === 0 && visitorProfile) {
    devices = [visitorProfile];
  }

  let html = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 1rem;">
      <div style="background: rgba(11, 15, 25, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.8rem; text-align: center;">
        <div style="font-size: 1.4rem; font-weight: 700; color: #4ADE80;">${devices.length}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">Unique Devices</div>
      </div>
      <div style="background: rgba(11, 15, 25, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.8rem; text-align: center;">
        <div style="font-size: 1.4rem; font-weight: 700; color: var(--accent-amber);">${visitorProfile ? visitorProfile.visitorId : 'BB-DEV-1'}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">Current Device ID</div>
      </div>
    </div>
    
    <div style="font-size: 0.8rem; font-weight: 700; color: #FFF; margin-bottom: 0.5rem;">📱 Connected Visitor Devices Table:</div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
  `;

  devices.forEach(d => {
    const recentStr = d.recentSearches && d.recentSearches.length > 0 ? d.recentSearches.join(", ") : "None yet";
    html += `
      <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; font-size: 0.78rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
          <span style="font-weight: 700; color: var(--primary-saffron-light);">🔑 ${d.visitorId} (${d.deviceType})</span>
          <span style="color: #4ADE80; font-size: 0.72rem;">Visits: ${d.visitCount}</span>
        </div>
        <div style="color: var(--text-secondary); margin-bottom: 0.2rem;">
          📱 <strong>OS/Browser:</strong> ${d.os} (${d.browser}) &bull; ${d.screenRes}
        </div>
        <div style="color: var(--text-muted); font-size: 0.72rem;">
          ⭐ <strong>Recent Searches:</strong> ${escapeHtml(recentStr)}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function formatProductName(slug) {
  let clean = slug.replace(/^[0-9]{6,14}/, "").replace(/-/g, " ").trim();
  if (!clean) clean = slug.replace(/-/g, " ");
  return clean.replace(/\b\w/g, l => l.toUpperCase());
}

function getProductDisplayName(product, locale = "en") {
  const targetLocale = locale || "en";
  const value = product?.translations?.[targetLocale];
  if (value && value.trim()) return value.trim();
  return product?.name || "Unknown product";
}

function scoreProductMatch(product, rawQuery) {
  if (!rawQuery) return 0;

  const query = rawQuery.toLowerCase().trim();
  const haystack = [
    product.slug || "",
    product.name || "",
    product.translations?.en || "",
    product.translations?.te || "",
    product.translations?.hi || "",
    ...(product.aliases || [])
  ].join(" ").toLowerCase();

  let score = 0;

  if (!haystack) return 0;

  const exactName = product.name && product.name.toLowerCase() === query;
  const exactEn = product.translations?.en && product.translations.en.toLowerCase() === query;
  const exactTe = product.translations?.te && product.translations.te.toLowerCase() === query;
  const exactHi = product.translations?.hi && product.translations.hi.toLowerCase() === query;
  const exactKeyword = (product.aliases || []).some(k => k.toLowerCase() === query);
  const keywordContains = (product.aliases || []).some(k => k.toLowerCase().includes(query));
  const keywordTokenMatch = (product.aliases || []).some(k => {
    const tokens = k.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.includes(query);
  });

  if (exactName) score += 400;
  if (exactEn) score += 350;
  if (exactTe) score += 330;
  if (exactHi) score += 330;
  if (exactKeyword) score += 300;
  if (keywordTokenMatch) score += 220;
  if (keywordContains) score += 120;

  if (product.name && product.name.toLowerCase().includes(query)) score += 150;
  if (product.translations?.en && product.translations.en.toLowerCase().includes(query)) score += 120;
  if (product.translations?.te && product.translations.te.toLowerCase().includes(query)) score += 90;
  if (product.translations?.hi && product.translations.hi.toLowerCase().includes(query)) score += 90;
  if (product.slug && product.slug.toLowerCase() === query) score += 100;
  if (product.slug && product.slug.toLowerCase().includes(query)) score += 60;

  if (product.name && product.name.toLowerCase().startsWith(query)) score += 35;
  if (product.translations?.en && product.translations.en.toLowerCase().startsWith(query)) score += 30;

  return score;
}

function applySearchAndFilter() {
  const rawQuery = document.getElementById("searchInput").value.trim().toLowerCase();
  
  let expandedKeywords = [rawQuery];
  if (rawQuery) {
    for (const [key, item] of Object.entries(MULTILINGUAL_DICTIONARY)) {
      if (item.keywords.some(kw => kw.includes(rawQuery) || rawQuery.includes(kw))) {
        expandedKeywords.push(...item.keywords);
      }
    }
  }

  filteredProducts = allProducts.filter(p => {
    if (currentAisleFilter !== "all" && p.aisle !== parseInt(currentAisleFilter)) {
      return false;
    }

    if (rawQuery) {
      const text = [
        p.slug,
        p.name,
        p.translations?.en || "",
        p.translations?.te || "",
        p.translations?.hi || "",
        ...(p.aliases || [])
      ].join(" ").toLowerCase();
      return expandedKeywords.some(kw => text.includes(kw));
    }

    return true;
  }).sort((a, b) => {
    const scoreDiff = scoreProductMatch(b, rawQuery) - scoreProductMatch(a, rawQuery);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.name || "").localeCompare(b.name || "");
  });

  renderProductList();
}

function renderProductList() {
  const container = document.getElementById("productListContainer");
  if (!container) return;
  container.innerHTML = "";

  const total = filteredProducts.length;
  const countElem = document.getElementById("resultsCount");
  if (countElem) countElem.textContent = `Showing ${total.toLocaleString()} products`;

  if (total === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #FFF; font-weight: 700;">🔍 No matching items</p>
        <p style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary);">
          Please contact support personnel at the point of sale for assistance.
        </p>
      </div>
    `;
    return;
  }

  const displayItems = filteredProducts.slice(0, 80);

  displayItems.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    const translationChips = [];
    if (headerLanguagePreference.te && p.translations && p.translations.te && p.translations.te.trim()) {
      translationChips.push(`<span class="product-translation-chip">${escapeHtml(p.translations.te.trim())}</span>`);
    }
    if (headerLanguagePreference.hi && p.translations && p.translations.hi && p.translations.hi.trim()) {
      translationChips.push(`<span class="product-translation-chip">${escapeHtml(p.translations.hi.trim())}</span>`);
    }

    card.innerHTML = `
      <div class="product-info">
        <div class="product-title">${escapeHtml(p.name)}</div>
        ${translationChips.length ? `<div class="product-language-wrap">${translationChips.join("")}</div>` : ""}
      </div>
      <div class="loc-badge-mobile" data-slug="${escapeHtml(p.slug)}">
        <span class="loc-aisle-text">📍 Aisle ${p.aisle}</span>
        <span class="loc-rack-text">${escapeHtml(formatLocationRack(p.rack))}</span>
      </div>
    `;

    // The CSV lists one row per stock location, so a product can genuinely sit
    // in several racks. Show the secondary ones instead of hiding them.
    const extraText = formatExtraLocations(p.extraLocations);
    if (extraText) {
      const info = card.querySelector(".product-info");
      const extra = document.createElement("div");
      extra.className = "product-extra-locations";
      extra.textContent = extraText;
      if (info) info.appendChild(extra);
    }

    container.appendChild(card);
  });
}

function showProductOnMap(product) {
  if (!product) return;
  
  // Switch to Map tab
  switchTab("mapView");

  const aisleId = String(product.aisle || "1");
  const rackNum = getNumericRack(product.rack) || 1;
  
  // Find shelf from STORE_MAP_DATA if available
  let shelfName = `Shelf ${Math.ceil(rackNum / 6)}`;
  if (STORE_MAP_DATA && STORE_MAP_DATA.rackLookup) {
    const lookup = STORE_MAP_DATA.rackLookup[`${aisleId}-${rackNum}`];
    if (lookup && lookup.shelf) {
      shelfName = lookup.shelf;
    }
  }

  // Update spotlight card
  const spotlightCard = document.getElementById("mapSpotlightCard");
  const spotlightTitle = document.getElementById("spotlightTitle");
  const spotlightSubtitle = document.getElementById("spotlightSubtitle");
  const spotlightIcon = document.getElementById("spotlightIcon");

  if (spotlightCard && spotlightTitle && spotlightSubtitle) {
    const aisleMeta = STORE_AISLES[aisleId] || { name: `Aisle ${aisleId}`, icon: "📍" };
    if (spotlightIcon) spotlightIcon.textContent = aisleMeta.icon || "📍";
    spotlightTitle.textContent = product.name;
    spotlightSubtitle.textContent = `Aisle ${aisleId} (${aisleMeta.name}) • ${shelfName} • Rack ${rackNum}`;
    spotlightCard.style.display = "block";
  }

  // Render 2D floorplan with highlight
  renderInteractiveStoreMap(aisleId, rackNum, shelfName, product);

  // Open detail drawer for this rack
  openRackDetailDrawer(aisleId, rackNum, shelfName, product);
}

function openRackDetailDrawer(aisleId, rackNum, shelfName, activeProduct = null) {
  const drawer = document.getElementById("rackDetailDrawer");
  const titleElem = document.getElementById("drawerRackTitle");
  const metaElem = document.getElementById("drawerRackMeta");
  const productsContainer = document.getElementById("drawerRackProducts");

  if (!drawer || !titleElem || !metaElem || !productsContainer) return;

  const aisleMeta = STORE_AISLES[aisleId] || { name: `Aisle ${aisleId}`, icon: "📦" };
  titleElem.textContent = `${aisleMeta.icon} Aisle ${aisleId} • Rack ${rackNum}`;
  metaElem.textContent = `${shelfName || "Shelf"} • ${aisleMeta.name}`;

  // Find products in this rack
  const targetAisle = parseInt(aisleId, 10);
  const targetRack = getNumericRack(rackNum);
  const matchingProducts = allProducts.filter(p => {
    if (parseInt(p.aisle, 10) !== targetAisle) return false;
    if (getNumericRack(p.rack) === targetRack) return true;
    // Also honour the product's secondary rack locations.
    return (p.extraLocations || []).some(l =>
      parseInt(l.aisle, 10) === targetAisle && getNumericRack(l.rack) === targetRack);
  });

  if (matchingProducts.length === 0) {
    productsContainer.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.4rem 0;">
        No products currently indexed at this rack.
      </div>
    `;
  } else {
    productsContainer.innerHTML = matchingProducts.map(p => `
      <div class="rack-prod-item">
        <span class="rack-prod-title">${escapeHtml(p.name)}</span>
      </div>
    `).join("");
  }

  drawer.style.display = "block";
}

function generateRackCells(aId, startRk, endRk, step, highlightAisle, highlightRack, cellClass) {
  let res = "";
  if (step > 0) {
    for (let rk = startRk; rk <= endRk; rk += step) {
      const isSpotlight = (highlightAisle === aId && highlightRack === rk);
      res += `<div class="fp-rack-cell ${cellClass} ${isSpotlight ? "spotlight" : ""}" data-aisle="${aId}" data-rack="${rk}" title="Aisle ${aId} Rack ${rk}">${rk}</div>`;
    }
  } else {
    for (let rk = startRk; rk >= endRk; rk += step) {
      const isSpotlight = (highlightAisle === aId && highlightRack === rk);
      res += `<div class="fp-rack-cell ${cellClass} ${isSpotlight ? "spotlight" : ""}" data-aisle="${aId}" data-rack="${rk}" title="Aisle ${aId} Rack ${rk}">${rk}</div>`;
    }
  }
  return res;
}

function renderInteractiveStoreMap(highlightAisle = null, highlightRack = null, highlightShelf = null, highlightProduct = null) {
  const canvas = document.getElementById("interactiveFloorplanCanvas");
  if (!canvas) return;

  const targetAisle = highlightAisle || activeMapAisleFilter;

  // Check if custom positioned layout exists in localStorage or STORE_MAP_DATA
  let customElements = null;
  const savedLocal = localStorage.getItem("bharath_bazar_custom_store_map");
  if (savedLocal) {
    try {
      customElements = JSON.parse(savedLocal);
    } catch (e) {}
  }
  if (!customElements && Array.isArray(STORE_MAP_DATA)) {
    customElements = STORE_MAP_DATA;
  }

  let html = "";

  if (customElements && Array.isArray(customElements) && customElements.length > 0) {
    // Calculate required canvas height dynamically to fit all custom elements
    let maxBottom = 950;
    customElements.forEach(it => {
      const bottom = (it.y || 0) + (it.height || 400) + 80;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    // DYNAMIC CUSTOM POSITIONED STUDIO LAYOUT
    html = `<div style="position: relative; width: 1200px; height: ${maxBottom}px; min-width: 1200px; background: rgba(15, 23, 42, 0.6); border-radius: 12px; border: 1px dashed rgba(148, 163, 184, 0.2); overflow: visible;">`;
    
    customElements.forEach(item => {
      let innerContent = "";
      const aId = item.id.replace(/^(aisle-|elem-)/, "").replace(/[^0-9]/g, "");

      if (aId === "8" || item.id.includes("aisle-8")) {
        innerContent = `
          <div class="fp-aisle-header" style="padding: 2px 4px;">
            <span style="font-size: 0.74rem;">${escapeHtml(item.label)}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px; padding: 2px;">
            <div class="fp-rack-row">
              ${generateRackCells("8", 31, 1, -1, highlightAisle, highlightRack, "cell-a8")}
            </div>
            <div class="fp-walkway-strip" style="font-size: 0.6rem; padding: 1px 3px;">way &bull; corridor</div>
            <div class="fp-rack-row">
              ${generateRackCells("8", 32, 62, 1, highlightAisle, highlightRack, "cell-a8")}
            </div>
          </div>
        `;
      } else if (aId === "7" || item.id.includes("aisle-7")) {
        innerContent = `
          <div class="fp-aisle-header" style="padding: 2px 4px;">
            <span style="font-size: 0.74rem;">${escapeHtml(item.label)}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px; padding: 2px;">
            <div class="fp-rack-row">
              ${generateRackCells("7", 31, 1, -1, highlightAisle, highlightRack, "cell-a7")}
            </div>
            <div class="fp-walkway-strip" style="font-size: 0.6rem; padding: 1px 3px;">way &bull; corridor</div>
            <div class="fp-rack-row">
              ${generateRackCells("7", 32, 62, 1, highlightAisle, highlightRack, "cell-a7")}
            </div>
          </div>
        `;
      } else if (aId === "4" || item.id.includes("aisle-4")) {
        innerContent = `
          <div class="fp-aisle-header" style="flex-direction: column; text-align: center; padding: 2px 0;">
            <span style="font-size: 0.76rem;">${escapeHtml(item.label)}</span>
          </div>
          <div class="fp-vertical-bays" style="padding: 2px;">
            <div class="fp-rack-col">
              ${generateRackCells("4", 31, 42, 1, highlightAisle, highlightRack, "cell-a4")}
            </div>
            <div class="fp-center-walkway-col"><span style="font-size: 0.55rem;">WAY</span></div>
            <div class="fp-rack-col">
              ${generateRackCells("4", 31, 20, -1, highlightAisle, highlightRack, "cell-a4")}
            </div>
          </div>
          <div class="fp-aisle4-passageway" style="font-size: 0.55rem; padding: 2px 1px; margin: 2px 0;">⬅ way to access 7,8 aisles</div>
          <div class="fp-vertical-bays" style="padding: 2px;">
            <div class="fp-rack-col">
              ${generateRackCells("4", 43, 61, 1, highlightAisle, highlightRack, "cell-a4")}
            </div>
            <div class="fp-center-walkway-col"><span style="font-size: 0.55rem;">WAY</span></div>
            <div class="fp-rack-col">
              ${generateRackCells("4", 19, 1, -1, highlightAisle, highlightRack, "cell-a4")}
            </div>
          </div>
        `;
      } else if (["1", "2", "3"].includes(aId) || (aId && ["1","2","3"].some(x => item.id.includes("aisle-" + x)))) {
        const thisAisleId = aId || "1";
        const cellClass = `cell-a${thisAisleId}`;
        innerContent = `
          <div class="fp-aisle-header" style="flex-direction: column; text-align: center; padding: 2px 0;">
            <span style="font-size: 0.76rem;">${escapeHtml(item.label)}</span>
          </div>
          <div class="fp-vertical-bays" style="padding: 2px;">
            <div class="fp-rack-col">
              ${generateRackCells(thisAisleId, 31, 61, 1, highlightAisle, highlightRack, cellClass)}
            </div>
            <div class="fp-center-walkway-col"><span style="font-size: 0.55rem;">WAY</span></div>
            <div class="fp-rack-col">
              ${generateRackCells(thisAisleId, 31, 1, -1, highlightAisle, highlightRack, cellClass)}
            </div>
          </div>
        `;
      } else if (["5", "6"].includes(aId) || item.id.includes("aisle-5") || item.id.includes("aisle-6")) {
        const thisAisleId = aId || (item.id.includes("5") ? "5" : "6");
        innerContent = `
          <div class="fp-aisle-header" style="padding: 2px 4px;">
            <span style="font-size: 0.74rem;">${escapeHtml(item.label)}</span>
          </div>
          <div class="fp-rack-row" style="padding: 2px;">
            ${generateRackCells(thisAisleId, 1, 20, 1, highlightAisle, highlightRack, `cell-a${thisAisleId}`)}
          </div>
        `;
      } else if (item.type === "entrance" || item.id.includes("entrance")) {
        innerContent = `
          <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 4px; padding: 4px;">
            <div class="fp-you-are-here-badge">📍 YOU ARE HERE</div>
            <div style="font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
              <span>🚪</span>
              <span>${escapeHtml(item.label)}</span>
            </div>
            <div style="font-size: 0.68rem; opacity: 0.85;">${escapeHtml(item.subtitle || "Primary Store Entrance")}</div>
          </div>
        `;
      } else {
        // Walkway, POS, or custom facility
        innerContent = `
          <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4px;">
            <span style="font-weight: 700; font-size: 0.76rem;">${escapeHtml(item.label)}</span>
            ${item.subtitle ? `<span style="font-size: 0.65rem; opacity: 0.8;">${escapeHtml(item.subtitle)}</span>` : ""}
          </div>
        `;
      }

      html += `
        <div class="fp-aisle-block" id="fp-elem-${item.id}" style="position: absolute; left: ${item.x}px; top: ${item.y}px; width: ${item.width}px; height: ${item.height}px; background: ${item.bg || 'rgba(30, 41, 59, 0.8)'}; border: 2px solid ${item.color || '#94A3B8'}; border-radius: 6px; overflow: hidden; box-sizing: border-box;">
          ${innerContent}
        </div>
      `;
    });

    html += `</div>`;
  } else {
    // DEFAULT STATIC GRID BLUEPRINT
    html = `
      <div class="floorplan-store-grid">
        <div class="fp-back-walkway-container">
          <div style="font-size: 0.72rem; color: var(--text-muted); text-align: center; font-weight: 600;">
            🏪 Rear Wall
          </div>
          <div class="fp-back-walkway">
            way &bull; Rear Walkway (Connects Aisles 4, 3, 2)
          </div>
          <div class="fp-closed-wall" title="Aisle 1 is walled off at the rear. Shoppers must use the front corridor.">
            🚫 Aisle 1 (Closed at Top)
          </div>
        </div>

        <div class="floorplan-main-section">
          <div class="floorplan-horizontal-section">
            <!-- Aisle 8 -->
            <div class="fp-aisle-block fp-horizontal-aisle fp-aisle-8-theme ${targetAisle === 'all' || targetAisle === '8' ? 'highlighted' : ''}" id="fp-aisle-8">
              <div class="fp-aisle-header">
                <span>🧼 Asile 8: Personal Care & Household</span>
                <span class="fp-aisle-badge badge-a8">Blue Zone &bull; Racks 1-62</span>
              </div>
              <div class="fp-horizontal-bays">
                <div class="fp-rack-row">${generateRackCells("8", 31, 1, -1, highlightAisle, highlightRack, "cell-a8")}</div>
                <div class="fp-walkway-strip">way &bull; Aisle 8 Corridor ➔ Direct Access to Aisle 4</div>
                <div class="fp-rack-row">${generateRackCells("8", 32, 62, 1, highlightAisle, highlightRack, "cell-a8")}</div>
              </div>
            </div>

            <!-- Aisle 7 -->
            <div class="fp-aisle-block fp-horizontal-aisle fp-aisle-7-theme ${targetAisle === 'all' || targetAisle === '7' ? 'highlighted' : ''}" id="fp-aisle-7">
              <div class="fp-aisle-header">
                <span>☕ Asile 7: Tea & Beverages</span>
                <span class="fp-aisle-badge badge-a7">Teal Zone &bull; Racks 1-62</span>
              </div>
              <div class="fp-horizontal-bays">
                <div class="fp-rack-row">${generateRackCells("7", 31, 1, -1, highlightAisle, highlightRack, "cell-a7")}</div>
                <div class="fp-walkway-strip">way &bull; Aisle 7 Corridor</div>
                <div class="fp-rack-row">${generateRackCells("7", 32, 62, 1, highlightAisle, highlightRack, "cell-a7")}</div>
              </div>
            </div>

            <!-- Aisles 5 & 6 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
              <div class="fp-aisle-block ${targetAisle === 'all' || targetAisle === '5' ? 'highlighted' : ''}" id="fp-aisle-5" style="border-left: 4px solid #F57C00;">
                <div class="fp-aisle-header"><span>🧈 Aisle 5</span><span class="fp-aisle-badge" style="background: rgba(245,124,0,0.2); color: #FDBA74;">Dairy & Oils</span></div>
                <div class="fp-rack-row">${generateRackCells("5", 1, 20, 1, highlightAisle, highlightRack, "cell-a5")}</div>
              </div>
              <div class="fp-aisle-block ${targetAisle === 'all' || targetAisle === '6' ? 'highlighted' : ''}" id="fp-aisle-6" style="border-left: 4px solid #8E24AA;">
                <div class="fp-aisle-header"><span>🫙 Aisle 6</span><span class="fp-aisle-badge" style="background: rgba(142,36,170,0.2); color: #E879F9;">Pickles & Sauces</span></div>
                <div class="fp-rack-row">${generateRackCells("6", 1, 20, 1, highlightAisle, highlightRack, "cell-a6")}</div>
              </div>
            </div>
          </div>

          <div class="fp-ramp-connector">
            <span>⬅ RAMP TO AISLES 7 & 8 ⬅</span>
          </div>

          <div class="floorplan-vertical-section">
            <!-- Aisle 4 -->
            <div class="fp-aisle-block fp-vertical-aisle fp-aisle-4-theme ${targetAisle === 'all' || targetAisle === '4' ? 'highlighted' : ''}" id="fp-aisle-4">
              <div class="fp-aisle-header" style="flex-direction: column; text-align: center;">
                <div style="font-weight: 700;">4</div>
                <div style="font-size: 0.62rem;">🍬 Snacks</div>
                <div style="font-size: 0.55rem; color: #34D399;">▲ way</div>
              </div>
              <div class="fp-vertical-bays">
                <div class="fp-rack-col">${generateRackCells("4", 31, 42, 1, highlightAisle, highlightRack, "cell-a4")}</div>
                <div class="fp-center-walkway-col"><span>▲</span><span style="writing-mode: vertical-rl; transform: rotate(180deg);">WAY</span><span>▼</span></div>
                <div class="fp-rack-col">${generateRackCells("4", 31, 20, -1, highlightAisle, highlightRack, "cell-a4")}</div>
              </div>
              <div class="fp-aisle4-passageway">⬅ way to access 7,8 aisles</div>
              <div class="fp-vertical-bays">
                <div class="fp-rack-col">${generateRackCells("4", 43, 61, 1, highlightAisle, highlightRack, "cell-a4")}</div>
                <div class="fp-center-walkway-col"><span>▲</span><span style="writing-mode: vertical-rl; transform: rotate(180deg);">WAY</span><span>▼</span></div>
                <div class="fp-rack-col">${generateRackCells("4", 19, 1, -1, highlightAisle, highlightRack, "cell-a4")}</div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 0.4fr 1fr; gap: 2px; margin-top: 4px;">
                <div class="fp-pos-vertical-block">pos counter</div>
                <div class="fp-center-walkway-col" style="min-height: 80px;"><span style="writing-mode: vertical-rl; transform: rotate(180deg);">way</span></div>
                <div style="font-size: 0.6rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; border: 1px dashed rgba(148,163,184,0.2); border-radius: 3px;">lane</div>
              </div>
            </div>

            <!-- Aisles 3, 2, 1 -->
            ${["3", "2", "1"].map(aid => `
              <div class="fp-aisle-block fp-vertical-aisle fp-aisle-${aid}-theme ${targetAisle === 'all' || targetAisle === aid ? 'highlighted' : ''}" id="fp-aisle-${aid}">
                <div class="fp-aisle-header" style="flex-direction: column; text-align: center;">
                  <div style="font-weight: 700;">${aid === '1' ? 'Asile 1' : aid}</div>
                  <div style="font-size: 0.62rem;">${STORE_AISLES[aid]?.icon || ''} ${STORE_AISLES[aid]?.name.split('&')[0] || ''}</div>
                  <div style="font-size: 0.55rem; color: ${aid !== '1' ? '#34D399' : '#F87171'};">${aid !== '1' ? '▲ way' : '⛔ Closed'}</div>
                </div>
                <div class="fp-vertical-bays">
                  <div class="fp-rack-col">${generateRackCells(aid, 31, 61, 1, highlightAisle, highlightRack, `cell-a${aid}`)}</div>
                  <div class="fp-center-walkway-col"><span>${aid !== '1' ? '▲' : '⛔'}</span><span style="writing-mode: vertical-rl; transform: rotate(180deg);">WAY</span><span>▼</span></div>
                  <div class="fp-rack-col">${generateRackCells(aid, 31, 1, -1, highlightAisle, highlightRack, `cell-a${aid}`)}</div>
                </div>
                <div class="fp-walkway-strip" style="margin-top: 4px; font-size: 0.6rem;">▼ way</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="fp-front-section">
          <div class="fp-front-walkway">way &bull; Main Front Walkway Corridor</div>
          <div class="fp-entrance-large-block" id="fp-default-entrance">
            <div class="fp-you-are-here-badge">📍 YOU ARE HERE &bull; STORE ENTRANCE</div>
            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem;"><span>🚪</span><span>main store entrance</span></div>
            <div style="font-size: 0.72rem; color: #E9D5FF; font-weight: 500;">
              Primary Customer Entrance (Facing Aisles 1, 2, and 3)
            </div>
          </div>
        </div>
      </div>
    `;
  }

  canvas.innerHTML = html;

  // Attach click listeners to all rack cells
  canvas.querySelectorAll(".fp-rack-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const aId = cell.dataset.aisle;
      const rk = parseInt(cell.dataset.rack);
      
      // Clear previous spotlights
      canvas.querySelectorAll(".fp-rack-cell.spotlight").forEach(c => c.classList.remove("spotlight"));
      cell.classList.add("spotlight");

      let shelfName = `Shelf ${Math.ceil(rk / 6)}`;
      if (STORE_MAP_DATA && STORE_MAP_DATA.rackLookup) {
        const lk = STORE_MAP_DATA.rackLookup[`${aId}-${rk}`];
        if (lk && lk.shelf) shelfName = lk.shelf;
      }

      openRackDetailDrawer(aId, rk, shelfName);
    });
  });

  // If a spotlighted cell exists, scroll it into view smoothly
  if (highlightAisle && highlightRack) {
    const targetCell = canvas.querySelector(`.fp-rack-cell[data-aisle="${highlightAisle}"][data-rack="${highlightRack}"]`);
    if (targetCell) {
      targetCell.classList.add("spotlight");
      targetCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  } else {
    // When opening the map without a specific rack selected, automatically scroll to the Main Entrance
    setTimeout(() => {
      const entranceEl = canvas.querySelector(".fp-entrance-large-block, #fp-default-entrance, [id*='entrance']");
      if (entranceEl) {
        entranceEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 80);
  }
}

function renderMobileMap() {
  const container = document.getElementById("mobileMapContainer");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(STORE_AISLES).forEach(([id, meta]) => {
    const count = allProducts.filter(p => p.aisle === parseInt(id)).length;
    
    const row = document.createElement("div");
    row.className = "map-aisle-row";
    row.dataset.aisle = id;
    row.style.borderLeft = `5px solid ${meta.color}`;

    row.innerHTML = `
      <div class="map-aisle-left">
        <div class="map-aisle-icon-box" style="background: rgba(255, 255, 255, 0.05);">${meta.icon}</div>
        <div>
          <div class="map-aisle-title">Aisle ${id}: ${meta.name}</div>
          <div class="map-aisle-subtitle">${count} Products &bull; Racks 1-62</div>
        </div>
      </div>
      <span style="color: var(--accent-amber); font-size: 1.1rem;">➔</span>
    `;

    row.addEventListener("click", () => {
      setActiveAislePill(id);
      switchTab("searchView");
    });

    container.appendChild(row);
  });

  // Also render interactive 2D floorplan
  renderInteractiveStoreMap();
}

let searchDebounceTimer = null;

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  const dismissKeyboardBtn = document.getElementById("dismissKeyboardBtn");

  document.querySelectorAll(".lang-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const lang = button.dataset.lang;
      if (lang === "en") {
        headerLanguagePreference.en = true;
        headerLanguagePreference.te = false;
        headerLanguagePreference.hi = false;
      } else {
        headerLanguagePreference[lang] = !headerLanguagePreference[lang];
        headerLanguagePreference.en = false;
      }

      document.querySelectorAll(".lang-toggle-btn").forEach((toggle) => {
        const isActive = toggle.dataset.lang === "en"
          ? headerLanguagePreference.en
          : headerLanguagePreference[toggle.dataset.lang];
        toggle.classList.toggle("active", isActive);
      });

      renderProductList();
    });
  });

  if (dismissKeyboardBtn) {
    dismissKeyboardBtn.addEventListener("click", () => {
      searchInput.blur();
    });
  }

  window.addEventListener("blur", () => {
    flushPendingSearchLogOnLifecycleChange();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushPendingSearchLogOnLifecycleChange();
    }
  });

  window.addEventListener("beforeunload", () => {
    flushPendingSearchLogOnLifecycleChange();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(searchDebounceTimer);
      trackSearchQuery(searchInput.value);
      commitPendingSearchLog();
      searchInput.blur();
    }
  });

  searchInput.addEventListener("blur", () => {
    commitPendingSearchLog();
  });

  searchInput.addEventListener("input", () => {
    const val = searchInput.value;
    clearBtn.style.display = val ? "block" : "none";

    if (val && currentView !== "searchView") {
      switchTab("searchView");
    }

    applySearchAndFilter();

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      trackSearchQuery(searchInput.value);
    }, 600);
  });

  clearBtn.addEventListener("click", () => {
    commitPendingSearchLog();
    searchInput.value = "";
    clearBtn.style.display = "none";
    applySearchAndFilter();
    searchInput.focus({ preventScroll: true });
  });

  document.getElementById("menuToggleBtn").addEventListener("click", openDrawer);
  document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
  document.getElementById("drawerOverlay").addEventListener("click", (e) => {
    if (e.target.id === "drawerOverlay") closeDrawer();
  });

  document.querySelectorAll(".drawer-item").forEach(item => {
    item.addEventListener("click", () => {
      if (item.dataset.link) {
        closeDrawer();
        if (item.dataset.link === "map-editor.html") {
          window.open(item.dataset.link, "_blank");
        } else {
          window.location.href = item.dataset.link;
        }
        return;
      }

      const targetTab = item.dataset.tab;
      closeDrawer();
      switchTab(targetTab);
    });
  });

  document.getElementById("brandHomeBtn").addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    setActiveAislePill("all");
    switchTab("searchView");
    searchInput.focus({ preventScroll: true });
  });

  document.getElementById("langHintBar").addEventListener("click", (e) => {
    const chip = e.target.closest(".lang-chip");
    if (chip) {
      const query = chip.dataset.search;
      searchInput.value = query;
      clearBtn.style.display = "block";
      switchTab("searchView");
      applySearchAndFilter();
      trackSearchQuery(query);
      commitPendingSearchLog();
      searchInput.blur();
    }
  });

  const aisleSelect = document.getElementById("aisleSelect");
  if (aisleSelect) {
    aisleSelect.addEventListener("change", (e) => {
      setActiveAislePill(e.target.value);
      if (currentView !== "searchView") switchTab("searchView");
    });
  }

  // Store Map View Mode Toggle (2D Floorplan vs List)
  const btnMapFloorplan = document.getElementById("btnMapFloorplan");
  const btnMapList = document.getElementById("btnMapList");
  const floorplanWrapper = document.getElementById("interactiveFloorplanWrapper");
  const mapListContainer = document.getElementById("mobileMapContainer");

  if (btnMapFloorplan && btnMapList && floorplanWrapper && mapListContainer) {
    btnMapFloorplan.addEventListener("click", () => {
      btnMapFloorplan.classList.add("active");
      btnMapList.classList.remove("active");
      floorplanWrapper.style.display = "block";
      mapListContainer.style.display = "none";
      renderInteractiveStoreMap();
    });

    btnMapList.addEventListener("click", () => {
      btnMapList.classList.add("active");
      btnMapFloorplan.classList.remove("active");
      floorplanWrapper.style.display = "none";
      mapListContainer.style.display = "flex";
    });
  }

  // Quick Aisle Filter Pills
  document.querySelectorAll(".map-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".map-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeMapAisleFilter = pill.dataset.aisle || "all";
      renderInteractiveStoreMap(activeMapAisleFilter === "all" ? null : activeMapAisleFilter);
    });
  });

  // Spotlight Card Close Button
  const closeSpotlightBtn = document.getElementById("closeSpotlightBtn");
  if (closeSpotlightBtn) {
    closeSpotlightBtn.addEventListener("click", () => {
      const card = document.getElementById("mapSpotlightCard");
      if (card) card.style.display = "none";
      document.querySelectorAll(".fp-rack-cell.spotlight").forEach(c => c.classList.remove("spotlight"));
    });
  }

  // Rack Detail Drawer Close Button
  const closeRackDrawerBtn = document.getElementById("closeRackDrawerBtn");
  if (closeRackDrawerBtn) {
    closeRackDrawerBtn.addEventListener("click", () => {
      const drawer = document.getElementById("rackDetailDrawer");
      if (drawer) drawer.style.display = "none";
    });
  }

  // Setup Route Optimizer Events
  setupRouteOptimizerEvents();

  document.getElementById("aiAskBtnMobile").addEventListener("click", handleAiAskMobile);
}

function setupRouteOptimizerEvents() {
  const calculateBtn = document.getElementById("calculateRouteBtn");
  const sampleBtn = document.getElementById("sampleRouteBtn");
  const inputElem = document.getElementById("routeItemsInput");
  const algoSelect = document.getElementById("routeAlgorithmSelect");
  const statsBox = document.getElementById("routeStatsBox");
  const stepsContainer = document.getElementById("routeStepsContainer");

  if (sampleBtn && inputElem) {
    sampleBtn.addEventListener("click", () => {
      inputElem.value = "Turmeric, Basmati Rice, Amul Ghee, Paneer, Garam Masala, Wagh Bakri Tea, Soap";
    });
  }

  if (calculateBtn && inputElem && stepsContainer) {
    calculateBtn.addEventListener("click", () => {
      const rawText = inputElem.value.trim();
      if (!rawText) {
        stepsContainer.innerHTML = `<div style="text-align: center; color: #F87171; padding: 1rem;">Please enter at least one item.</div>`;
        return;
      }

      const items = rawText.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      const algorithm = algoSelect ? algoSelect.value : "linear-sweep";

      if (typeof optimizeShoppingRoute !== "function") {
        stepsContainer.innerHTML = `<div style="text-align: center; color: #F87171; padding: 1rem;">Route optimizer engine is initializing...</div>`;
        return;
      }

      const result = optimizeShoppingRoute(items, { algorithm });

      if (!result.success || result.route.length === 0) {
        if (statsBox) statsBox.style.display = "none";
        stepsContainer.innerHTML = `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.1rem; color: #FFA726; margin-bottom: 0.3rem;">⚠️ No matching products located</div>
            <div style="font-size: 0.85rem;">None of the items in your list could be found in the current store inventory. Try keywords like "Rice", "Turmeric", "Ghee", "Tea".</div>
          </div>
        `;
        return;
      }

      // Update Stats
      if (statsBox) {
        document.getElementById("routeStatTime").textContent = result.stats.totalTimeFormatted || `${result.stats.totalTime} min`;
        document.getElementById("routeStatAisles").textContent = result.stats.aisleCount || result.stats.aislesVisited.length;
        document.getElementById("routeStatCount").textContent = `${result.foundProducts}/${items.length}`;
        statsBox.style.display = "block";
      }

      // Render Steps
      stepsContainer.innerHTML = "";
      result.route.forEach((step, idx) => {
        const aisleMeta = STORE_AISLES[step.aisle] || { name: `Aisle ${step.aisle}`, icon: "📦", color: "#E65100" };
        const card = document.createElement("div");
        card.className = "product-card";
        card.style.borderLeft = `4px solid ${aisleMeta.color}`;

        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
            <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #10B981;" title="Mark as picked">
            <div style="font-weight: 700; color: #34D399; font-size: 0.88rem; min-width: 50px;">Step ${idx + 1}</div>
            <div class="product-info" style="flex: 1;">
              <div class="product-title" style="font-size: 0.9rem;">${escapeHtml(step.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">
                ${aisleMeta.icon} Aisle ${step.aisle}: ${aisleMeta.name} &bull; <strong>${escapeHtml(formatLocationRack(step.rack) || `Rack ${step.rack}`)}</strong>
              </div>
            </div>
            <button class="cookie-btn secondary" type="button" style="padding: 0.3rem 0.6rem; font-size: 0.72rem; white-space: nowrap;">🗺️ View</button>
          </div>
        `;

        const viewBtn = card.querySelector("button");
        if (viewBtn) {
          viewBtn.addEventListener("click", () => {
            showProductOnMap(step);
          });
        }

        stepsContainer.appendChild(card);
      });

      // Show unfound items if any
      if (result.unfoundProducts && result.unfoundProducts.length > 0) {
        const unfoundCard = document.createElement("div");
        unfoundCard.style.cssText = "background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: var(--radius-sm); padding: 0.6rem 0.8rem; font-size: 0.78rem; color: #FCA5A5; margin-top: 0.6rem;";
        unfoundCard.innerHTML = `<strong>Items not in catalog (${result.unfoundProducts.length}):</strong> ${escapeHtml(result.unfoundProducts.join(", "))}`;
        stepsContainer.appendChild(unfoundCard);
      }
    });
  }
}

function openDrawer() {
  document.getElementById("drawerOverlay").classList.add("active");
}

function closeDrawer() {
  document.getElementById("drawerOverlay").classList.remove("active");
}

function setActiveAislePill(id) {
  currentAisleFilter = id;

  const aisleSelect = document.getElementById("aisleSelect");
  if (aisleSelect) {
    aisleSelect.value = id || "all";
  }

  document.querySelectorAll(".aisle-pill").forEach(pill => {
    if (pill.dataset.aisle === id) pill.classList.add("active");
    else pill.classList.remove("active");
  });
  applySearchAndFilter();
}

function getInitialTab() {
  const hash = (window.location.hash || "").toLowerCase();
  if (hash === "#map" || hash === "#mapview") return "mapView";
  if (hash === "#route" || hash === "#routeview") return "routeView";
  if (hash === "#ai" || hash === "#aiview") return "aiView";
  if (hash === "#search" || hash === "#searchview") return "searchView";
  if (hash === "#insights" || hash === "#insightsview") return "insightsView";

  const saved = sessionStorage.getItem("bharath_bazar_active_tab");
  if (saved && ["searchView", "mapView", "routeView", "aiView", "insightsView"].includes(saved)) {
    return saved;
  }
  return "searchView";
}

function switchTab(tabId, updateHistory = true) {
  currentView = tabId;
  sessionStorage.setItem("bharath_bazar_active_tab", tabId);

  const hashMap = {
    searchView: "#search",
    mapView: "#map",
    routeView: "#route",
    aiView: "#ai",
    insightsView: "#insights"
  };

  if (updateHistory && hashMap[tabId]) {
    history.replaceState(null, "", hashMap[tabId]);
  }

  document.querySelectorAll(".view-panel").forEach(panel => {
    if (panel.id === tabId) panel.classList.add("active-view");
    else panel.classList.remove("active-view");
  });

  document.querySelectorAll(".drawer-item").forEach(item => {
    if (item.dataset.tab === tabId) item.classList.add("active");
    else item.classList.remove("active");
  });

  if (tabId === "mapView") {
    renderInteractiveStoreMap();
  }
}

function handleAiAskMobile() {
  const query = document.getElementById("aiQueryInputMobile").value.trim().toLowerCase();
  const box = document.getElementById("aiResponseBoxMobile");

  if (!query) {
    box.innerHTML = `<span style="color: #F87171;">Please enter a product query above.</span>`;
    return;
  }

  const matches = allProducts.filter(p => {
    return p.name.toLowerCase().includes(query) || 
           p.slug.toLowerCase().includes(query) || 
           p.aliases.some(a => a.toLowerCase().includes(query));
  });

  if (matches.length === 0) {
    box.innerHTML = `🤖 <strong>AI Navigator:</strong> No products matching "<em>${escapeHtml(query)}</em>" found.`;
  } else {
    const top = matches.slice(0, 3);
    let html = `🤖 <strong>AI Navigator:</strong> Found ${matches.length} item(s):<br><ul style="margin-top: 0.4rem; padding-left: 1rem;">`;
    top.forEach(m => {
      html += `<li style="margin-bottom: 0.3rem;"><strong>${escapeHtml(m.name)}</strong> ➔ <span style="color: var(--accent-amber); font-weight: bold;">📍 Aisle ${m.aisle} (${m.categoryName}) - ${escapeHtml(formatLocationRack(m.rack))}</span></li>`;
    });
    html += `</ul>`;
    box.innerHTML = html;
  }
}

function escapeHtml(str) {
  return String(str === null || str === undefined ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// -------------------------------------------------------------
// EXTRA LOCATIONS
// The public site is read-only: rack/aisle changes are made in the
// Google Sheet and arrive through the hourly sync.
// -------------------------------------------------------------
// "Also in Aisle 5 · Rack 47" - empty string when there is nothing extra to say.
function formatExtraLocations(extraLocations) {
  if (!Array.isArray(extraLocations) || !extraLocations.length) return "";
  const parts = extraLocations.map(l => {
    const rackLabel = formatLocationRack(l.rack);
    if (l.aisle && rackLabel) return `Aisle ${l.aisle} · ${rackLabel}`;
    if (l.aisle) return `Aisle ${l.aisle}`;
    return rackLabel;
  }).filter(Boolean);
  if (!parts.length) return "";
  return `\u{1F501} Also in ${parts.join(", ")}`;
}
