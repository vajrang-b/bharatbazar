/**
 * Bharath Bazar Mobile-First Multilingual Store Inventory & Product Locator Logic
 * Data & Code completely decoupled:
 * - Products: product_names.json
 * - Multilingual Dictionary: multilingual_dictionary.csv
 * - Store Aisles: store_aisles.json
 */

// Global State Data Containers (Populated asynchronously from data files)
let MULTILINGUAL_DICTIONARY = {};
let STORE_AISLES = {};
let allProducts = [];
let filteredProducts = [];
let locationOverrides = {};
let searchAnalytics = {};
let currentAisleFilter = "all";
let currentView = "searchView";
let isStaffLoggedIn = false;
let visitorProfile = null;
let deviceAnalyticsList = [];

// -------------------------------------------------------------
// ASYNCHRONOUS DATA LOADERS (Separating Data from Code)
// -------------------------------------------------------------
async function loadExternalDataFiles() {
  try {
    // 1. Load Store Aisles Matrix JSON (or default constants)
    const aislesResponse = await fetch("store_aisles.json");
    if (aislesResponse.ok) {
      STORE_AISLES = await aislesResponse.json();
    }

    // 2. Load Unified Catalog Database CSV (multilingual_dictionary.csv)
    const csvResponse = await fetch("multilingual_dictionary.csv");
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      parseMultilingualCsv(csvText);

      // Build product catalog directly from the unified database
      const keys = Object.keys(MULTILINGUAL_DICTIONARY);
      allProducts = keys.map((slug, idx) => {
        const dict = MULTILINGUAL_DICTIONARY[slug];
        const loc = categorizeProduct(slug);
        const name = dict.en || formatProductName(slug);
        
        const aliases = [];
        if (dict.te) aliases.push(`TE: ${dict.te}`);
        if (dict.hi) aliases.push(`HI: ${dict.hi}`);

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
    if (c === '"' || c === "'") {
      inQuotes = !inQuotes;
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

function parseMultilingualCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  MULTILINGUAL_DICTIONARY = {};

  // Header: key,en,te,hi,keywords,aisle,rack
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    if (parts.length >= 5) {
      const key = parts[0].toLowerCase();
      const en = parts[1];
      const te = parts[2];
      const hi = parts[3];
      const keywordsStr = parts[4];
      const keywords = keywordsStr.split("|").map(k => k.trim().toLowerCase());
      
      const aisleVal = (parts.length >= 6 && parts[5]) ? parseInt(parts[5]) : null;
      const rackVal = (parts.length >= 7 && parts[6]) ? parseInt(parts[6]) : null;

      const aisle = (!isNaN(aisleVal) && aisleVal > 0) ? aisleVal : null;
      const rack = (!isNaN(rackVal) && rackVal > 0) ? rackVal : null;

      MULTILINGUAL_DICTIONARY[key] = {
        en: en,
        te: te,
        hi: hi,
        keywords: keywords,
        aisle: aisle,
        rack: rack
      };
    }
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

  // 1. Check explicit Google Sheet Aisle & Rack mapping
  if (MULTILINGUAL_DICTIONARY[lower] && MULTILINGUAL_DICTIONARY[lower].aisle) {
    const dict = MULTILINGUAL_DICTIONARY[lower];
    const aisleData = STORE_AISLES[dict.aisle] || { name: "General Spices", icon: "🌶️" };
    const rack = dict.rack || ((getHash(slug) % 30) + 1);
    return { aisle: dict.aisle, rack: rack, categoryName: aisleData.name, icon: aisleData.icon };
  }

  // 2. Keyword heuristic mapping
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
  if (!container) return;
  container.innerHTML = "";

  const total = filteredProducts.length;
  const countElem = document.getElementById("resultsCount");
  if (countElem) countElem.textContent = `${total.toLocaleString()} products found`;

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

    // Multilingual tags hidden by default per user directive
    let aliasHtml = "";

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

  if (dismissKeyboardBtn) {
    dismissKeyboardBtn.addEventListener("click", () => {
      searchInput.blur();
    });
  }

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
      p.categoryName = STORE_AISLES[newAisle] ? STORE_AISLES[newAisle].name : "Custom Aisle";
      p.icon = STORE_AISLES[newAisle] ? STORE_AISLES[newAisle].icon : "📦";
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
