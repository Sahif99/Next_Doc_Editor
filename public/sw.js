const CACHE_NAME = "next-docs-offline-v1";
const OFFLINE_DOCUMENT = "/offline-document.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_DOCUMENT]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode !== "navigate" || url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith("/documents/")) {
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_DOCUMENT))
  );
});
