/* Gerado pelo build:web. Só o shell público entra no Cache Storage. */
const CACHE = "pratica-shell-__CACHE_VERSION__";
const PREFIX = "pratica-shell-";
const FILES = __PRECACHE__;
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL("index.html", SCOPE).href;
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((path) => new Request(path, { cache: "reload" })));
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "ACTIVATE_UPDATE") return;
  event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .filter((client) => client.url.startsWith(SCOPE.href));
    if (windows.length > 1) { event.source?.postMessage({ type: "UPDATE_BLOCKED" }); return; }
    await self.skipWaiting();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (request.mode !== "navigate" && !FILES.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request.mode === "navigate" ? INDEX : url.pathname);
    return cached ?? fetch(request);
  })());
});
