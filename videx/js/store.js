// Local media data layer: import, metadata, progress, posters, playlists and
// collections. UI-free; emits "library-changed" after writes.
import * as db from "./db.js";
import { emit, uid } from "./util.js";
import { isVideoFile, parseEpisode, cleanTitle } from "./media-meta.js";

// ------------------------------------------------------------------ media
/** All media merged with progress, newest first. */
export async function allMedia() {
  const [media, prog] = await Promise.all([db.all("media"), db.all("progress")]);
  const p = new Map(prog.map(x => [x.id, x]));
  return media.map(m => withProgress(m, p.get(m.id))).sort((a, b) => b.added - a.added);
}
function withProgress(m, pr) {
  return { ...m, position: pr?.position || 0, duration: m.duration || pr?.duration || 0, watchedAt: pr?.at || 0 };
}
export async function getMedia(id) {
  const [m, pr] = await Promise.all([db.get("media", id), db.get("progress", id)]);
  return m ? withProgress(m, pr) : null;
}
export const inProgress = m => m.position > 5 && (!m.duration || m.position < m.duration - 8);
export const remaining = m => (m.duration ? Math.max(0, m.duration - m.position) : 0);

export async function importFiles(fileList) {
  let added = 0, skipped = 0, rejected = 0;
  for (const f of fileList) {
    if (!isVideoFile(f)) { rejected++; continue; }
    const id = `${f.name}|${f.size}|${f.lastModified}`;
    if (await db.get("media", id)) { skipped++; continue; }
    const ep = parseEpisode(f.name);
    try {
      await db.put("files", { id, blob: f });
    } catch (e) {
      // Usually QuotaExceededError: the browser won't hold this file.
      emit("error", { label: "import", error: new Error(`Not enough browser storage for “${f.name}”.`) });
      continue;
    }
    await db.put("media", {
      id, filename: f.name, title: ep ? `${ep.series} S${ep.season} E${ep.episode}` : cleanTitle(f.name),
      kind: ep ? "episode" : "movie", series: ep?.series || "", season: ep?.season || 0, episode: ep?.episode || 0,
      added: Date.now() + added, favorite: false, size: f.size, mime: f.type || "", lastModified: f.lastModified,
    });
    added++;
  }
  if (added) { db.requestPersist(); emit("library-changed"); }
  return { added, skipped, rejected };
}

export async function updateMedia(id, patch) {
  const m = await db.get("media", id); if (!m) return;
  await db.put("media", { ...m, ...patch });
  emit("library-changed");
}

/** Removes the VIDeX record and its stored copy — never the user's original file. */
export async function removeMedia(id) {
  await Promise.all(["media", "files", "progress", "posters"].map(s => db.del(s, id)));
  for (const s of await db.all("subs")) if (s.mediaId === id) await db.del("subs", s.id);
  for (const g of await db.all("groups")) if (g.media.includes(id)) await db.put("groups", { ...g, media: g.media.filter(x => x !== id) });
  dropPoster(id);
  emit("library-changed");
}

/** Object URL for playback; caller revokes. Null if the stored copy is gone (evicted). */
export async function fileURL(id) {
  const f = await db.get("files", id);
  return f?.blob ? URL.createObjectURL(f.blob) : null;
}

// ------------------------------------------------------------------ progress
export async function saveProgress(id, position, duration) {
  await db.put("progress", { id, position, duration: isFinite(duration) ? duration : 0, at: Date.now() });
}
export async function markFinished(id, duration) {
  await db.put("progress", { id, position: 0, duration: isFinite(duration) ? duration : 0, at: Date.now(), finished: true });
}

// ------------------------------------------------------------------ posters
// One hidden <video> captures a small JPEG per file, once; cached in IndexedDB.
const posterURLs = new Map(), waiters = new Map(), queue = [];
let busy = false;
export function posterCached(id) { return posterURLs.get(id); }
export async function poster(id) {
  if (posterURLs.has(id)) return posterURLs.get(id);
  const p = await db.get("posters", id);
  if (p?.blob) { const u = URL.createObjectURL(p.blob); posterURLs.set(id, u); return u; }
  if (p?.failed) { posterURLs.set(id, null); return null; }
  return new Promise(res => {
    if (waiters.has(id)) waiters.get(id).push(res);
    else { waiters.set(id, [res]); queue.push(id); pump(); }
  });
}
function dropPoster(id) { const u = posterURLs.get(id); if (u) URL.revokeObjectURL(u); posterURLs.delete(id); }
async function pump() {
  if (busy) return;
  const id = queue.shift(); if (!id) return;
  busy = true;
  let url = null;
  try {
    const f = await db.get("files", id);
    if (f?.blob) {
      const r = await capture(f.blob);
      await db.put("posters", { id, blob: r.blob });
      const m = await db.get("media", id);
      if (m) await db.put("media", { ...m, width: r.w, height: r.h, duration: r.duration || m.duration || 0 });
      url = URL.createObjectURL(r.blob);
    }
  } catch {
    await db.put("posters", { id, failed: true }).catch(() => {});   // undecodable here; don't retry every render
  }
  posterURLs.set(id, url);
  waiters.get(id)?.forEach(r => r(url)); waiters.delete(id);
  busy = false;
  pump();
}
function capture(blob) {
  return new Promise((res, rej) => {
    const v = document.createElement("video"), url = URL.createObjectURL(blob);
    const done = fn => { clearTimeout(t); URL.revokeObjectURL(url); v.removeAttribute("src"); v.load(); fn(); };
    const t = setTimeout(() => done(() => rej(new Error("timeout"))), 10000);
    v.muted = true; v.playsInline = true; v.preload = "auto";
    v.onloadedmetadata = () => { const d = isFinite(v.duration) ? v.duration : 0; v.currentTime = Math.min(Math.max(d * 0.12, 0.5), 30, d || 0.5); };
    v.onseeked = () => {
      const W = 480, H = Math.round(W * ((v.videoHeight / v.videoWidth) || 0.5625));
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      c.getContext("2d").drawImage(v, 0, 0, W, H);
      c.toBlob(b => done(() => b ? res({ blob: b, w: v.videoWidth, h: v.videoHeight, duration: isFinite(v.duration) ? v.duration : 0 }) : rej(new Error("no frame"))), "image/jpeg", 0.8);
    };
    v.onerror = () => done(() => rej(v.error || new Error("decode")));
    v.src = url;
  });
}

// ------------------------------------------------------------------ groups
// type: "playlist" (ordered, playable queue) | "collection" (unordered shelf)
export async function groups(type) {
  return (await db.all("groups")).filter(g => !type || g.type === type).sort((a, b) => (a.created || 0) - (b.created || 0));
}
export const getGroup = id => db.get("groups", id);
export async function createGroup(type, name) {
  const g = { id: `${type}:${uid()}`, type, name, media: [], created: Date.now(), repeat: "off" };
  await db.put("groups", g); emit("library-changed"); return g;
}
export async function saveGroup(g) { await db.put("groups", g); emit("library-changed"); }
export async function deleteGroup(id) { await db.del("groups", id); emit("library-changed"); }
export async function toggleInGroup(gid, mid) {
  const g = await db.get("groups", gid); if (!g) return false;
  const has = g.media.includes(mid);
  g.media = has ? g.media.filter(x => x !== mid) : [...g.media, mid];
  await saveGroup(g);
  return !has;
}
export async function addManyToGroup(gid, ids) {
  const g = await db.get("groups", gid); if (!g) return;
  for (const id of ids) if (!g.media.includes(id)) g.media.push(id);
  await saveGroup(g);
}

// ------------------------------------------------------------------ subtitles
export async function subtitlesFor(mediaId) { return (await db.all("subs")).filter(s => s.mediaId === mediaId); }
export async function addSubtitle(mediaId, name, vtt) {
  const rec = { id: `${mediaId}|${name}`, mediaId, name, vtt, added: Date.now() };
  await db.put("subs", rec); return rec;
}
/** SRT → WebVTT. Leaves VTT untouched. */
export function toVTT(text) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^WEBVTT/.test(text)) return text;
  return "WEBVTT\n\n" + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2").replace(/^\d+\n(?=\d{2}:\d{2})/gm, "");
}

// ------------------------------------------------------------------ series
/** Group episodes: [{series, seasons: Map<season, episodes[]>, episodes[] (sorted)}] */
export function seriesOf(media) {
  const by = new Map();
  for (const m of media.filter(x => x.kind === "episode")) {
    const k = m.series || "Unsorted Episodes";
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(m);
  }
  return [...by].map(([series, eps]) => {
    eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode) || a.title.localeCompare(b.title));
    const seasons = new Map();
    for (const e of eps) { if (!seasons.has(e.season)) seasons.set(e.season, []); seasons.get(e.season).push(e); }
    return { series, episodes: eps, seasons, added: Math.max(...eps.map(e => e.added)) };
  }).sort((a, b) => a.series.localeCompare(b.series));
}
/** Next episode to watch: in progress → first after the last one watched → first. */
export function nextUp(s) {
  const eps = s.episodes;
  const cur = eps.filter(inProgress).sort((a, b) => b.watchedAt - a.watchedAt)[0];
  if (cur) return cur;
  const lastIdx = eps.reduce((best, e, i) => (e.watchedAt && (best < 0 || e.watchedAt > eps[best].watchedAt) ? i : best), -1);
  return eps[lastIdx + 1] || eps[0];
}
