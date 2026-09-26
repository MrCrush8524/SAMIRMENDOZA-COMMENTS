// LunaTV app-shell cache.
// Caches only LunaTV's own files (HTML, CSS, JS, brand art, icons, the bundled
// HLS engine). It never caches live channels, YouTube, Eporner or any adult
// feed, remote movies, local video blobs, or anything from another origin.
// Cache name comes from the version in the registration URL; old caches are
// removed on upgrade. Paths are relative, so it works under /lunatv/ too.
const V = new URL(self.location).searchParams.get("v") || "dev";
const CACHE = `lunatv-${V}`;
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/ui.js", "js/util.js", "js/database.js", "js/version.js", "js/collections.js", "js/media-store.js", "js/media-meta.js",
  "js/library.js", "js/playlists.js", "js/player.js", "js/subtitles.js", "js/m3u.js", "js/channels.js", "js/live.js", "js/metadata.js",
  "js/youtube.js", "js/cast.js", "js/push.js", "js/push-config.js", "js/discover.js", "js/home.js", "js/search.js", "js/settings.js",
  "js/providers/provider-base.js", "js/providers/registry.js", "js/providers/local.js", "js/providers/youtube.js", "js/providers/json-feed.js", "js/providers/eporner.js", "js/providers/xfree.js",
  "js/workers/xmltv-worker.js", "js/workers/directory-worker.js", "vendor/hls.min.js",
  "assets/branding/lunatv-crescent.webp", "assets/branding/lunatv-mark.webp", "assets/branding/lunatv-wordmark.webp", "assets/branding/lunatv-logo.webp",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png",
];
const SCOPE = new URL("./", self.location).pathname;
const inShell = url => { const p = url.pathname.startsWith(SCOPE) ? url.pathname.slice(SCOPE.length) : null; return p !== null && (p === "" || SHELL.includes(p)); };

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("lunatv-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || req.headers.has("range") || !inShell(url)) return;   // everything else goes straight to the network
  // Network first (updates land immediately), cache when offline.
  e.respondWith(fetch(req).then(r => {
    if (r.ok && r.type === "basic") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});

// Web Push (active once js/push-config.js points at a push sender).
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data?.text?.() || "LunaTV" }; }
  e.waitUntil(self.registration.showNotification(d.title || "LunaTV", { body: d.body || "", icon: "assets/icons/icon-192.png", badge: "assets/icons/favicon-32.png", tag: d.id || "lunatv", data: { url: d.url || "./#/live" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.location).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(new URL("./", self.location).href));
    if (c) { c.navigate?.(target); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
