// LunaTV storage: IndexedDB with an in-memory fallback, typed settings with
// defaults, and a one-time migration from the retired VIDeX database.
//
// Heavy video Blobs live alone in `files` (written once at import), so
// renaming, favoriting or saving progress never re-serialises a video.

const NAME = "lunatv", VERSION = 1;
export const STORES = [
  "meta", "settings", "library", "files", "progress", "posters", "subs", "playlists",
  "history", "favorites", "sources", "channels", "channelEdits", "epg", "metadataCache",
  "artworkOverrides", "discoverState", "reminders", "cache", "adultHistory", "adultFavorites",
];

let idb = null;
export let persistent = true;
const mem = new Map(STORES.map(s => [s, new Map()]));

export function open() {
  return new Promise(res => {
    let r;
    try { r = indexedDB.open(NAME, VERSION); } catch { persistent = false; return res(false); }
    let upgrading = false, done = false;
    const finish = ok => { if (done) return; done = true; if (!ok) persistent = false; res(ok); };
    r.onupgradeneeded = () => {
      upgrading = true;
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
    };
    r.onsuccess = () => { if (done) { r.result.close(); return; } idb = r.result; idb.onversionchange = () => idb.close(); finish(true); };
    r.onerror = () => finish(false);
    setTimeout(() => { if (!idb && !upgrading) finish(false); }, 6000);
  });
}

const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const os = (s, mode = "readonly") => idb.transaction(s, mode).objectStore(s);
export async function get(s, id) { return idb ? wrap(os(s).get(id)) : mem.get(s).get(id); }
export async function all(s) { return idb ? wrap(os(s).getAll()) : [...mem.get(s).values()]; }
export async function put(s, v) { if (idb) return wrap(os(s, "readwrite").put(v)); mem.get(s).set(v.id, v); }
export async function del(s, id) { if (idb) return wrap(os(s, "readwrite").delete(id)); mem.get(s).delete(id); }
export async function clear(s) { if (idb) return wrap(os(s, "readwrite").clear()); mem.get(s).clear(); }
export async function putMany(s, list) {
  if (!idb) { for (const v of list) mem.get(s).set(v.id, v); return; }
  await new Promise((res, rej) => { const t = idb.transaction(s, "readwrite"), o = t.objectStore(s); for (const v of list) o.put(v); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
export async function deleteWhere(s, pred) {
  const rows = (await all(s)).filter(pred);
  if (!idb) { rows.forEach(r => mem.get(s).delete(r.id)); return rows.length; }
  await new Promise((res, rej) => { const t = idb.transaction(s, "readwrite"), o = t.objectStore(s); rows.forEach(r => o.delete(r.id)); t.oncomplete = res; t.onerror = () => rej(t.error); });
  return rows.length;
}

export async function requestPersist() { try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; } }
export async function estimate() { try { return await navigator.storage?.estimate?.(); } catch { return null; } }
export async function isPersisted() { try { return await navigator.storage?.persisted?.(); } catch { return false; } }

// ------------------------------------------------------------------ settings
export const DEFAULTS = {
  "playback.speed": 1, "playback.rememberSpeed": false, "playback.skip": 10, "playback.autoplay": true,
  "playback.resume": true, "playback.watched": 0.92, "playback.gestures": true, "playback.seekSwipe": true,
  "subs.size": 100, "subs.weight": 600, "subs.color": "#ffffff", "subs.bg": "#000000", "subs.bgOpacity": 0.55,
  "subs.position": 8, "subs.lineHeight": 1.25,
  "live.surfFavorites": false,
  "discover.resume": true, "discover.provider": "local",
  "content.adult": false, "content.adultConfirmed": false, "content.saveAdultHistory": false,
  "content.hideAdultFavorites": true, "content.epornerLowQuality": false, "content.epornerGay": true,
  "library.view": "poster", "library.history": true,
  "appearance.reduceMotion": false, "appearance.ambient": true, "appearance.density": "comfortable",
  "providers.tmdbKey": "", "providers.youtubeKey": "", "providers.rapidapiKey": "",
};
const cache = new Map();
const listeners = new Set();
export async function loadSettings() {
  for (const r of await all("settings").catch(() => [])) cache.set(r.id, r.value);
}
export function setting(key) { return cache.has(key) ? cache.get(key) : DEFAULTS[key]; }
export async function setSetting(key, value) {
  cache.set(key, value);
  // tiny boot-time flags mirrored to localStorage so they apply before scripts run
  if (key === "appearance.reduceMotion") try { localStorage.setItem("lunatv.reduceMotion", value ? "1" : "0"); } catch {}
  await put("settings", { id: key, value });
  listeners.forEach(fn => fn(key, value));
}
export const onSetting = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function allSettings() { return Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, setting(k)])); }

// Private Session lives for this tab only.
export const session = {
  get private() { try { return sessionStorage.getItem("lunatv.private") === "1"; } catch { return false; } },
  set private(v) { try { sessionStorage.setItem("lunatv.private", v ? "1" : "0"); } catch {} },
  get privateAdult() { try { return sessionStorage.getItem("lunatv.privateAdult") === "1"; } catch { return false; } },
  set privateAdult(v) { try { sessionStorage.setItem("lunatv.privateAdult", v ? "1" : "0"); } catch {} },
};

// ------------------------------------------------------------------ VIDeX migration
// Reads whatever shape the old "videx" database has (the original single-file
// build stored the Blob inside `media`; the Style B build split it into
// `files`), copies everything into LunaTV, verifies, then deletes the old
// copy so videos aren't stored twice. Runs once.
function openOld() {
  return new Promise(res => {
    let r;
    try { r = indexedDB.open("videx"); } catch { return res(null); }
    r.onupgradeneeded = () => { r.transaction.abort(); };   // didn't exist: don't create it
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}
function readAll(d, s) {
  if (!d.objectStoreNames.contains(s)) return Promise.resolve([]);
  return new Promise(res => { const q = d.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); });
}

export async function migrateFromVidex(onProgress = () => {}) {
  if (!idb || await get("meta", "migration.videx")) return null;
  const old = await openOld();
  if (!old) { await put("meta", { id: "migration.videx", at: Date.now(), found: false }); return null; }
  const R = s => readAll(old, s);
  const [media, files, progress, posters, subs, groups, tvfav, tvhist, xfav, xhist, xlists, ythist] =
    await Promise.all(["media", "files", "progress", "posters", "subs", "groups", "tvfav", "tvhist", "xfav", "xhist", "xlists", "ythist"].map(R));
  const report = { media: 0, playlists: 0, favorites: 0, history: 0, sources: 0 };
  const fileIds = new Set(files.map(f => f.id));
  let i = 0;
  for (const m of media) {
    onProgress(++i / Math.max(1, media.length));
    const blob = m.blob || null;
    if (blob && !fileIds.has(m.id)) await put("files", { id: m.id, blob });
    const isShow = m.kind === "episode" || m.type === "show";
    await put("library", {
      id: m.id, title: m.title || m.name || m.filename, filename: m.filename || m.name || "", added: m.added || Date.now(),
      favorite: !!m.favorite, size: m.size || blob?.size || 0, mime: m.mime || blob?.type || "", lastModified: m.lastModified || 0,
      category: isShow ? "tv" : "movie", series: m.series || "", season: m.season || 0, episode: m.episode || 0,
      width: m.width || 0, height: m.height || 0, duration: m.duration || 0,
    });
    if (!progress.some(p => p.id === m.id) && m.position) await put("progress", { id: m.id, position: m.position, duration: m.duration || 0, at: Date.now() });
    if (m.favorite) await put("favorites", { id: `media:${m.id}`, type: "media", ref: m.id, title: m.title || m.name, at: Date.now() });
    report.media++;
  }
  for (const f of files) await put("files", f);
  await putMany("progress", progress);
  await putMany("posters", posters.filter(p => p.blob));
  await putMany("subs", subs);
  for (const g of groups) {
    await put("playlists", { id: g.id, name: g.name, items: (g.media || []).map(ref => ({ type: "media", ref })), created: g.created || Date.now(), repeat: g.repeat || "off" });
    report.playlists++;
  }
  for (const f of tvfav) { await put("favorites", { id: `channel:${f.id}`, type: "channel", ref: f.id, title: f.ch?.n, snapshot: legacyChannel(f.ch), at: f.at }); report.favorites++; }
  for (const h of tvhist) { await put("history", { id: `channel:${h.id}`, type: "channel", ref: h.id, title: h.ch?.n, snapshot: legacyChannel(h.ch), at: h.at }); report.history++; }
  for (const y of ythist) { await put("history", { id: `youtube:${y.id}`, type: "youtube", ref: y.id, title: y.title, snapshot: { id: y.id, title: y.title, channel: y.channel, thumb: y.thumb }, at: y.at }); report.history++; }
  for (const L of xlists) {
    await put("sources", { id: L.id, type: L.kind === "remote" ? "m3u-url" : L.kind === "direct" ? "direct" : "m3u", name: L.name, url: L.source || "", adult: true, added: L.added || Date.now() });
    await putMany("channels", (L.channels || []).map((c, n) => ({ ...legacyChannel(c), id: `${L.id}:${n}`, sourceId: L.id, adult: true })));
    report.sources++;
  }
  for (const f of xfav) await put("adultFavorites", { id: `channel:${f.id}`, type: "channel", ref: f.id, title: f.ch?.n, snapshot: legacyChannel(f.ch), at: f.at });

  // verify before deleting the old copy
  const lib = new Set((await all("library")).map(x => x.id));
  let ok = media.every(m => lib.has(m.id));
  for (const m of media) if (ok && (m.blob || fileIds.has(m.id)) && !(await get("files", m.id))?.blob) ok = false;
  old.close();
  if (ok) { try { indexedDB.deleteDatabase("videx"); } catch {} }
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("videx.")) localStorage.removeItem(k); } catch {}
  await put("meta", { id: "migration.videx", at: Date.now(), found: true, report, oldDeleted: ok });
  return report;
}
function legacyChannel(c = {}) {
  return { name: c.n || c.name || "Channel", url: (c.u && c.u[0]) || c.url || "", urls: c.u || (c.url ? [c.url] : []), logo: c.g || c.logo || "", group: (c.k && c.k[0]) || c.group || "Other", country: c.c || "", languages: c.l || [], tvgId: c.tvgId || "", adult: !!c.x };
}
