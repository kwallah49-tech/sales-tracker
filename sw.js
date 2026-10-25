// Change this version when the cached app files need to be refreshed.
const CACHE_NAME = "sales-tracker-v1";

// Keep the app page and every file needed to display it available offline.
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Save the app files when the browser installs this service worker.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)),
  );
});

// Remove older versions of this app's cache and take control of open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("sales-tracker-") && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    )).then(() => self.clients.claim()),
  );
});

// Try the saved copy first; use the network when a request is not cached.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request)),
  );
});