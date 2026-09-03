/* Waste-Wise application shell service worker.
 *
 * This intentionally caches only navigation and public static assets. API responses,
 * authenticated data, telemetry, and user-generated evidence are never cached here.
 * The offline outbox in src/lib/offline will own replayable user actions.
 */
const CACHE_NAME = "waste-wise-shell-v1";
const NAVIGATION_FALLBACK = new Response(
  "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Waste-Wise is offline</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#f4f8f6;color:#10231f;font:16px Arial,sans-serif}.card{max-width:420px;margin:24px;padding:30px;background:#fff;border:1px solid #dce8e3;border-radius:18px;box-shadow:0 12px 35px rgba(20,61,50,.1)}h1{margin:0 0 10px;color:#0d2d2a;font-size:24px}p{color:#526b62;line-height:1.55}</style></head><body><main class=\"card\"><h1>You are offline</h1><p>Waste-Wise will keep safe, queued field actions on this device. Reconnect to refresh routes and synchronize approved work.</p></main></body></html>",
  { headers: { "Content-Type": "text/html; charset=utf-8" } },
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/login"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")) || NAVIGATION_FALLBACK),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
