// cb-sw.js — Chit & Bridge service worker (offline Phase 3). Makes the app OPEN with no connection and serve last-seen
// data. Strategy = NETWORK-FIRST with cache fallback: when online you ALWAYS get fresh content (safe for a fast-deploying
// app — no stale-code trap); the cache only answers when the network fails. Mutations (non-GET) are never touched here —
// they are the outbox's job (cb-offline.js). Bump CB_SW_VERSION to invalidate all caches on the next load.
const CB_SW_VERSION = 'v2';   // v2: fix Firefox/Safari 503 — a SW re-fetch of an intercepted cross-origin Request rejects on those engines, which masked live data as "offline"
const SHELL = 'cb-shell-' + CB_SW_VERSION;   // same-origin app shell + static JS
const APICACHE = 'cb-api-' + CB_SW_VERSION;  // GET /api/** responses (this device's own data)
const EXT = 'cb-ext-' + CB_SW_VERSION;       // cross-origin static (fonts)
const KEEP = [SHELL, APICACHE, EXT];

// app shell + all lazily-injected cap modules (they are NOT <script> tags, so precache them explicitly)
const PRECACHE = [
  '/app.html', '/app/core.js', '/app/helpers.js',
  '/app/cap-admin.js', '/app/cap-dispute.js', '/app/cap-connector.js', '/app/cap-workforce.js',
  '/app/cap-folders.js', '/app/cap-readiness.js', '/app/cap-legend.js',
  '/cb-offline.js',
  '/authority-forms.html', '/know-your-business.html', '/intake.html', '/shop.html', '/embed.html',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) =>
    // best-effort: a missing/renamed asset must NOT fail the whole install
    Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('cb-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req, cacheName, isApi) {
  const store = (res) => {
    if (res && (res.ok || res.type === 'opaqueredirect')) { const cp = res.clone(); caches.open(cacheName).then((c) => c.put(req, cp)).catch(() => {}); }
    return res;
  };
  const fallback = () => caches.match(req).then((hit) => {
    if (hit) return hit;
    if (isApi) return new Response(JSON.stringify({ offline: true, error: 'offline', message: 'You are offline — no cached copy for this yet.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    if (req.mode === 'navigate') return caches.match('/app.html');   // last-resort shell so a navigation still opens
    return Response.error();
  });
  // Firefox/Safari REJECT fetch() when a service worker re-issues an intercepted CROSS-ORIGIN Request (Chromium doesn't).
  // That rejection made networkFirst think we were offline and hand back a synthetic 503 for LIVE data (e.g. a chit that
  // was just created wouldn't appear). Before deciding we're offline, retry once with a fresh same-URL request — headers
  // are copied over (Authorization preserved), so the retry authenticates identically but avoids the re-fetch quirk.
  const clean = () => fetch(new Request(req.url, { method: 'GET', headers: req.headers, mode: 'cors', credentials: 'omit', redirect: 'follow' }));
  return fetch(req).then(store).catch(() => clean().then(store).catch(fallback));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // mutations pass straight through (outbox owns them)
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.pathname.startsWith('/api/')) { e.respondWith(networkFirst(req, APICACHE, true)); return; }   // API (cross-origin) — data read-cache
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req, SHELL, false)); return; }  // app shell / static
  // cross-origin static (Google Fonts) — cache-first to avoid repeat external calls, network fallback
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const cp = res.clone(); caches.open(EXT).then((c) => c.put(req, cp)).catch(() => {}); return res; }).catch(() => hit || Response.error())));
});

// logout hook — a shared device must not leave one entity's data in the read-cache
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'cb-clear-api') caches.delete(APICACHE);
});
