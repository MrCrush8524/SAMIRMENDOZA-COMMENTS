// Favorites, history and playlists — one model for every kind of item:
//   { id: "<type>:<ref>", type: "media"|"channel"|"program"|"youtube"|"feed"|"playlist",
//     ref, title, snapshot, at, adult? }
// Adult items live in their own stores (adultFavorites / adultHistory) and are
// never returned by the general functions unless the user allows it.
import * as db from "./database.js";
import { emit, uid } from "./util.js";

const key = (type, ref) => `${type}:${ref}`;
const adultStores = { fav: "adultFavorites", hist: "adultHistory" };

// ------------------------------------------------------------------ history
export function historyAllowed(adult = false) {
  if (db.session.private) return false;
  if (adult) return db.setting("content.saveAdultHistory") && !db.session.privateAdult;
  return db.setting("library.history");
}
export async function recordHistory(item) {
  if (!historyAllowed(!!item.adult)) return;
  const store = item.adult ? adultStores.hist : "history";
  await db.put(store, { ...item, id: key(item.type, item.ref), at: Date.now() });
  const all = (await db.all(store)).sort((a, b) => b.at - a.at);
  if (all.length > 300) for (const old of all.slice(300)) await db.del(store, old.id);
  emit("history-changed");
}
export async function history({ adult = false, type } = {}) {
  const rows = await db.all(adult ? adultStores.hist : "history");
  return rows.filter(r => !type || r.type === type).sort((a, b) => b.at - a.at);
}
export async function removeHistory(id, adult = false) { await db.del(adult ? adultStores.hist : "history", id); emit("history-changed"); }
export async function clearHistory({ adult = false, type } = {}) {
  const store = adult ? adultStores.hist : "history";
  if (type) await db.deleteWhere(store, r => r.type === type); else await db.clear(store);
  emit("history-changed");
}

// ------------------------------------------------------------------ favorites
const favCache = { general: new Set(), adult: new Set() };
export async function loadFavorites() {
  favCache.general = new Set((await db.all("favorites")).map(f => f.id));
  favCache.adult = new Set((await db.all(adultStores.fav)).map(f => f.id));
}
export const isFavorite = (type, ref, adult = false) => favCache[adult ? "adult" : "general"].has(key(type, ref));
/** Favorites are explicit user actions, so they're saved even in Private Session. */
export async function toggleFavorite(item) {
  const store = item.adult ? adultStores.fav : "favorites", id = key(item.type, item.ref), set = favCache[item.adult ? "adult" : "general"];
  if (set.has(id)) { await db.del(store, id); set.delete(id); emit("favorites-changed"); return false; }
  await db.put(store, { ...item, id, at: Date.now() }); set.add(id);
  emit("favorites-changed");
  return true;
}
export async function favorites({ type, includeAdult = false } = {}) {
  let rows = await db.all("favorites");
  if (includeAdult && db.setting("content.adult") && !db.setting("content.hideAdultFavorites")) rows = rows.concat(await db.all(adultStores.fav));
  return rows.filter(r => !type || r.type === type).sort((a, b) => b.at - a.at);
}
export async function adultFavorites() { return (await db.all(adultStores.fav)).sort((a, b) => b.at - a.at); }
export async function clearAdultFavorites() { await db.clear(adultStores.fav); favCache.adult.clear(); emit("favorites-changed"); }

// ------------------------------------------------------------------ playlists
// items: [{ type: "media"|"youtube", ref, title?, snapshot? }]
export async function playlists() { return (await db.all("playlists")).sort((a, b) => (a.order ?? a.created) - (b.order ?? b.created)); }
export const getPlaylist = id => db.get("playlists", id);
export async function createPlaylist(name) {
  const p = { id: `pl:${uid()}`, name, items: [], created: Date.now(), repeat: "off" };
  await db.put("playlists", p); emit("library-changed"); return p;
}
export async function savePlaylist(p) { await db.put("playlists", p); emit("library-changed"); }
export async function deletePlaylist(id) {
  await db.del("playlists", id);
  await db.deleteWhere("favorites", f => f.type === "playlist" && f.ref === id);
  emit("library-changed");
}
const same = (a, b) => a.type === b.type && a.ref === b.ref;
export async function toggleInPlaylist(pid, item) {
  const p = await getPlaylist(pid); if (!p) return false;
  const has = p.items.some(i => same(i, item));
  p.items = has ? p.items.filter(i => !same(i, item)) : [...p.items, item];
  await savePlaylist(p);
  return !has;
}
export async function addManyToPlaylist(pid, items) {
  const p = await getPlaylist(pid); if (!p) return;
  for (const it of items) if (!p.items.some(i => same(i, it))) p.items.push(it);
  await savePlaylist(p);
}
export async function playlistsContaining(item) { return (await playlists()).filter(p => p.items.some(i => same(i, item))).map(p => p.id); }
