// IndexedDB wrapper with an in-memory fallback (private mode / blocked storage).
//
// v4 layout keeps the heavy video Blob in its own `files` store, written once
// at import. Everything that changes often (title, favorite, progress, poster,
// playlists) lives in small records, so editing never re-serialises a video.
import { parseEpisode } from "./media-meta.js";

const NAME = "videx", VERSION = 4;
const STORES = ["files", "media", "progress", "posters", "groups", "subs",
  "tvfav", "tvhist", "xfav", "xhist", "xlists", "ythist", "cache"];

let idb = null;
export let persistent = true;          // false → memory-only session
const mem = new Map(STORES.map(s => [s, new Map()]));

function upgrade(e) {
  const d = e.target.result, tx = e.target.transaction;
  for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
  // v2/v3 (the original single-file VIDeX) stored the Blob inside `media`
  // alongside name/type/position. Split it into the v4 shape.
  if (e.oldVersion > 0 && e.oldVersion < 4) {
    const media = tx.objectStore("media"), files = tx.objectStore("files"), prog = tx.objectStore("progress");
    media.openCursor().onsuccess = ev => {
      const c = ev.target.result; if (!c) return;
      const m = c.value;
      if (m.blob) {
        files.put({ id: m.id, blob: m.blob });
        if (m.position && e.oldVersion < 3) prog.put({ id: m.id, position: m.position, duration: m.duration || 0, at: Date.now() });
        const ep = parseEpisode(m.filename || m.name || "");
        c.update({
          id: m.id, title: m.name || m.filename, filename: m.filename || m.name, added: m.added || Date.now(),
          favorite: !!m.favorite, size: m.blob.size || 0, mime: m.blob.type || "",
          kind: m.type === "show" || ep ? "episode" : "movie",
          series: ep?.series || "", season: ep?.season || 0, episode: ep?.episode || 0,
        });
      }
      c.continue();
    };
  }
}

export function open() {
  return new Promise(res => {
    let r;
    try { r = indexedDB.open(NAME, VERSION); } catch { persistent = false; return res(false); }
    let upgrading = false, done = false;
    const finish = ok => { if (done) return; done = true; if (!ok) persistent = false; res(ok); };
    r.onupgradeneeded = e => { upgrading = true; upgrade(e); };
    r.onsuccess = () => { if (done) { r.result.close(); return; } idb = r.result; idb.onversionchange = () => idb.close(); finish(true); };
    r.onerror = () => finish(false);
    // Another tab on an older version blocks the upgrade; don't hang the app on it.
    // A migration that is actually running (moving Blobs) gets as long as it needs.
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

/** Ask the browser not to evict stored videos. Returns the resulting state. */
export async function requestPersist() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
export async function estimate() {
  try { return await navigator.storage?.estimate?.(); } catch { return null; }
}
export async function isPersisted() {
  try { return await navigator.storage?.persisted?.(); } catch { return false; }
}

// Light preferences only (brief §16) — never tokens.
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem("videx." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("videx." + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
