/**
 * Bharath Bazar Mobile-First Multilingual Store Inventory & Product Locator Logic
 * Supports English, Telugu, and Hindi search transliterations.
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

  "curd": { en: "Yogurt / Curd", te: "Perugu (పెరుగు)", hi: "Dahi (दही)", keywords: ["curd", "yogurt", "dahi", "perugu"] },
  "dahi": { en: "Yogurt / Curd", te: "Perugu", hi: "Dahi", keywords: ["curd", "yogurt", "dahi", "perugu"] },
  "perugu": { en: "Yogurt / Curd", te: "Perugu", hi: "Dahi", keywords: ["curd", "yogurt", "dahi", "perugu"] },

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
let currentAisleFilter = "all";
let currentView = "searchView";

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Categorize product into Aisle and Rack (1-30)
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

// Match multilingual aliases
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

document.addEventListener("DOMContentLoaded", async () => {
  loadLocationOverrides();
  await loadProductData();
  setupEventListeners();
  renderMobileMap();
  applySearchAndFilter();
});

function loadLocationOverrides() {
  try {
    const saved = localStorage.getItem("bharath_bazar_location_overrides");
    if (saved) locationOverrides = JSON.parse(saved);
  } catch (e) {}
}

function saveLocationOverrides() {
  try {
    localStorage.setItem("bharath_bazar_location_overrides", JSON.stringify(locationOverrides));
  } catch (e) {}
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

// Search and Filter Logic
function applySearchAndFilter() {
  const rawQuery = document.getElementById("searchInput").value.trim().toLowerCase();
  
  // Resolve multilingual synonyms for query
  let expandedKeywords = [rawQuery];
  if (rawQuery) {
    for (const [key, item] of Object.entries(MULTILINGUAL_DICTIONARY)) {
      if (item.keywords.some(kw => kw.includes(rawQuery) || rawQuery.includes(kw))) {
        expandedKeywords.push(...item.keywords);
      }
    }
  }

  filteredProducts = allProducts.filter(p => {
    // Aisle filter
    if (currentAisleFilter !== "all" && p.aisle !== parseInt(currentAisleFilter)) {
      return false;
    }

    // Search query filter
    if (rawQuery) {
      const text = `${p.slug} ${p.name} ${p.aliases.join(" ")}`.toLowerCase();
      return expandedKeywords.some(kw => text.includes(kw));
    }

    return true;
  });

  renderProductList();
}

// Render Mobile Cards
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

  // Display top 80 products for fast mobile performance
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

    // Click to edit
    card.querySelector(".loc-badge-mobile").addEventListener("click", () => {
      openMobileEditModal(p.slug);
    });

    container.appendChild(card);
  });
}

// Render Mobile Store Map
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

// Setup Mobile Event Listeners
function setupEventListeners() {
  // Mobile Search Input
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  searchInput.addEventListener("input", () => {
    clearBtn.style.display = searchInput.value ? "block" : "none";
    applySearchAndFilter();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    applySearchAndFilter();
  });

  // Multilingual Hint Chips
  document.getElementById("langHintBar").addEventListener("click", (e) => {
    const chip = e.target.closest(".lang-chip");
    if (chip) {
      searchInput.value = chip.dataset.search;
      clearBtn.style.display = "block";
      switchTab("searchView");
      applySearchAndFilter();
    }
  });

  // Aisle Carousel Pills
  document.getElementById("aisleCarousel").addEventListener("click", (e) => {
    const pill = e.target.closest(".aisle-pill");
    if (pill) {
      setActiveAislePill(pill.dataset.aisle);
    }
  });

  // Bottom Navigation Tabs
  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    item.addEventListener("click", () => {
      switchTab(item.dataset.tab);
    });
  });

  // Mobile Edit Modal
  document.getElementById("closeEditModalMobileBtn").addEventListener("click", closeMobileEditModal);
  
  document.getElementById("quickEditBtn").addEventListener("click", () => {
    if (allProducts.length > 0) {
      openMobileEditModal(allProducts[0].slug);
    }
  });

  document.getElementById("editFormMobile").addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = document.getElementById("staffPinInput").value;
    if (pin !== "1234") {
      alert("Invalid Security PIN! Default PIN is 1234");
      return;
    }

    const slug = document.getElementById("editSlugMobile").value;
    const newAisle = parseInt(document.getElementById("editAisleMobile").value);
    const newRack = parseInt(document.getElementById("editRackMobile").value);

    locationOverrides[slug] = { aisle: newAisle, rack: newRack };
    saveLocationOverrides();

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

  // Mobile AI Navigator
  document.getElementById("aiAskBtnMobile").addEventListener("click", handleAiAskMobile);
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

  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
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
  document.getElementById("staffPinInput").value = "";

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

  const matches = allProducts.filter(p => p.name.toLowerCase().includes(query) || p.slug.toLowerCase().includes(query) || p.aliases.some(a => a.toLowerCase().includes(query)));

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
