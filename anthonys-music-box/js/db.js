// IndexedDB wrapper. Keeps the prototype's database name and "tracks" store so
// existing libraries carry over when deployed to the same origin.
const DB_NAME = 'smr-music-v1';
const DB_VERSION = 2;
let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
    const timer = setTimeout(() => reject(new Error('IndexedDB timed out')), 8000);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      db = req.result;
      db.onversionchange = () => { db.close(); db = null; };
      resolve(db);
    };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blocked by another tab')); };
  });
}

export const hasDB = () => !!db;

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('No database'));
    let t;
    try { t = db.transaction(store, mode); } catch (e) { return reject(e); }
    let result;
    const r = fn(t.objectStore(store));
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

export const getAllTracks = () => tx('tracks', 'readonly', s => s.getAll());
export const putTrack = t => tx('tracks', 'readwrite', s => s.put(t));
export const deleteTrack = id => tx('tracks', 'readwrite', s => s.delete(id));
export const clearTracks = () => tx('tracks', 'readwrite', s => s.clear());
export const kvGet = k => tx('kv', 'readonly', s => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));

// localStorage helpers that never throw.
export function readLS(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
export function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
