self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode !== "navigate") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cachedPage = await caches.match(request, { ignoreSearch: true });

      if (cachedPage) {
        return cachedPage;
      }

      const offlineFallback = await caches.match("/_offline", { ignoreSearch: true });

      if (offlineFallback) {
        return offlineFallback;
      }

      return new Response(
        "<!doctype html><title>Next Docs Offline</title><main><h1>Next Docs is offline</h1><p>Open the app once while online so this device can cache the local-first shell.</p></main>",
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    })
  );
});
