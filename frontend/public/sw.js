// EventScout PWA Service Worker
const CACHE_NAME = "eventscout-cache-v2";

const PRECACHE_ASSETS = [
  "/",
  "/explore",
  "/saved",
  "/preferences",
  "/manifest.json",
  "/fallback_events.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg"
];

// Install: precache essential shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache asset failure (non-critical):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Only handle same-origin requests in the service worker shell cache.
  // Cross-origin backend API calls (e.g. port 8000) are handled directly by the browser to avoid CORS issues.
  if (url.origin !== self.location.origin) return;

  // Do NOT cache authentication or user-private endpoints
  if (
    url.pathname.includes("/auth") ||
    url.pathname.includes("/me/") ||
    url.pathname.includes("/admin/") ||
    url.pathname.includes("/login") ||
    url.pathname.includes("/signup")
  ) {
    return;
  }

  // 1. Static Next.js assets, icons & fonts: Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 2. Navigation / HTML pages: Network-first with Cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          const rootCached = await cache.match("/");
          if (rootCached) return rootCached;
          return new Response(
            `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>EventScout - Offline</title><style>body{background:#0b0f19;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}a{color:#818cf8;margin-top:16px;display:inline-block}</style></head><body><div><h1>You're Offline</h1><p>Check your connection to explore new events.</p><a href="/saved">View Saved Events</a></div></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 3. Fallback events JSON: Network-first, fallback to cache
  if (url.pathname === "/fallback_events.json") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/fallback_events.json");
          if (fallback) return fallback;
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" }
          });
        })
    );
  }
});
