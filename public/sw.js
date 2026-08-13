// RejoFood Service Worker v2 — push notifications + offline-first UI cache
//
// Strategi cache:
//  - Static assets (JS, CSS, fonts, images): stale-while-revalidate
//    → ambil dari cache dulu (instant), lalu revalidate di background
//  - HTML documents (page navigations): network-first, fallback to cache
//    → selalu pakai versi terbaru kalau online, fallback cache kalau offline
//  - API calls (/api/*): network-only, tidak di-cache
//    → data harus fresh, jangan cache response API
//  - Push notifications: handled separately

const CACHE_VERSION = "rejofood-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Resources yang di-precache saat install (critical untuk first load)
const PRECACHE_URLS = [
  "/",
  "/icon.svg",
  "/manifest.webmanifest",
];

// Static asset patterns (cache dengan SWR strategy)
const STATIC_ASSET_PATTERNS = [
  /\/_next\/static\//,        // Next.js JS/CSS chunks
  /\/_next\/image\?url=/,     // Next.js optimized images
  /\.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i,
];

// API patterns (TIDAK di-cache)
const API_PATTERNS = [
  /\/api\//,
  /\/auth\//,
];

// Install — precache critical resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Best-effort precache — ignore individual failures
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        ),
      );
    }),
  );
  self.skipWaiting();
});

// Activate — cleanup old caches, claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name)),
      );
    }).then(() => self.clients.claim()),
  );
});

// Helper: cek apakah request adalah static asset
function isStaticAsset(url) {
  return STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url));
}

// Helper: cek apakah request adalah API call
function isApiCall(url) {
  return API_PATTERNS.some((pattern) => pattern.test(url));
}

// Helper: cek apakah request same-origin
function isSameOrigin(url) {
  return url.startsWith(self.location.origin);
}

// Fetch — strategy based on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya handle GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin (Cloudinary, Google Fonts, dll) — biarkan browser handle
  if (!isSameOrigin(url.href)) return;

  // API calls: network-only (tidak di-cache, data harus fresh)
  if (isApiCall(url.pathname)) {
    return; // browser akan handle request normal
  }

  // HTML navigations: network-first, fallback ke cache (offline support)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache page baru untuk offline fallback
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: ambil dari cache, atau fallback ke root
          return caches.match(request).then((cached) => {
            return cached || caches.match("/");
          });
        }),
    );
    return;
  }

  // Static assets: stale-while-revalidate (instant dari cache, revalidate di background)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // offline: pakai cache lama

        // Return cached dulu (instant), atau tunggu network kalau belum ada cache
        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // Default: cache-first dengan fallback network (untuk asset lain)
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
      );
    }),
  );
});

// Push event — show notification
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RejoFood", body: event.data ? event.data.text() : "Notifikasi baru" };
  }

  const title = data.title || "RejoFood";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: data.badge || "/icon.svg",
    tag: data.tag || "rejofood-order",
    data: data.data || { url: "/" },
    actions: data.actions || [],
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — focus app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// Message handler — untuk trigger update dari main thread
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
