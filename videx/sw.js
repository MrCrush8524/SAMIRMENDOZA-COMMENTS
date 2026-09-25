// App-shell cache. Network-first for pages and code (so updates land
// immediately), cache fallback when offline. Never caches video, streams,
// channel data or Google/YouTube traffic.
const VERSION = "videx-v4-1";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/util.js", "js/db.js", "js/ui.js", "js/store.js", "js/media-meta.js",
  "js/player.js", "js/library.js", "js/tv.js", "js/directory-worker.js", "js/youtube.js", "js/home.js", "js/search.js",
  "logo-mark.webp", "bg.webp", "icon-192.png", "icon-512.png", "manifest.webmanifest"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && SHELL.some(p => u.pathname.endsWith(p.replace("./", "/")))) { const c = r.clone(); caches.open(VERSION).then(cc => cc.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
