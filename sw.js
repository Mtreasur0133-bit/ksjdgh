if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: false,
  });
}
importScripts("./riptide-sw-router.js");
importScripts("./sapphire-sw-router.js");
importScripts("./controller/controller.sw.js");

// Cache name with version for cache management
const CACHE_NAME = 'cherri-v1';
const STATIC_CACHE = 'cherri-static-v1';

// Assets to cache immediately
const PRECACHE_ASSETS = [
  './favicon.svg',
  './assets/img/fav.png',
  './manifest.json'
];

// Take over as soon as a new worker is available, and start controlling
// already-open pages immediately. Without this a rebuilt worker (e.g. a change
// to the Sapphire router) sits in "waiting" until every tab is closed, so
// fixes appear not to apply. None of the imported routers claim clients.
addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
  // Clean up old caches
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

addEventListener("fetch", (e) => {
  if ($riptideRouter.shouldRoute(e)) {
    e.respondWith($riptideRouter.route(e));
    return;
  }
  if ($sapphireRouter.shouldRoute(e)) {
    e.respondWith($sapphireRouter.route(e));
    return;
  }
  if ($scramjetController.shouldRoute(e)) {
    e.respondWith($scramjetController.route(e));
    return;
  }

  // Basic caching for static assets
  e.respondWith(
    caches.match(e.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(e.request).then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});