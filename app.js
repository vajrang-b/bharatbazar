/**
 * Bharath Bazar Mobile-First Multilingual Store Inventory & Product Locator Logic
 * Supports English, Telugu, and Hindi search transliterations, Viewport Bottom Search,
 * Smooth Keyboard Handling, and Anonymous Device & Visitor Profile Analytics.
 */

// Multilingual Search Alias Dictionary (English, Hindi, Telugu)
const MULTILINGUAL_DICTIONARY = {
  "turmeric": { en: "Turmeric", te: "Pasupu (పసుపు)", hi: "Haldi (हल्दी)", keywords: ["turmeric", "haldi", "pasupu"] },
  "haldi": { en: "Turmeric", te: "Pasupu", hi: "Haldi", keywords: ["turmeric", "haldi", "pasupu"] },
  "pasupu": { en: "Turmeric", te: "Pasupu", hi: "Haldi", keywords: ["turmeric", "haldi", "pasupu"] },

  "cumin": { en: "Cumin Seeds", te: "Jilakarra (జిలకర)", hi: "Jeera (जीरा)", keywords: ["cumin", "jeera", "jilakarra"] },
  "jeera": { en: "Cumin Seeds", te: "Jilakarra", hi: "Jeera", keywords: ["cumin", "jeera", "jilakarra"] },
  "jilakarra": { en: "Cumin Seeds", te: "Jilakarra", hi: "Jeera", keywords: ["cumin", "jeera", "jilakarra"] },

  "coriander": { en: "Coriander", te: "Dhaniyalu / Kotthimera", hi: "Dhania", keywords: ["coriander", "dhania", "dhaniyalu", "kotthimera"] },
  "dhania": { en: "Coriander", te: "Dhaniyalu", hi: "Dhania", keywords: ["coriander", "dhania", "dhaniyalu"] },
  "dhaniyalu": { en: "Coriander", te: "Dhaniyalu", hi: "Dhania", keywords: ["coriander", "dhania", "dhaniyalu"] },

  "curd": { en: "Yogurt / Curd", te: "Perugu (పెరుగు)", hi: "Dahi (दही)", keywords: ["curd", "yogurt", "dahi", "perugu", "milk"] },
  "dahi": { en: "Yogurt / Curd", te: "Perugu", hi: "Dahi", keywords: ["curd", "yogurt", "dahi", "perugu", "milk"] },
  "perugu": { en: "Yogurt / Curd", te: "Perugu", hi: "Dahi", keywords: ["curd", "yogurt", "dahi", "perugu", "milk"] },
  "milk": { en: "Milk & Dairy", te: "Palu / Perugu", hi: "Doodh / Dahi", keywords: ["milk", "dahi", "perugu", "doodh", "dairy", "paneer"] },

  "ghee": { en: "Clarified Butter", te: "Neyyi (నెయ్యి)", hi: "Ghee (घी)", keywords: ["ghee", "neyyi", "clarified-butter"] },
  "neyyi": { en: "Clarified Butter", te: "Neyyi", hi: "Ghee", keywords: ["ghee", "neyyi"] },

  "rice": { en: "Rice / Basmati", te: "Biyyam (బియ్యం)", hi: "Chawal (चावल)", keywords: ["rice", "basmati", "chawal", "biyyam"] },
  "chawal": { en: "Rice", te: "Biyyam", hi: "Chawal", keywords: ["rice", "chawal", "biyyam"] },
  "biyyam": { en: "Rice", te: "Biyyam", hi: "Chawal", keywords: ["rice", "biyyam", "chawal"] },

  "atta": { en: "Wheat Flour", te: "Godhumapindi", hi: "Atta", keywords: ["atta", "flour", "godhumapindi"] },

  "sugar": { en: "Sugar", te: "Panchadara / Chakkera", hi: "Chini", keywords: ["sugar", "chini", "panchadara", "chakkera"] },
  "chini": { en: "Sugar", te: "Panchadara", hi: "Chini", keywords: ["sugar", "chini", "panchadara"] },
  "panchadara": { en: "Sugar", te: "Panchadara", hi: "Chini", keywords: ["sugar", "panchadara", "chini"] },

  "jaggery": { en: "Jaggery", te: "Bellam (బెల్లం)", hi: "Gud (गुड़)", keywords: ["jaggery", "gud", "bellam"] },
  "gud": { en: "Jaggery", te: "Bellam", hi: "Gud", keywords: ["jaggery", "gud", "bellam"] },
  "bellam": { en: "Jaggery", te: "Bellam", hi: "Gud", keywords: ["jaggery", "bellam", "gud"] },

  "garlic": { en: "Garlic", te: "Vellulli", hi: "Lahsun", keywords: ["garlic", "lahsun", "vellulli"] },
  "onion": { en: "Onion", te: "Ullipaya / Erragaddalu", hi: "Pyaz", keywords: ["onion", "pyaz", "ullipaya", "erragaddalu"] },
  "ginger": { en: "Ginger", te: "Allam", hi: "Adrak", keywords: ["ginger", "adrak", "allam"] },
  "mustard": { en: "Mustard", te: "Aavalu", hi: "Rai", keywords: ["mustard", "rai", "aavalu"] },
  "paneer": { en: "Cottage Cheese", te: "Paneer", hi: "Paneer", keywords: ["paneer", "cottage-cheese"] }
};

// Store Aisles Metainfo (8 Aisles)
const STORE_AISLES = {
  1: { name: "Spices & Masala", icon: "🌶️", color: "var(--aisle-1)", keywords: ["masala", "powder", "spice", "chili", "chilli", "coriander", "cumin", "turmeric", "seeds", "mdh", "everest", "laxmi", "curry", "garam", "hing", "salt", "jeera", "dhania", "haldi", "saunf", "methi", "cardamom", "clove", "cinnamon"] },
  2: { name: "Atta, Rice & Grains", icon: "🌾", color: "var(--aisle-2)", keywords: ["atta", "flour", "rice", "basmati", "sujata", "rava", "dal", "lentil", "chana", "moong", "toor", "urad", "wheat", "poha", "sooji", "besan", "maida", "matar", "rajma", "pulao", "biryani"] },
  3: { name: "Frozen Foods", icon: "❄️", color: "var(--aisle-3)", keywords: ["frozen", "paneer", "samosa", "naan", "kulcha", "vadilal", "tindora", "okra", "roti", "vegetable", "paratha", "cut-veg", "peas", "gobi", "tikka", "patra", "sweet-corn"] },
  4: { name: "Snacks & Sweets", icon: "🍬", color: "var(--aisle-4)", keywords: ["muruku", "murukku", "mix", "haldiram", "gulab", "jamun", "snack", "chevda", "laddu", "chips", "biscuit", "namkeen", "sweet", "cookie", "mathri", "bhujia", "khakhra", "chikki", "rasgulla"] },
  5: { name: "Dairy, Oils & Ghee", icon: "🧈", color: "var(--aisle-5)", keywords: ["ghee", "oil", "amul", "butter", "milk", "cheese", "paneer-raw", "mustard-oil", "sesame-oil", "sunflower", "coconut-oil", "dahi", "yogurt", "cream"] },
  6: { name: "Pickles, Sauces & Instant", icon: "🫙", color: "var(--aisle-6)", keywords: ["pickle", "sauce", "chutney", "paste", "mtr", "ready", "gravy", "chings", "noodle", "soup", "papad", "pickle", "achaar", "schezwan", "ketchup", "soy"] },
  7: { name: "Tea & Beverages", icon: "☕", color: "var(--aisle-7)", keywords: ["tea", "chai", "coffee", "drink", "badam", "label", "wagh", "bakri", "juice", "syrup", "rooh", "afza", "sharbat", "thums", "limca", "maaza", "bournvita", "horlicks"] },
  8: { name: "Personal Care & Household", icon: "🧼", color: "var(--aisle-8)", keywords: ["dettol", "soap", "herbal", "shampoo", "incense", "agarbatti", "puja", "cleaner", "toothpaste", "dabur", "patanjali", "neem", "oil-hair", "face"] }
};

// Application State
let allProducts = [];
let filteredProducts = [];
let locationOverrides = {};
let searchAnalytics = {};
let currentAisleFilter = "all";
let currentView = "searchView";
let isStaffLoggedIn = false;
let visitorProfile = null;
let deviceAnalyticsList = [];

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
    return { aisle: ov.aisle, rack: ov.rack, categoryName: STORE_AISLES[ov.aisle].name, icon: STORE_AISLES[ov.aisle].icon };
  }

  let assignedAisle = 1;
  for (const [id, meta] of Object.entries(STORE_AISLES)) {
    if (meta.keywords.some(kw => lower.includes(kw))) {
      assignedAisle = parseInt(id);
      break;
    }
  }

  const rack = (getHash(slug) % 30) + 1;
  return { aisle: assignedAisle, rack: rack, categoryName: STORE_AISLES[assignedAisle].name, icon: STORE_AISLES[assignedAisle].icon };
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

  return {
    deviceType,
    os,
    browser,
    screenRes,
    isTouch
  };
}

function initVisitorProfile() {
  try {
    const info = detectDeviceProfile();
    let saved = localStorage.getItem("bharath_bazar_visitor_profile");

    if (saved) {
      visitorProfile = JSON.parse(saved);
      visitorProfile.visitCount = (visitorProfile.visitCount || 1) + 1;
      visitorProfile.lastVisit = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      const randomID = 'BB-DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      visitorProfile = {
        visitorId: randomID,
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

document.addEventListener("DOMContentLoaded", async () => {
  loadStorageData();
  initVisitorProfile();
  checkAuthSession();
  await loadProductData();
  setupEventListeners();
  renderMobileMap();
  applySearchAndFilter();
  renderAnalyticsList();
  renderDeviceAnalyticsDashboard();

  // Gentle auto-focus without forcing scroll layout jump
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
      searchAnalytics = {
        "turmeric": 142,
        "paneer": 98,
        "jeera": 87,
        "basmati": 76,
        "milk": 65,
        "dettol": 54
      };
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

function trackSearchQuery(query) {
  if (!query || query.length < 2) return;
  const term = query.toLowerCase().trim();
  searchAnalytics[term] = (searchAnalytics[term] || 0) + 1;
  saveStorageData();
  updateVisitorSearches(term);
  renderAnalyticsList();
  renderDeviceAnalyticsDashboard();
}

function renderAnalyticsList() {
  const container = document.getElementById("analyticsList");
  if (!container) return;

  const sorted = Object.entries(searchAnalytics).sort((a, b) => b[1] - a[1]).slice(0, 10);
  container.innerHTML = sorted.map(([term, count]) => `
    <li style="margin-bottom: 0.4rem;">
      <strong style="text-transform: capitalize; color: #FFF;">${escapeHtml(term)}</strong>: 
      <span style="color: var(--accent-amber); font-weight: 700;">${count} searches</span>
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
    menuText.textContent = isStaffLoggedIn ? "Staff Admin Portal (Logged In)" : "Staff Portal (Login)";
  }
}

async function loadProductData() {
  try {
    const response = await fetch("product_names.json");
    if (!response.ok) throw new Error("Failed to fetch product_names.json");
    const rawSlugs = await response.json();

    allProducts = rawSlugs.map((slug, idx) => {
      const loc = categorizeProduct(slug);
      const name = formatProductName(slug);
      const aliases = getMultilingualAliases(slug, name);
      return {
        id: idx,
        slug: slug,
        name: name,
        aisle: loc.aisle,
        rack: loc.rack,
        categoryName: loc.categoryName,
        icon: loc.icon,
        aliases: aliases
      };
    });

    document.getElementById("totalBadge").textContent = `${allProducts.length.toLocaleString()} Items`;
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

function formatProductName(slug) {
  let clean = slug.replace(/^[0-9]{6,14}/, "").replace(/-/g, " ").trim();
  if (!clean) clean = slug.replace(/-/g, " ");
  return clean.replace(/\b\w/g, l => l.toUpperCase());
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
      const text = `${p.slug} ${p.name} ${p.aliases.join(" ")}`.toLowerCase();
      return expandedKeywords.some(kw => text.includes(kw));
    }

    return true;
  });

  renderProductList();
}

function renderProductList() {
  const container = document.getElementById("productListContainer");
  container.innerHTML = "";

  const total = filteredProducts.length;
  document.getElementById("resultsCount").textContent = `${total.toLocaleString()} products found`;

  if (total === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 No matching items</p>
        <p style="font-size: 0.85rem;">Try searching in English, Telugu (e.g. <em>Pasupu</em>, <em>Perugu</em>), or Hindi (e.g. <em>Haldi</em>, <em>Jeera</em>).</p>
      </div>
    `;
    return;
  }

  const displayItems = filteredProducts.slice(0, 80);

  displayItems.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    let aliasHtml = "";
    if (p.aliases.length > 0) {
      aliasHtml = `<div class="product-multilingual-tags">
        ${p.aliases.map(a => `<span class="alias-chip">${escapeHtml(a)}</span>`).join("")}
      </div>`;
    }

    card.innerHTML = `
      <div class="product-info">
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-slug-tag">${p.icon} ${escapeHtml(p.categoryName)}</div>
        ${aliasHtml}
      </div>
      <div class="loc-badge-mobile" data-slug="${escapeHtml(p.slug)}">
        <span class="loc-aisle-text">📍 Aisle ${p.aisle}</span>
        <span class="loc-rack-text">Rack ${p.rack}</span>
      </div>
    `;

    card.querySelector(".loc-badge-mobile").addEventListener("click", () => {
      if (isStaffLoggedIn) {
        openMobileEditModal(p.slug);
      } else {
        openLoginModal();
      }
    });

    container.appendChild(card);
  });
}

function renderMobileMap() {
  const container = document.getElementById("mobileMapContainer");
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

  // CRITICAL FIX: REMOVED window 'scroll' blur listener that was prematurely closing the mobile keyboard!
  // Keyboard will only be blurred on explicit action (Dismiss button, Enter key, or suggestion chip tap).

  if (dismissKeyboardBtn) {
    dismissKeyboardBtn.addEventListener("click", () => {
      searchInput.blur();
    });
  }

  // Enter key dismisses virtual keyboard cleanly
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
      const targetTab = item.dataset.tab;
      closeDrawer();

      if (targetTab === "adminView" && !isStaffLoggedIn) {
        openLoginModal();
      } else {
        switchTab(targetTab);
      }
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

  document.getElementById("aisleCarousel").addEventListener("click", (e) => {
    const pill = e.target.closest(".aisle-pill");
    if (pill) {
      setActiveAislePill(pill.dataset.aisle);
      if (currentView !== "searchView") switchTab("searchView");
    }
  });

  document.getElementById("closeLoginModalBtn").addEventListener("click", closeLoginModal);
  document.getElementById("staffLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("loginUsernameInput").value.trim();
    const pass = document.getElementById("loginPasswordInput").value.trim();
    const errorMsg = document.getElementById("loginErrorMsg");

    if (user.toLowerCase() === "admin" && (pass === "bharath123" || pass === "1234" || pass === "admin")) {
      isStaffLoggedIn = true;
      try {
        sessionStorage.setItem("bharath_bazar_staff_authed", "true");
      } catch (err) {}
      updateAuthUI();
      closeLoginModal();
      switchTab("adminView");
      renderDeviceAnalyticsDashboard();
      errorMsg.style.display = "none";
    } else {
      errorMsg.style.display = "block";
    }
  });

  document.getElementById("staffLogoutBtn").addEventListener("click", () => {
    isStaffLoggedIn = false;
    try {
      sessionStorage.removeItem("bharath_bazar_staff_authed");
    } catch (err) {}
    updateAuthUI();
    switchTab("searchView");
    alert("Logged out of Staff Portal.");
  });

  document.getElementById("closeEditModalMobileBtn").addEventListener("click", closeMobileEditModal);
  
  document.getElementById("quickEditBtn").addEventListener("click", () => {
    if (allProducts.length > 0) {
      openMobileEditModal(allProducts[0].slug);
    }
  });

  document.getElementById("editFormMobile").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isStaffLoggedIn) {
      openLoginModal();
      return;
    }

    const slug = document.getElementById("editSlugMobile").value;
    const newAisle = parseInt(document.getElementById("editAisleMobile").value);
    const newRack = parseInt(document.getElementById("editRackMobile").value);

    locationOverrides[slug] = { aisle: newAisle, rack: newRack };
    saveStorageData();

    const p = allProducts.find(item => item.slug === slug);
    if (p) {
      p.aisle = newAisle;
      p.rack = newRack;
      p.categoryName = STORE_AISLES[newAisle].name;
      p.icon = STORE_AISLES[newAisle].icon;
    }

    closeMobileEditModal();
    renderMobileMap();
    applySearchAndFilter();
    alert(`Updated location for ${p ? p.name : slug} to Aisle ${newAisle}, Rack ${newRack}`);
  });

  document.getElementById("aiAskBtnMobile").addEventListener("click", handleAiAskMobile);
}

function openDrawer() {
  document.getElementById("drawerOverlay").classList.add("active");
}

function closeDrawer() {
  document.getElementById("drawerOverlay").classList.remove("active");
}

function openLoginModal() {
  document.getElementById("loginErrorMsg").style.display = "none";
  document.getElementById("loginUsernameInput").value = "";
  document.getElementById("loginPasswordInput").value = "";
  document.getElementById("loginModalSheet").classList.add("active");
}

function closeLoginModal() {
  document.getElementById("loginModalSheet").classList.remove("active");
}

function setActiveAislePill(id) {
  currentAisleFilter = id;
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

function openMobileEditModal(slug) {
  const p = allProducts.find(item => item.slug === slug);
  if (!p) return;

  document.getElementById("editSlugMobile").value = slug;
  document.getElementById("editNameMobile").value = p.name;
  document.getElementById("editAisleMobile").value = p.aisle;
  document.getElementById("editRackMobile").value = p.rack;

  document.getElementById("editModalMobile").classList.add("active");
}

function closeMobileEditModal() {
  document.getElementById("editModalMobile").classList.remove("active");
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
