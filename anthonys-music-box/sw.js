// App-shell cache only. Local playback never depends on this worker; music
// lives in IndexedDB and plays from blob URLs even if the worker fails.
// Network first for everything, so a new Netlify deploy shows up on the next
// launch; the cache is only the offline fallback.
const VERSION = 'amb-v2.7.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/ui.js', './js/icons.js', './js/library.js', './js/engine.js', './js/meta.js', './js/db.js', './js/radio.js', './js/native.js', './js/version.js', './js/i18n.js', './js/lang/es.js', './js/lang/pt.js',
  './assets/wolf.webp', './assets/logo-full.webp', './assets/default-cover.webp', './assets/default-cover.jpg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true });
      return hit || (req.mode === 'navigate' ? cache.match('./') : undefined) || Response.error();
    }
  })());
});
