/* Cache only the app shell and public same-origin assets, never authenticated APIs. */
const CACHE = "farmult-v127-trialingredients";
const SHELL = ["/", "/css/style.css", "/css/landing.css", "/js/data.js", "/js/charts.js", "/js/notify.js", "/js/stock.js",
  "/js/sales.js", "/js/lark.js", "/js/recovery.js", "/js/landing.js", "/js/auth.js", "/js/app.js"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const responses = await Promise.all(SHELL.map(async path => {
      const res = await fetch(path, { cache: "reload" });
      if (!res.ok) throw new Error("Incomplete offline app shell");
      return [path, res];
    }));
    await Promise.all(responses.map(([path, res]) => cache.put(path, res)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("farmult-") && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const navigation = req.mode === "navigate" && ["/", "/index.html"].includes(url.pathname);
  const asset = SHELL.includes(url.pathname) || /^\/(icons|images)\//.test(url.pathname) || ["/logo.jpg", "/manifest.json"].includes(url.pathname);
  if (!navigation && !asset) return;
  const key = navigation ? "/" : url.pathname;
  const network = fetch(req).then(async res => {
    if (!res.ok) throw new Error("Network response unavailable");
    try { const cache = await caches.open(CACHE); await cache.put(key, res.clone()); } catch (error) { /* Online response still usable when cache is full. */ }
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE).catch(() => null);
    let timer;
    try {
      return await Promise.race([network, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Network timeout")), 3500); })]);
    } catch (error) {
      const cached = cache && await cache.match(key);
      return cached || network.catch(() => Response.error());
    } finally { clearTimeout(timer); }
  })());
});
