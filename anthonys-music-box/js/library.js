// Library state: tracks, derived album/artist/genre indexes, playlists,
// favorites and local listening stats. All local.
import * as DB from './db.js';
import { readMetadata, fromFilename, formatOf, signature, makeThumb } from './meta.js';
import { t as tr, onLang } from './i18n.js';

const listeners = new Set();
export const on = fn => (listeners.add(fn), () => listeners.delete(fn));
let emitTimer = 0;
export function emit(kind = 'change') {
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => listeners.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } }), 16);
}

export const L = {
  tracks: [],
  byId: new Map(),
  albums: new Map(),
  artists: new Map(),
  genres: new Map(),
  playlists: DB.readLS('smr-playlists', {}),
  favorites: new Set(DB.readLS('amb-favorites', [])),
  stats: DB.readLS('amb-stats', {}),
  persistent: true,
  storageError: '',
  ready: false,
};
if (!L.playlists || typeof L.playlists !== 'object' || Array.isArray(L.playlists)) L.playlists = {};

export const get = id => L.byId.get(id);
export const trackTitle = t => (t?.title && t.title !== 'Untitled' ? t.title : tr('Untitled'));
export const trackArtist = t => t?.artist || tr('Unknown Artist');
export const albumKeyOf = t => {
  const al = (t.album || '').trim();
  if (!al) return '~single~' + trackArtist(t).toLowerCase();
  return al.toLowerCase() + '~~' + (t.albumArtist || '').toLowerCase();
};

// ---------- artwork URLs ----------
const urlCache = new Map();
function blobURL(key, blob) {
  if (!blob) return null;
  let u = urlCache.get(key);
  if (!u) { u = URL.createObjectURL(blob); urlCache.set(key, u); }
  return u;
}
function dropURLs(id) {
  for (const k of [id + ':t', id + ':a']) { const u = urlCache.get(k); if (u) { URL.revokeObjectURL(u); urlCache.delete(k); } }
}
export const DEFAULT_ART = 'assets/default-cover.webp';
// Priority: embedded/manual art -> other track on the same album -> AMB default.
export function artOf(t, large = false) {
  if (!t) return DEFAULT_ART;
  if (large && t.art) return blobURL(t.id + ':a', t.art);
  if (t.thumb) return blobURL(t.id + ':t', t.thumb);
  if (t.art) return blobURL(t.id + ':a', t.art);
  const al = L.albums.get(albumKeyOf(t));
  if (al?.artId && al.artId !== t.id) { const o = get(al.artId); if (o) return artOf(o, large); }
  return DEFAULT_ART;
}
export const hasArt = t => !!(t && (t.thumb || t.art || get(L.albums.get(albumKeyOf(t))?.artId)));

// ---------- indexes ----------
function rebuild() {
  L.byId = new Map(L.tracks.map(t => [t.id, t]));
  const albums = new Map(), artists = new Map(), genres = new Map();
  for (const t of L.tracks) {
    if (t.video && !t.album) {
      // Music videos without an album tag live under Videos and their artist only.
      const ar = trackArtist(t);
      let r = artists.get(ar); if (!r) artists.set(ar, r = { name: ar, ids: [], albums: new Set() });
      r.ids.push(t.id);
      continue;
    }
    const k = albumKeyOf(t);
    let a = albums.get(k);
    if (!a) albums.set(k, a = { key: k, single: !t.album, title: t.album || tr('Unknown Album'), ids: [], artists: new Set(), albumArtist: t.albumArtist || '', year: 0, genre: '', added: 0, artId: null });
    a.ids.push(t.id); a.artists.add(trackArtist(t));
    if (t.year && !a.year) a.year = t.year;
    if (t.genre && !a.genre) a.genre = t.genre;
    a.added = Math.max(a.added, t.added || 0);
    if (!a.artId && (t.thumb || t.art)) a.artId = t.id;
    const ar = trackArtist(t);
    let r = artists.get(ar);
    if (!r) artists.set(ar, r = { name: ar, ids: [], albums: new Set() });
    r.ids.push(t.id); r.albums.add(k);
    if (t.albumArtist && t.albumArtist !== ar) {
      let r2 = artists.get(t.albumArtist);
      if (!r2) artists.set(t.albumArtist, r2 = { name: t.albumArtist, ids: [], albums: new Set() });
      r2.albums.add(k);
    }
    const g = t.genre || '';
    if (g) { let x = genres.get(g); if (!x) genres.set(g, x = { name: g, ids: [] }); x.ids.push(t.id); }
  }
  for (const a of albums.values()) {
    a.artist = a.albumArtist || (a.artists.size === 1 ? [...a.artists][0] : tr('Various Artists'));
    a.ids.sort((x, y) => { const p = get(x), q = get(y); return (p.disc || 1) - (q.disc || 1) || (p.track || 999) - (q.track || 999) || trackTitle(p).localeCompare(trackTitle(q)); });
  }
  for (const r of artists.values()) if (!r.ids.length) r.ids = [...r.albums].flatMap(k => albums.get(k)?.ids || []);
  L.albums = albums; L.artists = artists; L.genres = genres;
}

onLang(() => { rebuild(); emit(); });

export async function load() {
  try {
    await DB.openDB();
    const all = await DB.getAllTracks();
    L.tracks = (all || []).filter(t => t && t.id);
  } catch (e) {
    console.warn('Library storage unavailable', e);
    L.persistent = false;
    L.storageError = 'This browser mode can’t save your library, so music you add here plays for this session only.';
    L.tracks = [];
  }
  rebuild();
  L.ready = true;
  emit('load');
  idle(backfillThumbs);
}

function idle(fn) { (window.requestIdleCallback || (f => setTimeout(f, 1200)))(fn); }
async function backfillThumbs() {
  if (!L.persistent) return;
  const todo = L.tracks.filter(t => t.art && !t.thumb && !t.thumbFailed).slice(0, 400);
  for (const t of todo) {
    const th = await makeThumb(t.art);
    if (th) { t.thumb = th; try { await DB.putTrack(t); } catch { break; } }
    else t.thumbFailed = true;
    await new Promise(r => setTimeout(r, 30));
  }
  if (todo.length) emit();
}

// ---------- persistence helpers ----------
export function savePlaylists() { DB.writeLS('smr-playlists', L.playlists); emit(); }
export function saveFavorites() { DB.writeLS('amb-favorites', [...L.favorites]); emit(); }
let statsTimer = 0;
export function saveStats() { clearTimeout(statsTimer); statsTimer = setTimeout(() => DB.writeLS('amb-stats', L.stats), 400); }

export async function saveTrack(t) {
  dropURLs(t.id);
  rebuild();
  emit();
  if (L.persistent) await DB.putTrack(t);
}

export const isFav = id => L.favorites.has(id);
export function toggleFav(id, force) {
  const on = force ?? !L.favorites.has(id);
  if (on) L.favorites.add(id); else L.favorites.delete(id);
  saveFavorites();
  return on;
}

// ---------- stats ----------
export function markStarted(id) {
  const s = L.stats[id] ||= { p: 0, l: 0, n: 0 };
  s.l = Date.now();
  const h = new Date().getHours();
  if (h >= 21 || h < 4) s.n = (s.n || 0) + 1;
  saveStats(); emit('stats');
}
export function markPlayed(id) {
  const s = L.stats[id] ||= { p: 0, l: 0, n: 0 };
  s.p = (s.p || 0) + 1; saveStats(); emit('stats');
}
export const plays = id => L.stats[id]?.p || 0;
export const lastPlayed = id => L.stats[id]?.l || 0;
export function clearHistory() { L.stats = {}; DB.writeLS('amb-stats', {}); emit(); }

// ---------- import ----------
export const SUPPORTED = /\.(mp3|m4a|mp4|m4v|mov|aac|wav|wave|ogg|oga|opus|flac|aif|aiff|caf|webm)$/i;
export const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
// Metadata probe only; it never plays. A <video> probe reports both duration and picture size.
const probeEl = typeof document !== 'undefined' ? document.createElement('video') : null;
if (probeEl) { probeEl.preload = 'metadata'; probeEl.muted = true; probeEl.playsInline = true; probeEl.setAttribute('playsinline', ''); }

// Resolves {duration, width, height}; duration -1 means the browser can't decode it.
function probe(blob) {
  return new Promise(resolve => {
    if (!probeEl) return resolve({ duration: 0, width: 0, height: 0 });
    const url = URL.createObjectURL(blob);
    const done = v => { clearTimeout(tm); probeEl.onloadedmetadata = probeEl.onerror = null; probeEl.removeAttribute('src'); try { probeEl.load(); } catch {} URL.revokeObjectURL(url); resolve(v); };
    const tm = setTimeout(() => done({ duration: 0, width: 0, height: 0 }), 6000);
    probeEl.onloadedmetadata = () => done({ duration: Number.isFinite(probeEl.duration) ? probeEl.duration : 0, width: probeEl.videoWidth || 0, height: probeEl.videoHeight || 0 });
    probeEl.onerror = () => done({ duration: -1, width: 0, height: 0 });
    probeEl.src = url;
  });
}

// Grab a still from ~10% into a video to use as its artwork.
function poster(blob, duration) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    const url = URL.createObjectURL(blob);
    const done = b => { clearTimeout(tm); v.removeAttribute('src'); try { v.load(); } catch {} URL.revokeObjectURL(url); resolve(b); };
    const tm = setTimeout(() => done(null), 8000);
    v.onloadeddata = () => { try { v.currentTime = Math.min(Math.max(1, (duration || v.duration || 0) * 0.1), 8); } catch { done(null); } };
    v.onseeked = () => {
      try {
        const w = Math.min(960, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
        if (!w || !h) return done(null);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        c.toBlob(b => done(b), 'image/jpeg', 0.86);
      } catch { done(null); }
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}

export function canDecode(file) {
  if (!probeEl) return true;
  const f = formatOf(file);
  const mime = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs=opus', flac: 'audio/flac', webm: 'video/webm' }[f];
  return !mime || probeEl.canPlayType(mime) !== '';
}

let persistAsked = false;
export async function importFiles(fileList, onProgress) {
  const files = [...fileList].filter(f => SUPPORTED.test(f.name) || /^(audio|video)\//.test(f.type || ''));
  const res = { added: 0, dup: 0, failed: 0, unsupported: 0, sessionOnly: 0, ids: [] };
  if (!persistAsked && navigator.storage?.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
  const known = new Set(L.tracks.map(t => t.sig).filter(Boolean));
  const knownNames = new Set(L.tracks.map(t => (t.name || '') + '|' + (t.blob?.size ?? t.size ?? '')));
  let i = 0;
  for (const f of files) {
    onProgress?.(++i, files.length, f.name);
    try {
      if (knownNames.has(f.name + '|' + f.size)) { res.dup++; continue; }
      const sig = await signature(f);
      if (known.has(sig)) { res.dup++; continue; }
      if (!canDecode(f)) { res.unsupported++; continue; }
      const meta = await readMetadata(f);
      const fb = fromFilename(f.name);
      const t = {
        id: (crypto.randomUUID ? crypto.randomUUID() : 'amb-' + sig + '-' + Date.now().toString(36)),
        sig,
        name: f.name,
        size: f.size,
        format: formatOf(f),
        blob: f,
        added: Date.now() + i, // keep import order stable
        title: meta.title || fb.title || 'Untitled',
        artist: meta.artist || fb.artist || '',
        album: meta.album || '',
        albumArtist: meta.albumArtist || '',
        genre: meta.genre || '',
        year: meta.year || 0,
        track: meta.track || fb.track || 0,
        disc: meta.disc || 0,
        duration: meta.duration || 0,
        lyrics: meta.lyrics || '',
        art: meta.art || null,
        thumb: null,
      };
      const mayBeVideo = VIDEO_EXT.test(f.name) || (f.type || '').startsWith('video/');
      if (!t.duration || mayBeVideo) {
        const p = await probe(f);
        if (p.duration < 0) { res.unsupported++; continue; }
        if (!t.duration) t.duration = p.duration;
        if (p.width && p.height) {
          t.video = true; t.width = p.width; t.height = p.height;
          if (!t.art) t.art = await poster(f, t.duration);
        }
      }
      if (t.art) t.thumb = await makeThumb(t.art);
      if (L.persistent) {
        try { await DB.putTrack(t); }
        catch (e) {
          console.warn('store failed', e);
          t.sessionOnly = true; res.sessionOnly++;
        }
      } else t.sessionOnly = true;
      L.tracks.push(t); known.add(sig); knownNames.add(f.name + '|' + f.size);
      res.added++; if (t.video) res.videos = (res.videos || 0) + 1; res.ids.push(t.id);
      if (res.added % 12 === 0) { rebuild(); emit(); }
    } catch (e) { console.warn('import failed', f.name, e); res.failed++; }
  }
  res.skipped = fileList.length - files.length;
  rebuild(); emit();
  return res;
}

// Replace the audio data for an existing entry (re-link after eviction/corruption).
export async function relink(id, file) {
  const t = get(id); if (!t) return;
  t.blob = file; t.name = file.name; t.size = file.size; t.format = formatOf(file); t.sig = await signature(file);
  delete t.unavailable; delete t.sessionOnly;
  await saveTrack(t);
}

// Removes the AMB entry only. The user's original file is never touched.
export async function removeTracks(ids) {
  const set = new Set(ids);
  for (const id of set) {
    dropURLs(id);
    if (L.persistent) { try { await DB.deleteTrack(id); } catch (e) { console.warn(e); } }
    L.favorites.delete(id);
    delete L.stats[id];
  }
  for (const n of Object.keys(L.playlists)) L.playlists[n] = L.playlists[n].filter(x => !set.has(x));
  L.tracks = L.tracks.filter(t => !set.has(t.id));
  DB.writeLS('smr-playlists', L.playlists); DB.writeLS('amb-favorites', [...L.favorites]); saveStats();
  rebuild(); emit();
}

// ---------- playlists ----------
export function uniqueName(base) {
  let n = base.trim() || 'New Playlist', i = 2;
  while (L.playlists[n]) n = `${base.trim()} ${i++}`;
  return n;
}
export function createPlaylist(name, ids = []) { const n = uniqueName(name); L.playlists[n] = [...ids]; savePlaylists(); return n; }
export function renamePlaylist(oldName, name) {
  name = name.trim(); if (!name || name === oldName || !L.playlists[oldName]) return oldName;
  if (L.playlists[name]) name = uniqueName(name);
  const next = {};
  for (const k of Object.keys(L.playlists)) next[k === oldName ? name : k] = L.playlists[k];
  L.playlists = next; savePlaylists(); return name;
}
export function deletePlaylist(name) { delete L.playlists[name]; savePlaylists(); }
export function addToPlaylist(name, ids) { (L.playlists[name] ||= []).push(...ids); savePlaylists(); }

// ---------- derived collections ----------
const byAddedDesc = (a, b) => (b.added || 0) - (a.added || 0);
export const recentlyAdded = (n = 60) => [...L.tracks].sort(byAddedDesc).slice(0, n);
export const recentlyPlayed = (n = 40) => L.tracks.filter(t => lastPlayed(t.id)).sort((a, b) => lastPlayed(b.id) - lastPlayed(a.id)).slice(0, n);
export const mostPlayed = (n = 25) => L.tracks.filter(t => plays(t.id) > 0).sort((a, b) => plays(b.id) - plays(a.id) || lastPlayed(b.id) - lastPlayed(a.id)).slice(0, n);
export const videos = () => L.tracks.filter(t => t.video).sort(byAddedDesc);
export const favoriteTracks = () => L.tracks.filter(t => L.favorites.has(t.id)).sort((a, b) => trackTitle(a).localeCompare(trackTitle(b)));
export const totalDuration = ids => ids.reduce((s, id) => s + (get(id)?.duration || 0), 0);

// Deterministic, seeded shuffle so "Made for Anthony" mixes are stable for a day.
function seeded(arr, seed) {
  const a = [...arr]; let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) { s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const daySeed = () => { const d = new Date(); return d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate(); };
const NIGHT_GENRES = /(ambient|chill|jazz|lo-?fi|soul|r&b|rnb|classical|piano|acoustic|downtempo|trip|dream|slow|night|blues|folk|instrumental|new age)/i;

export function mixes() {
  const out = [];
  const n = L.tracks.length;
  if (n < 3) return out;
  const seed = daySeed();
  // Late Night: what you actually play after 9pm, then calmer genres from your library.
  let late = L.tracks.filter(t => (L.stats[t.id]?.n || 0) > 0).sort((a, b) => L.stats[b.id].n - L.stats[a.id].n);
  const calm = seeded(L.tracks.filter(t => NIGHT_GENRES.test(t.genre || '') && !late.includes(t)), seed);
  late = [...late, ...calm];
  if (late.length < 8) late = [...late, ...seeded(L.tracks.filter(t => !late.includes(t)), seed + 7)];
  out.push({ id: 'late', title: 'Late Night', sub: 'A continuous mix from your library', ids: late.slice(0, 40).map(t => t.id) });
  // Favorites Mix: hearts first, then the songs you replay.
  const favs = seeded(favoriteTracks(), seed + 1);
  const rot = mostPlayed(30).filter(t => !L.favorites.has(t.id));
  const fm = [...favs, ...rot].slice(0, 50);
  if (fm.length >= 3) out.push({ id: 'favorites', title: 'Favorites Mix', sub: 'Songs Anthony keeps coming back to', ids: fm.map(t => t.id) });
  // Forgotten Tracks: in the box a while, not played in the last month.
  const monthAgo = Date.now() - 30 * 864e5, weekAgo = Date.now() - 7 * 864e5;
  const forgotten = seeded(L.tracks.filter(t => (t.added || 0) < weekAgo && lastPlayed(t.id) < monthAgo), seed + 2);
  if (forgotten.length >= 5) out.push({ id: 'forgotten', title: 'Forgotten Tracks', sub: 'Great music you have not played lately', ids: forgotten.slice(0, 40).map(t => t.id) });
  // Fresh Arrivals: the latest imports, blended.
  if (n >= 8) out.push({ id: 'fresh', title: 'New in the Box', sub: 'Your latest imports, blended', ids: seeded(recentlyAdded(30), seed + 3).map(t => t.id) });
  return out;
}
export const mixById = id => mixes().find(m => m.id === id);

// ---------- search ----------
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function search(q) {
  q = norm(q).trim();
  if (!q) return null;
  const terms = q.split(/\s+/);
  const match = s => { const h = norm(s); return terms.every(w => h.includes(w)); };
  const score = (s) => { const h = norm(s); return h.startsWith(q) ? 0 : h.includes(' ' + q) ? 1 : 2; };
  const songs = L.tracks.filter(t => match([t.title, t.artist, t.album, t.albumArtist, t.genre, t.name].join(' ')))
    .sort((a, b) => score(a.title) - score(b.title) || plays(b.id) - plays(a.id) || trackTitle(a).localeCompare(trackTitle(b)));
  const albums = [...L.albums.values()].filter(a => !a.single && match(a.title + ' ' + a.artist)).sort((a, b) => score(a.title) - score(b.title));
  const artists = [...L.artists.values()].filter(a => match(a.name)).sort((a, b) => score(a.name) - score(b.name));
  const playlists = Object.keys(L.playlists).filter(n => match(n));
  const genres = [...L.genres.values()].filter(g => match(g.name));
  return { songs, albums, artists, playlists, genres };
}

export async function storageInfo() {
  const r = { usage: 0, quota: 0, persisted: false };
  try { if (navigator.storage?.estimate) Object.assign(r, await navigator.storage.estimate()); } catch {}
  try { if (navigator.storage?.persisted) r.persisted = await navigator.storage.persisted(); } catch {}
  return r;
}
