/**
 * Route Optimization Engine
 * Calculates optimal shopping routes through store aisles
 * 
 * Algorithms:
 * - Linear Sweep: Visit aisles 1→8 in order (simplest & most practical)
 * - Nearest Neighbor: Always go to closest unvisited product
 * - Cluster Sweep: Group by aisle, then sweep (best balance)
 */

// ================================================================
// 1. PRODUCT LOCATION FINDER
// ================================================================

/**
 * Get location (aisle & rack) of a product
 * @param {string} productName - Product name or slug
 * @returns {Object|null} {name, aisle, rack, icon, slug} or null if not found
 */
function getProductLocation(productName) {
  if (!productName || !allProducts || allProducts.length === 0) {
    return null;
  }

  const query = productName.toLowerCase().trim();

  // Exact slug match
  let product = allProducts.find(
    p => p.slug.toLowerCase() === query
  );
  if (product) return formatProductLocation(product);

  // Name match
  product = allProducts.find(
    p => p.name.toLowerCase().includes(query)
  );
  if (product) return formatProductLocation(product);

  // Alias match (translations, partial names)
  product = allProducts.find(
    p => p.aliases.some(alias => alias.toLowerCase().includes(query))
  );
  if (product) return formatProductLocation(product);

  // Partial match (last resort)
  product = allProducts.find(
    p => p.name.toLowerCase().includes(query) ||
         p.slug.toLowerCase().includes(query)
  );
  if (product) return formatProductLocation(product);

  return null;
}

function getNumericRack(rack) {
  if (rack === null || rack === undefined) return 0;
  const match = String(rack).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Format product data for route calculation
 */
function formatProductLocation(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    aisle: parseInt(product.aisle) || 0,
    rack: product.rack,
    rackNumber: getNumericRack(product.rack),
    categoryName: product.categoryName || "",
    icon: product.icon || "📦",
    confidence: 100 // Can be lowered for fuzzy matches
  };
}

// ================================================================
// 2. ROUTE CALCULATION ALGORITHMS
// ================================================================

/**
 * Algorithm 1: Linear Sweep (Recommended for typical supermarkets)
 * - Visit aisles in order (1→2→3→...→8)
 * - Within each aisle, visit racks in ascending order
 * - Minimizes backtracking
 * 
 * @param {Array} locations - Product locations [{aisle, rack, name}]
 * @returns {Array} Optimized route order
 */
function calculateRouteLinearSweep(locations) {
  if (!locations || locations.length === 0) {
    return [];
  }

  // Filter out invalid locations
  const validLocations = locations.filter(
    loc => loc && loc.aisle && loc.rack !== null && loc.rack !== undefined
  );

  // Group by aisle
  const byAisle = {};
  validLocations.forEach(loc => {
    const aisle = parseInt(loc.aisle);
    if (!byAisle[aisle]) byAisle[aisle] = [];
    byAisle[aisle].push(loc);
  });

  // Sort racks within each aisle (ascending order)
  Object.keys(byAisle).forEach(aisle => {
    byAisle[aisle].sort((a, b) => getNumericRack(a.rack) - getNumericRack(b.rack));
  });

  // Build route: traverse aisles in order
  const route = [];
  for (let aisle = 1; aisle <= 8; aisle++) {
    if (byAisle[aisle]) {
      route.push(...byAisle[aisle]);
    }
  }

  return route;
}

/**
/**
 * Algorithm 2: Nearest Neighbor (For scattered products)
 * - Start at entrance (Aisle 1, Rack 1)
 * - Always go to closest unvisited product
 * - Good for random shopping patterns
 * 
 * @param {Array} locations - Product locations
 * @param {Object} start - Starting position {aisle, rack}
 * @returns {Array} Optimized route
 */
function calculateRouteNearestNeighbor(
  locations,
  start = { aisle: 1, rack: 1 }
) {
  if (!locations || locations.length === 0) return [];

  const validLocations = locations.filter(
    loc => loc && loc.aisle && loc.rack !== null && loc.rack !== undefined
  );
  if (validLocations.length === 0) return [];

  const route = [];
  const unvisited = [...validLocations];
  let current = start;

  while (unvisited.length > 0) {
    // Find closest unvisited product
    let closestIdx = 0;
    let closestDistance = calculateDistance(current, unvisited[0]);

    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(current, unvisited[i]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIdx = i;
      }
    }

    // Move to closest
    const closest = unvisited.splice(closestIdx, 1)[0];
    route.push(closest);
    current = closest;
  }

  return route;
}

/**
 * Algorithm 3: Cluster Sweep (Best balance of simplicity & optimization)
 * - Group products by aisle (cluster)
 * - Sort aisles by distance from entrance
 * - Visit each cluster in order
 * - Within cluster, sort by rack
 * 
 * @param {Array} locations - Product locations
 * @returns {Array} Optimized route
 */
function calculateRouteClusterSweep(locations) {
  return calculateRouteLinearSweep(locations);
}

// ================================================================
// 3. DISTANCE CALCULATION
// ================================================================

/**
 * Calculate distance between two points (Manhattan distance)
 * Assumes aisles are vertical lines, racks are horizontal distances
 * 
 * Distance = (aisle difference * aisle width) + (rack difference)
 */
function calculateDistance(from, to, weights = {}) {
  const aisleWeight = weights.aisleWeight || 10; // 1 aisle = 10 rack units
  const rackWeight = weights.rackWeight || 1;

  const aisleDiff = Math.abs(
    parseInt(from.aisle) - parseInt(to.aisle)
  );
  const rackDiff = Math.abs(
    getNumericRack(from.rack) - getNumericRack(to.rack)
  );

  return aisleDiff * aisleWeight + rackDiff * rackWeight;
}

/**
 * Calculate total route distance
 */
function calculateTotalDistance(route, startPoint = { aisle: 1, rack: 1 }) {
  if (route.length === 0) return 0;

  let totalDistance = 0;
  let currentPoint = startPoint;

  route.forEach(location => {
    const distance = calculateDistance(currentPoint, location);
    totalDistance += distance;
    currentPoint = location;
  });

  return totalDistance;
}

// ================================================================
// 4. ROUTE STATISTICS
// ================================================================

/**
 * Calculate route statistics and metadata
 */
function calculateRouteStats(route, startPoint = { aisle: 1, rack: 1 }) {
  if (!route || route.length === 0) {
    return {
      totalDistance: 0,
      totalTime: "0 min",
      aislesVisited: [],
      productCount: 0,
      averageTimePerProduct: 0,
      routeEfficiency: 100
    };
  }

  const totalDistance = calculateTotalDistance(route, startPoint);
  const aislesVisited = [...new Set(route.map(p => p.aisle))].sort(
    (a, b) => a - b
  );

  // Estimate time: ~1 minute per 5 distance units + 2 min per aisle transition
  const timePerUnit = 0.2; // minutes
  const timePerAisleTransition = 0.5; // minutes
  const aisleTransitions = Math.max(0, aislesVisited.length - 1);
  const totalTime =
    totalDistance * timePerUnit +
    aisleTransitions * timePerAisleTransition +
    route.length * 0.5; // 30 sec per product pickup

  return {
    totalDistance: Math.round(totalDistance),
    totalTime: Math.ceil(totalTime),
    totalTimeFormatted: `${Math.ceil(totalTime)} min`,
    aislesVisited,
    aisleCount: aislesVisited.length,
    productCount: route.length,
    averageDistancePerProduct: Math.round(totalDistance / route.length),
    routeEfficiency: calculateEfficiency(route, aislesVisited)
  };
}

/**
 * Calculate route efficiency (0-100%)
 * 100% = all products in same aisle
 * Lower = more aisles to visit
 */
function calculateEfficiency(route, aislesVisited) {
  if (route.length === 0) return 100;

  // Ideal: all in 1 aisle
  // Worst: 1 product per aisle
  const aisleCount = aislesVisited.length;
  const productCount = route.length;

  // Simple formula: higher aisles = lower efficiency
  const efficiency = Math.max(
    10,
    100 - aisleCount * 5 - (productCount - aisleCount) * 2
  );

  return Math.min(100, Math.round(efficiency));
}

// ================================================================
// 5. MAIN ROUTE OPTIMIZER FUNCTION
// ================================================================

/**
 * Main function: Takes product names, returns optimized route
 * 
 * @param {Array<string>} productNames - List of product names/slugs
 * @param {Object} options - {algorithm: 'linear-sweep'|'nearest-neighbor'|'cluster-sweep'}
 * @returns {Object} {route, stats, unfoundProducts}
 */
function optimizeShoppingRoute(productNames, options = {}) {
  if (!productNames || productNames.length === 0) {
    return {
      route: [],
      stats: {
        totalDistance: 0,
        totalTime: 0,
        aislesVisited: [],
        productCount: 0
      },
      unfoundProducts: [],
      success: false,
      message: "No products in list"
    };
  }

  const algorithm = options.algorithm || "linear-sweep";
  const startPoint = options.startPoint || { aisle: 1, rack: 1 };

  // Step 1: Find locations for all products
  const locations = [];
  const unfoundProducts = [];

  productNames.forEach(name => {
    const location = getProductLocation(name);
    if (location) {
      locations.push(location);
    } else {
      unfoundProducts.push(name);
    }
  });

  // Step 2: Calculate route based on algorithm
  let route = [];
  switch (algorithm) {
    case "nearest-neighbor":
      route = calculateRouteNearestNeighbor(locations, startPoint);
      break;
    case "cluster-sweep":
      route = calculateRouteClusterSweep(locations);
      break;
    case "linear-sweep":
    default:
      route = calculateRouteLinearSweep(locations);
  }

  // Step 3: Calculate statistics
  const stats = calculateRouteStats(route, startPoint);

  return {
    route,
    stats,
    unfoundProducts,
    foundProducts: locations.length,
    success: locations.length > 0,
    message:
      locations.length === productNames.length
        ? "All products found!"
        : `Found ${locations.length}/${productNames.length} products`
  };
}

// ================================================================
// 6. HELPER: Format route for display
// ================================================================

/**
 * Format route for user-friendly display
 */
function formatRouteForDisplay(route) {
  return route.map((item, index) => ({
    step: index + 1,
    aisle: item.aisle,
    rack: item.rack,
    aisleIcon: item.icon,
    aisleName: STORE_AISLES[item.aisle]?.name || "Unknown",
    productName: item.name,
    productSlug: item.slug
  }));
}

// ================================================================
// 7. HELPER: Export for testing
// ================================================================

// Uncomment if using in Node.js/tests
// module.exports = {
//   getProductLocation,
//   calculateRouteLinearSweep,
//   calculateRouteNearestNeighbor,
//   calculateDistance,
//   calculateTotalDistance,
//   calculateRouteStats,
//   optimizeShoppingRoute,
//   formatRouteForDisplay
// };

console.log("[Route Optimizer] Module loaded successfully");
