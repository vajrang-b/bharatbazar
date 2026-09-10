/**
 * Shopping List & Route Display UI Module
 * Integrates route optimization into the mobile interface
 */

// ================================================================
// 1. SHOPPING LIST STATE
// ================================================================

let shoppingList = [];
let currentRoute = null;
let currentStats = null;

// ================================================================
// 2. SHOPPING LIST MANAGEMENT
// ================================================================

/**
 * Add product to shopping list
 */
function addToShoppingList(productName) {
  if (!productName || productName.trim() === "") {
    alert("Please enter a product name");
    return;
  }

  // Check if already in list
  if (shoppingList.includes(productName)) {
    alert(`"${productName}" is already in your list`);
    return;
  }

  shoppingList.push(productName);
  renderShoppingList();
  
  // Clear input
  const input = document.getElementById("shoppingListInput");
  if (input) input.value = "";

  showNotification(`✓ Added "${productName}" to list`);
}

/**
 * Remove product from shopping list
 */
function removeFromShoppingList(productName) {
  shoppingList = shoppingList.filter(p => p !== productName);
  renderShoppingList();
  showNotification(`✓ Removed "${productName}" from list`);
}

/**
 * Clear entire shopping list
 */
function clearShoppingList() {
  if (confirm("Clear all products from list?")) {
    shoppingList = [];
    currentRoute = null;
    currentStats = null;
    renderShoppingList();
    showNotification("List cleared");
  }
}

// ================================================================
// 3. RENDER SHOPPING LIST UI
// ================================================================

function formatLocationRackText(rack) {
  if (typeof formatLocationRack === "function") return formatLocationRack(rack);
  if (rack === null || rack === undefined) return "";
  const s = String(rack).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return `Rack ${s}`;
  return s;
}

/**
 * Render shopping list in UI
 */
function renderShoppingList() {
  const container = document.getElementById("shoppingListItems");
  if (!container) return;

  if (shoppingList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 20px;">
        <p>📋 No products yet</p>
        <small>Add products above to create your shopping list</small>
      </div>
    `;
    return;
  }

  const items = shoppingList
    .map((product, index) => {
      const location = getProductLocation(product);
      const icon = location ? location.icon : "📦";
      const status = location ? "✓ Found" : "⚠️ Not found";

      return `
        <div class="shopping-list-item" style="
          display: flex;
          gap: 10px;
          padding: 10px;
          background: var(--bg-card);
          border-radius: 6px;
          margin-bottom: 8px;
          align-items: center;
        ">
          <span style="font-size: 20px;">${icon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 0.95rem;">${product}</div>
            <small style="color: ${location ? "var(--secondary-emerald)" : "var(--accent-red)"};">
              ${status}
              ${location ? `- Aisle ${location.aisle}, ${formatLocationRackText(location.rack)}` : ""}
            </small>
          </div>
          <button 
            onclick="removeFromShoppingList('${product.replace(/'/g, "\\'")}')"
            style="
              background: rgba(230, 81, 0, 0.2);
              border: none;
              border-radius: 4px;
              padding: 5px 10px;
              cursor: pointer;
              color: var(--accent-red);
              font-weight: 600;
            "
          >
            ✕
          </button>
        </div>
      `;
    })
    .join("");

  container.innerHTML = items;
}

// ================================================================
// 4. ROUTE CALCULATION & DISPLAY
// ================================================================

/**
 * Calculate and display optimal route
 */
function calculateAndDisplayRoute() {
  if (shoppingList.length === 0) {
    alert("Add products to your list first");
    return;
  }

  // Calculate optimal route
  const result = optimizeShoppingRoute(shoppingList, {
    algorithm: "linear-sweep"
  });

  if (!result.success) {
    alert(`Could not find route. ${result.message}`);
    return;
  }

  currentRoute = result.route;
  currentStats = result.stats;

  // Show results
  renderRouteResults(result);
  displayTurnByTurn(result.route);
  drawRouteVisualization(result.route);

  // Show route panel
  const routePanel = document.getElementById("routeResultsPanel");
  if (routePanel) {
    routePanel.style.display = "block";
    routePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Render route statistics and summary
 */
function renderRouteResults(result) {
  const container = document.getElementById("routeStatsContainer");
  if (!container) return;

  const { stats, foundProducts, unfoundProducts } = result;
  const aisleList = stats.aislesVisited.join(", ");

  let warningHTML = "";
  if (unfoundProducts.length > 0) {
    warningHTML = `
      <div style="
        background: rgba(230, 150, 0, 0.2);
        border-left: 3px solid var(--accent-amber);
        padding: 10px;
        margin-bottom: 15px;
        border-radius: 4px;
      ">
        <strong>⚠️ ${unfoundProducts.length} product(s) not found:</strong>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">
          ${unfoundProducts.join(", ")}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${warningHTML}
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
      <div style="
        background: var(--bg-card);
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid var(--secondary-emerald);
      ">
        <div style="font-size: 0.8rem; color: var(--text-muted);">Distance</div>
        <div style="font-size: 1.3rem; font-weight: 700; color: var(--secondary-emerald);">
          ${stats.totalDistance} units
        </div>
      </div>

      <div style="
        background: var(--bg-card);
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid var(--aisle-5);
      ">
        <div style="font-size: 0.8rem; color: var(--text-muted);">Est. Time</div>
        <div style="font-size: 1.3rem; font-weight: 700;">
          ${stats.totalTimeFormatted}
        </div>
      </div>

      <div style="
        background: var(--bg-card);
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid var(--accent-amber);
      ">
        <div style="font-size: 0.8rem; color: var(--text-muted);">Aisles</div>
        <div style="font-size: 1.3rem; font-weight: 700;">
          ${stats.aisleCount} of 8
        </div>
      </div>

      <div style="
        background: var(--bg-card);
        padding: 12px;
        border-radius: 6px;
        border-left: 3px solid var(--aisle-7);
      ">
        <div style="font-size: 0.8rem; color: var(--text-muted);">Efficiency</div>
        <div style="font-size: 1.3rem; font-weight: 700; color: var(--secondary-emerald);">
          ${stats.routeEfficiency}%
        </div>
      </div>
    </div>

    <div style="
      background: var(--bg-card);
      padding: 10px;
      border-radius: 6px;
      font-size: 0.9rem;
    ">
      <strong>Route:</strong> Aisle ${aisleList}
    </div>
  `;
}

/**
 * Display turn-by-turn navigation
 */
function displayTurnByTurn(route) {
  const container = document.getElementById("turnByTurnContainer");
  if (!container) return;

  const formattedRoute = formatRouteForDisplay(route);

  const html = formattedRoute
    .map((item) => {
      return `
        <div style="
          padding: 12px;
          background: var(--bg-card);
          border-radius: 6px;
          margin-bottom: 10px;
          border-left: 4px solid ${STORE_AISLES[item.aisle]?.color || "var(--border-color)"};
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 6px;
          ">
            <div style="
              background: var(--accent-amber);
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 0.9rem;
            ">
              ${item.step}
            </div>
            <div>
              <div style="font-weight: 600;">
                ${item.aisleIcon} Aisle ${item.aisle} - ${formatLocationRackText(item.rack)}
              </div>
              <small style="color: var(--text-muted);">${item.aisleName}</small>
            </div>
          </div>
          <div style="
            font-weight: 500;
            color: var(--text-secondary);
            margin-left: 38px;
          ">
            📦 ${item.productName}
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = html;
}

// ================================================================
// 5. VISUALIZATION
// ================================================================

/**
 * Draw route visualization on store map
 */
function drawRouteVisualization(route) {
  const canvas = document.getElementById("routeCanvasContainer");
  if (!canvas) return;

  // Simple ASCII/text visualization
  const aisles = {};
  route.forEach((product, index) => {
    if (!aisles[product.aisle]) aisles[product.aisle] = [];
    aisles[product.aisle].push({ index, rack: product.rack, name: product.name });
  });

  let visualization = "<pre style='font-size: 0.8rem; overflow-x: auto;'>";
  visualization += "📍 STORE ROUTE MAP\n";
  visualization += "════════════════════\n\n";

  for (let aisle = 1; aisle <= 8; aisle++) {
    const icon = STORE_AISLES[aisle]?.icon || "  ";
    if (aisles[aisle]) {
      visualization += `${icon} Aisle ${aisle}\n`;
      aisles[aisle].forEach(item => {
        visualization += `   → Step ${item.index + 1}: ${formatLocationRackText(item.rack)}\n`;
      });
    }
  }

  visualization += "</pre>";
  canvas.innerHTML = visualization;
}

// ================================================================
// 6. HELPER: Show notification
// ================================================================

function showNotification(message) {
  // Quick toast notification
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--secondary-emerald);
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    z-index: 10000;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ================================================================
// 7. EVENT LISTENERS (Initialize when DOM ready)
// ================================================================

function initializeShoppingListUI() {
  // Add button
  const addBtn = document.getElementById("addToShoppingListBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const input = document.getElementById("shoppingListInput");
      if (input) {
        addToShoppingList(input.value);
      }
    });
  }

  // Input Enter key
  const input = document.getElementById("shoppingListInput");
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addToShoppingList(input.value);
      }
    });
  }

  // Calculate route button
  const calcBtn = document.getElementById("calculateRouteBtn");
  if (calcBtn) {
    calcBtn.addEventListener("click", calculateAndDisplayRoute);
  }

  // Clear list button
  const clearBtn = document.getElementById("clearListBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearShoppingList);
  }

  console.log("[Shopping List UI] Initialized");
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeShoppingListUI);
} else {
  initializeShoppingListUI();
}

console.log("[Shopping List Module] Loaded successfully");
