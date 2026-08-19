/**
 * Bharath Bazar Mobile-First Multilingual Store Inventory & Product Locator Logic
 * Single source of truth:
 * - Multilingual product catalog + aisle/category metadata: product_data.csv
 */

const DEFAULT_STORE_AISLES = {
  1: { name: "Spices & Masala", icon: "🌶️", color: "var(--aisle-1)", keywords: ["masala", "powder", "spice", "chili", "chilli", "coriander", "cumin", "turmeric", "seeds", "mdh", "everest", "laxmi", "curry", "garam", "hing", "salt", "jeera", "dhania", "haldi", "saunf", "methi", "cardamom", "clove", "cinnamon"] },
  2: { name: "Atta, Rice & Grains", icon: "🌾", color: "var(--aisle-2)", keywords: ["atta", "flour", "rice", "basmati", "sujata", "rava", "dal", "lentil", "chana", "moong", "toor", "urad", "wheat", "poha", "sooji", "besan", "maida", "matar", "rajma", "pulao", "biryani"] },
  3: { name: "Frozen Foods", icon: "❄️", color: "var(--aisle-3)", keywords: ["frozen", "paneer", "samosa", "naan", "kulcha", "vadilal", "tindora", "okra", "roti", "vegetable", "paratha", "cut-veg", "peas", "gobi", "tikka", "patra", "sweet-corn"] },
  4: { name: "Snacks & Sweets", icon: "🍬", color: "var(--aisle-4)", keywords: ["muruku", "murukku", "mix", "haldiram", "gulab", "jamun", "snack", "chevda", "laddu", "chips", "biscuit", "namkeen", "sweet", "cookie", "mathri", "bhujia", "khakhra", "chikki", "rasgulla"] },
  5: { name: "Dairy, Oils & Ghee", icon: "🧈", color: "var(--aisle-5)", keywords: ["ghee", "oil", "amul", "butter", "milk", "cheese", "paneer-raw", "mustard-oil", "sesame-oil", "sunflower", "coconut-oil", "dahi", "yogurt", "cream"] },
  6: { name: "Pickles, Sauces & Instant", icon: "🫙", color: "var(--aisle-6)", keywords: ["pickle", "sauce", "chutney", "paste", "mtr", "ready", "gravy", "chings", "noodle", "soup", "papad", "achaar", "schezwan", "ketchup", "soy"] },
  7: { name: "Tea & Beverages", icon: "☕", color: "var(--aisle-7)", keywords: ["tea", "chai", "coffee", "drink", "badam", "label", "wagh", "bakri", "juice", "syrup", "rooh", "afza", "sharbat", "thums", "limca", "maaza", "bournvita", "horlicks"] },
  8: { name: "Personal Care & Household", icon: "🧼", color: "var(--aisle-8)", keywords: ["dettol", "soap", "herbal", "shampoo", "incense", "agarbatti", "puja", "cleaner", "toothpaste", "dabur", "patanjali", "neem", "oil-hair", "face"] }
};

// Global State Data Containers (Populated asynchronously from data files)
let MULTILINGUAL_DICTIONARY = {};
let STORE_AISLES = { ...DEFAULT_STORE_AISLES };
let allProducts = [];
let filteredProducts = [];
let locationOverrides = {};
let searchAnalytics = {};
let currentAisleFilter = "all";
let currentView = "searchView";
let isStaffLoggedIn = false;
let visitorProfile = null;
let deviceAnalyticsList = [];
let headerLanguagePreference = { en: true, te: false, hi: false };
let pendingSearchLog = null;
let pendingSearchTimer = null;
let lastSubmittedSearch = "";
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

// -------------------------------------------------------------
// ASYNCHRONOUS DATA LOADERS (Separating Data from Code)
// -------------------------------------------------------------
async function loadExternalDataFiles() {
  try {
    STORE_AISLES = { ...DEFAULT_STORE_AISLES };

    const csvResponse = await fetch("product_data.csv");
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

        return {
          id: idx,
          slug: slug,
          name: name,
          aisle: loc.aisle,
          rack: loc.rack,
          categoryName: loc.categoryName,
          icon: loc.icon,
          aliases: aliases,
          translations: translations
        };
      });

      const totalBadge = document.getElementById("totalBadge");
      if (totalBadge) {
        totalBadge.textContent = `Catalog`;
      }
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

    const aisle = parseInt(aisleVal, 10);
    const rack = parseInt(rackVal, 10);
    const keywords = parseKeywords(keywordsStr || categoryKeywords);
    const resolvedCategory = category || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.name || "" : "");
    const derivedAisleName = explicitAisleName || resolvedCategory || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.name || `Aisle ${aisle}` : "");

    MULTILINGUAL_DICTIONARY[key] = {
      en: en,
      te: te,
      hi: hi,
      keywords: keywords,
      category: resolvedCategory,
      categories: resolvedCategory,
      category_keywords: categoryKeywords,
      aisle: Number.isInteger(aisle) && aisle > 0 ? aisle : null,
      aisle_name: derivedAisleName,
      aisle_icon: explicitAisleIcon || (Number.isInteger(aisle) && aisle > 0 ? DEFAULT_STORE_AISLES[aisle]?.icon || "" : ""),
      rack: Number.isInteger(rack) && rack > 0 ? rack : null
    };
  }
}

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function categorizeProduct(slug) {
  const lower = slug.toLowerCase();

  if (locationOverrides[slug]) {
    const ov = locationOverrides[slug];
    const aisleData = STORE_AISLES[ov.aisle] || { name: "General Aisle", icon: "📦" };
    return { aisle: ov.aisle, rack: ov.rack, categoryName: aisleData.name, icon: aisleData.icon };
  }

  if (MULTILINGUAL_DICTIONARY[lower] && MULTILINGUAL_DICTIONARY[lower].aisle) {
    const dict = MULTILINGUAL_DICTIONARY[lower];
    const aisleData = STORE_AISLES[dict.aisle] || { name: dict.aisle_name || "General Aisle", icon: dict.aisle_icon || "📦" };
    const rack = dict.rack || ((getHash(slug) % 30) + 1);
    return { aisle: dict.aisle, rack: rack, categoryName: aisleData.name, icon: aisleData.icon };
  }

  let assignedAisle = 1;
  for (const [id, meta] of Object.entries(STORE_AISLES)) {
    if (meta.keywords && meta.keywords.some(kw => lower.includes(kw))) {
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
  checkAuthSession();

  // Async load data from decoupled files
  await loadExternalDataFiles();

  setupEventListeners();
  renderMobileMap();
  applySearchAndFilter();
  renderAnalyticsList();
  renderDeviceAnalyticsDashboard();

  setTimeout(() => {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.focus({ preventScroll: true });
    }
  }, 300);
});

function loadStorageData() {
  try {
    const savedLoc = localStorage.getItem("bharath_bazar_location_overrides");
    if (savedLoc) locationOverrides = JSON.parse(savedLoc);

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
    localStorage.setItem("bharath_bazar_location_overrides", JSON.stringify(locationOverrides));
    localStorage.setItem("bharath_bazar_search_analytics", JSON.stringify(searchAnalytics));
  } catch (e) {}
}

function flushPendingSearchLog() {
  if (!pendingSearchLog || !SEARCH_FORM_ENTRY_IDS.query) return;

  const query = String(pendingSearchLog).trim();
  if (!query) return;

  const deviceId = visitorProfile?.deviceId || visitorProfile?.visitorId || "unknown-device";
  const payload = `${query} | deviceId=${deviceId}`;

  const formData = new URLSearchParams();
  formData.append(SEARCH_FORM_ENTRY_IDS.query, payload);

  if (lastSubmittedSearch === payload) return;

  lastSubmittedSearch = payload;
  pendingSearchLog = null;

  const encodedBody = formData.toString();

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([encodedBody], {
        type: "application/x-www-form-urlencoded;charset=UTF-8"
      });
      navigator.sendBeacon(SEARCH_FORM_SUBMIT_URL, blob);
      return;
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

function flushPendingSearchLogOnLifecycleChange() {
  if (pendingSearchLog) {
    flushPendingSearchLog();
  }
}

function scheduleSearchLog(query) {
  if (!query || query.length < 2) return;

  pendingSearchLog = query.toLowerCase().trim();
  if (pendingSearchTimer) clearTimeout(pendingSearchTimer);

  flushPendingSearchLog();
}

function postSearchQueryToGoogleForm(query) {
  scheduleSearchLog(query);
}

function trackSearchQuery(query) {
  if (!query || query.length < 2) return;
  const term = query.toLowerCase().trim();
  searchAnalytics[term] = (searchAnalytics[term] || 0) + 1;
  saveStorageData();
  updateVisitorSearches(term);
  scheduleSearchLog(term);
  renderAnalyticsList();
  renderDeviceAnalyticsDashboard();
}

function renderAnalyticsList() {
  const container = document.getElementById("analyticsList");
  if (!container) return;

  const deviceId = visitorProfile?.deviceId || visitorProfile?.visitorId || "unknown-device";
  const sorted = Object.entries(searchAnalytics).sort((a, b) => b[1] - a[1]).slice(0, 10);

  container.innerHTML = sorted.map(([term, count]) => `
    <li style="margin-bottom: 0.4rem;">
      <strong style="text-transform: capitalize; color: #FFF;">${escapeHtml(term)}</strong>: 
      <span style="color: var(--accent-amber); font-weight: 700;">${count} searches</span>
      <span style="display: block; margin-top: 0.2rem; font-size: 0.72rem; color: var(--text-muted);">
        Device: ${escapeHtml(deviceId)}
      </span>
    </li>
  `).join("");
}

function renderDeviceAnalyticsDashboard() {
  const container = document.getElementById("deviceAnalyticsContainer");
  if (!container) return;

  let savedLog = localStorage.getItem("bharath_bazar_device_log");
  let devices = savedLog ? JSON.parse(savedLog) : [];

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

function checkAuthSession() {
  try {
    isStaffLoggedIn = sessionStorage.getItem("bharath_bazar_staff_authed") === "true";
    updateAuthUI();
  } catch (e) {}
}

function updateAuthUI() {
  const menuText = document.getElementById("menuAdminText");
  if (menuText) {
    menuText.textContent = isStaffLoggedIn ? "Staff Admin Portal (Logged In)" : "Staff Portal (Edit Access Open)";
  }
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
        <span class="loc-rack-text">Rack ${p.rack}</span>
      </div>
    `;

    card.querySelector(".loc-badge-mobile").addEventListener("click", () => {
      openMobileEditModal(p.slug);
    });

    container.appendChild(card);
  });
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
          <div class="map-aisle-subtitle">${count} Products &bull; Racks 1-30</div>
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
      searchInput.blur();
    }
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
      trackSearchQuery(val);
    }, 600);
  });

  clearBtn.addEventListener("click", () => {
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
        window.location.href = item.dataset.link;
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

  document.getElementById("aiAskBtnMobile").addEventListener("click", handleAiAskMobile);
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

function switchTab(tabId) {
  currentView = tabId;

  document.querySelectorAll(".view-panel").forEach(panel => {
    if (panel.id === tabId) panel.classList.add("active-view");
    else panel.classList.remove("active-view");
  });

  document.querySelectorAll(".drawer-item").forEach(item => {
    if (item.dataset.tab === tabId) item.classList.add("active");
    else item.classList.remove("active");
  });
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
      html += `<li style="margin-bottom: 0.3rem;"><strong>${escapeHtml(m.name)}</strong> ➔ <span style="color: var(--accent-amber); font-weight: bold;">📍 Aisle ${m.aisle} (${m.categoryName}) - Rack ${m.rack}</span></li>`;
    });
    html += `</ul>`;
    box.innerHTML = html;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
