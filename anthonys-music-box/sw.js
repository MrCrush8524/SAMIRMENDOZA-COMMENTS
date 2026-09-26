// App-shell cache only. Local playback never depends on this worker; music
// lives in IndexedDB and plays from blob URLs even if the worker fails.
const VERSION = 'amb-v2.3.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/ui.js', './js/icons.js', './js/library.js', './js/engine.js', './js/meta.js', './js/db.js', './js/radio.js',
  './assets/wolf.webp', './assets/logo-full.webp', './assets/wolf.png', './assets/default-cover.webp', './assets/default-cover.jpg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Remove this app's older caches, including the prototype's.
    await Promise.all(keys.filter(k => k !== VERSION && /^(amb-|lmp-shell|smr-music-shell)/.test(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // radio streams & directory go straight to the network
  if (req.headers.has('range')) return;
  // Network first for navigations so updates land; cache fallback keeps it working offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Stale-while-revalidate for the shell's static files.
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
