/* Cache only the app shell and public same-origin assets, never authenticated APIs. */
const CACHE = "farmult-v229-light-surfaces";
const SHELL = ["/js/project-budget.js", "/js/project-history.js", "/", "/guide.html", "/images/brand/farmultimate-mark.png", "/css/style.css", "/css/projects.css", "/css/stock-issue.css", "/css/ledger-preview.css", "/css/workspace.css", "/css/landing.css", "/js/runtime-config.js", "/js/sensors.js", "/js/farm-map.js", "/js/data.js", "/js/ledger-preview.js", "/js/application-rate.js", "/js/charts.js", "/js/notify.js", "/js/stock.js", "/js/stock-issue.js", "/js/lucide.min.js",
  "/js/sales.js", "/css/sales-evidence.css", "/js/lark.js", "/js/recovery.js", "/js/landing.js", "/js/auth.js", "/js/inspection.js", "/js/project-workspace.js", "/js/project-planner.js", "/js/project-records.js", "/js/project-experiment-setup.js", "/js/project-report.js", "/js/project-docx.js", "/js/project-activity.js", "/css/project-workspace.css", "/js/cycle-notebook.js", "/css/cycle-notebook.css", "/js/projects.js", "/js/app.js", "/js/team.js","/js/workspace.js","/js/workspace-flows.js", "/js/task-wizard.js", "/js/private-photos.js", "/collector", "/css/collector.css", "/js/collector.js"];

SHELL.push('/js/plot-materials.js', '/css/plot-materials.css');
SHELL.push('/js/batch-work.js', '/css/batch-work.css');
SHELL.push('/js/project-data-repair.js', '/css/project-data-repair.css');
SHELL.push('/js/farm-overview.js', '/css/farm-overview.css');
SHELL.push('/js/farm-calendar.js', '/css/farm-calendar.css');
SHELL.push('/js/project-proposal.js', '/js/project-report-editor.js', '/js/project-work-entry.js', '/css/project-proposal.css');
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
  // Redirect aliases explicitly instead of returning a cached, followed redirect
  // to a navigation request whose redirect mode is manual.
  const alias = {"/index.html":"/", "/collector.html":"/collector", "/collector/":"/collector"}[url.pathname];
  if(req.mode === "navigate" && alias){
    url.pathname=alias;
    event.respondWith(Response.redirect(url.href,302));
    return;
  }
  const navigation = req.mode === "navigate" && ["/", "/collector"].includes(url.pathname);
  const asset = SHELL.includes(url.pathname) || /^\/(icons|images)\//.test(url.pathname) || ["/manifest.json"].includes(url.pathname);
  if (!navigation && !asset) return;
  const key = url.pathname;
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
