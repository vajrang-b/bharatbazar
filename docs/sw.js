/**
 * Bharath Bazar Service Worker
 * Enables offline browsing with intelligent caching strategies
 * 
 * Caching Strategy:
 * - HTML/CSS/JS: Cache first, fall back to network (updates on revisit)
 * - CSV/JSON Data: Network first, fall back to cache (fresh data when online)
 * - Fonts/Images: Cache only (rarely change)
 */

const CACHE_VERSION = "v2";
const CACHE_NAMES = {
  STATIC: `bharath-bazar-static-${CACHE_VERSION}`,
  DATA: `bharath-bazar-data-${CACHE_VERSION}`,
  IMAGES: `bharath-bazar-images-${CACHE_VERSION}`,
};

// Files to cache on install
const STATIC_ASSETS = [
  "/bharatbazar/",
  "/bharatbazar/index.html",
  "/bharatbazar/index.css",
  "/bharatbazar/app.js",
  "/bharatbazar/privacy-policy.html",
  "/bharatbazar/cookie-policy.html",
];

const DATA_ASSETS = [
  "/bharatbazar/product_data.csv",
  "/bharatbazar/store_aisles.json",
];

// Install event - cache essential files
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    (async () => {
      try {
        // Cache static assets
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        await staticCache.addAll(STATIC_ASSETS);
        console.log("[SW] Static assets cached");

        // Cache data files
        const dataCache = await caches.open(CACHE_NAMES.DATA);
        await dataCache.addAll(DATA_ASSETS);
        console.log("[SW] Data assets cached");

        // Force the new service worker to activate
        await self.skipWaiting();
      } catch (error) {
        console.error("[SW] Install failed:", error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const promises = cacheNames.map((cacheName) => {
        // Delete old cache versions
        if (
          !Object.values(CACHE_NAMES).includes(cacheName) &&
          cacheName.startsWith("bharath-bazar-")
        ) {
          console.log(`[SW] Deleting old cache: ${cacheName}`);
          return caches.delete(cacheName);
        }
      });

      await Promise.all(promises);
      // Claim all clients immediately
      await self.clients.claim();
      console.log("[SW] Activated");
    })()
  );
});

// Fetch event - serve from cache/network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Ignore external API calls (Google Forms)
  if (
    url.hostname === "docs.google.com" ||
    url.hostname === "formspree.io"
  ) {
    return event.respondWith(fetch(request).catch(() => offlineResponse()));
  }

  // Data files: Network first, fall back to cache
  if (
    request.url.includes(".csv") ||
    request.url.includes(".json")
  ) {
    return event.respondWith(networkFirstStrategy(request));
  }

  // Static assets: Cache first, fall back to network
  if (
    request.url.includes(".js") ||
    request.url.includes(".css") ||
    request.url.includes(".html")
  ) {
    return event.respondWith(cacheFirstStrategy(request));
  }

  // Images & fonts: Cache only
  if (
    /\.(png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)$/i.test(url.pathname)
  ) {
    return event.respondWith(cacheOnlyStrategy(request));
  }

  // Default: Network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Cache-first strategy: Use cache if available, otherwise network
 * Good for: Static assets that rarely change
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAMES.STATIC);
  const cached = await cache.match(request);

  if (cached) {
    console.log(`[SW] Cache hit: ${request.url}`);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error(`[SW] Network failed for ${request.url}:`, error);
    return offlineResponse();
  }
}

/**
 * Network-first strategy: Try network first, fall back to cache
 * Good for: Data files that update frequently
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAMES.DATA);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log(`[SW] Network failed, using cache: ${request.url}`);
    const cache = await caches.open(CACHE_NAMES.DATA);
    const cached = await cache.match(request);
    return cached || offlineResponse();
  }
}

/**
 * Cache-only strategy: Use cache, never network
 * Good for: Images and fonts
 */
async function cacheOnlyStrategy(request) {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const cached = await cache.match(request);
  return cached || offlineResponse();
}

/**
 * Fallback response when offline
 */
function offlineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - Bharath Bazar</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #E65100 0%, #1B5E20 100%);
          }
          .offline-card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .offline-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #E65100;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin: 10px 0;
          }
          .hint {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="offline-card">
          <div class="offline-icon">📡</div>
          <h1>You're Offline</h1>
          <p>Unable to fetch this resource from the network.</p>
          <p>The app will work with previously cached data when you go back online.</p>
          <div class="hint">
            💡 Try: Return to search, refresh the page, or wait for connection
          </div>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
