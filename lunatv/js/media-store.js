// Local media: import, metadata, categories, relinking, progress, posters,
// subtitles, series grouping. UI-free; emits "library-changed" after writes.
// Videos are stored in this browser only — never uploaded anywhere.
import { tr, trn } from "./i18n.js";
import * as db from "./database.js";
import { emit } from "./util.js";
import { isVideoFile, parseEpisode, cleanTitle } from "./media-meta.js";
import { recordHistory } from "./collections.js";

export const CATEGORIES = [["movie", tr("Movies")], ["tv", "TV"], ["video", tr("Videos")], ["music", tr("Music Videos")], ["download", tr("Downloads")], ["other", tr("Other")]];
export const categoryName = id => tr((CATEGORIES.find(c => c[0] === id) || [, "Other"])[1]);

/** All media merged with progress, newest first. */
export async function allMedia() {
  const [media, prog] = await Promise.all([db.all("library"), db.all("progress")]);
  const p = new Map(prog.map(x => [x.id, x]));
  return media.map(m => withProgress(m, p.get(m.id))).sort((a, b) => b.added - a.added);
}
function withProgress(m, pr) {
  return { ...m, position: pr?.position || 0, duration: m.duration || pr?.duration || 0, watchedAt: pr?.at || 0, finished: !!pr?.finished };
}
export async function getMedia(id) {
  const [m, pr] = await Promise.all([db.get("library", id), db.get("progress", id)]);
  return m ? withProgress(m, pr) : null;
}
export const watchedFraction = () => db.setting("playback.watched") || 0.92;
export const inProgress = m => m.position > 5 && (!m.duration || m.position < m.duration * watchedFraction());
export const remaining = m => (m.duration ? Math.max(0, m.duration - m.position) : 0);

function guessCategory(name) {
  const ep = parseEpisode(name);
  if (ep) return { category: "tv", ep };
  if (/\b(official\s*(music\s*)?video|music\s*video|\bmv\b|lyric\s*video|live\s*at)\b/i.test(name)) return { category: "music" };
  return { category: "movie" };
}

export async function importFiles(fileList, { folder = "" } = {}) {
  let added = 0, skipped = 0, rejected = 0;
  for (const f of fileList) {
    if (!isVideoFile(f)) { rejected++; continue; }
    const id = `${f.name}|${f.size}|${f.lastModified}`;
    if (await db.get("library", id)) { skipped++; continue; }
    const { category, ep } = guessCategory(f.name);
    try {
      await db.put("files", { id, blob: f });
    } catch {
      emit("error", { label: "import", error: new Error(tr("Not enough browser storage for “{p0}”.", { p0: f.name })) });
      continue;
    }
    await db.put("library", {
      id, filename: f.name, title: ep ? `${ep.series} S${ep.season} E${ep.episode}` : cleanTitle(f.name),
      category: /download/i.test(folder) ? "download" : category, categoryAuto: true, folder,
      series: ep?.series || "", season: ep?.season || 0, episode: ep?.episode || 0,
      added: Date.now() + added, size: f.size, mime: f.type || "", lastModified: f.lastModified,
    });
    added++;
  }
  if (added) { db.requestPersist(); emit("library-changed"); }
  return { added, skipped, rejected };
}

export async function updateMedia(id, patch) {
  const m = await db.get("library", id); if (!m) return;
  await db.put("library", { ...m, ...patch });
  emit("library-changed");
}

/** Removes LunaTV's record and stored copy — never the user's original file. */
export async function removeMedia(id) {
  await Promise.all(["library", "files", "progress", "posters"].map(s => db.del(s, id)));
  await db.deleteWhere("subs", s => s.mediaId === id);
  await db.deleteWhere("history", x => x.type === "media" && x.ref === id);
  await db.deleteWhere("favorites", x => x.type === "media" && x.ref === id);
  for (const p of await db.all("playlists")) if (p.items.some(i => i.type === "media" && i.ref === id)) await db.put("playlists", { ...p, items: p.items.filter(i => !(i.type === "media" && i.ref === id)) });
  dropPoster(id);
  emit("library-changed");
}

/** Object URL for playback; caller revokes. Null if the stored copy is gone. */
export async function fileURL(id) {
  const f = await db.get("files", id);
  return f?.blob ? URL.createObjectURL(f.blob) : null;
}
export async function hasFile(id) { return !!(await db.get("files", id))?.blob; }

/**
 * Reconnect a record whose stored copy is gone (browser cleared storage).
 * Title, poster, history and position are kept; only the file is replaced.
 */
export async function relink(id, file) {
  const m = await db.get("library", id); if (!m) return { ok: false, reason: "missing" };
  if (!isVideoFile(file)) return { ok: false, reason: tr("That isn’t a video file.") };
  const warn = file.name !== m.filename ? tr("Linked “{p0}” (the original was “{p1}”).", { p0: file.name, p1: m.filename }) : "";
  await db.put("files", { id, blob: file });
  await db.put("library", { ...m, size: file.size, mime: file.type || m.mime, relinkedAt: Date.now() });
  emit("library-changed");
  return { ok: true, warn };
}

// ------------------------------------------------------------------ progress
// Position is always kept (it's how Resume works); the History list honours
// Private Session / history-off inside recordHistory().
export async function saveProgress(m, position, duration) {
  const d = isFinite(duration) ? duration : 0;
  const finished = d > 0 && position >= d * watchedFraction();
  await db.put("progress", { id: m.id, position: finished ? 0 : position, duration: d, at: Date.now(), finished });
  recordHistory({ type: "media", ref: m.id, title: m.title, snapshot: { id: m.id, title: m.title, category: m.category } });
}
export async function markFinished(m, duration) {
  await db.put("progress", { id: m.id, position: 0, duration: isFinite(duration) ? duration : 0, at: Date.now(), finished: true });
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
  if (p?.failed && p.v >= 2) { posterURLs.set(id, null); return null; }   // older failures get one retry
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
      const m = await db.get("library", id);
      if (m) await db.put("library", { ...m, width: r.w, height: r.h, duration: r.duration || m.duration || 0, category: m.categoryAuto && m.category === "movie" && r.duration && r.duration < 1200 ? "video" : m.category });
      url = URL.createObjectURL(r.blob);
    }
  } catch {
    await db.put("posters", { id, failed: true, v: 2 }).catch(() => {});   // undecodable here; don't retry every render
  }
  posterURLs.set(id, url);
  waiters.get(id)?.forEach(r => r(url)); waiters.delete(id);
  busy = false;
  pump();
}
// Still frame for the thumbnail. iOS Safari won't decode a hidden video until
// it's been asked to play, so prime it with a muted play/pause first. Frames
// that are nearly black (fade-ins, title cards) are skipped for a later one.
async function capture(blob) {
  const v = document.createElement("video"), url = URL.createObjectURL(blob);
  v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
  const wait = (ev, ms) => new Promise((res, rej) => {
    const t = setTimeout(() => { cleanup(); rej(new Error("timeout " + ev)); }, ms);
    const ok = () => { cleanup(); res(); }, bad = () => { cleanup(); rej(v.error || new Error("decode")); };
    const cleanup = () => { clearTimeout(t); v.removeEventListener(ev, ok); v.removeEventListener("error", bad); };
    v.addEventListener(ev, ok); v.addEventListener("error", bad);
  });
  const frameReady = () => new Promise(r => ("requestVideoFrameCallback" in v ? v.requestVideoFrameCallback(() => r()) : setTimeout(r, 120)));
  try {
    v.src = url;
    await wait("loadedmetadata", 10000);
    try { await v.play(); } catch { /* autoplay refused: seeking still works on most engines */ }
    v.pause();
    const d = isFinite(v.duration) ? v.duration : 0;
    const spots = d ? [0.12, 0.25, 0.5, 0.05].map(f => Math.min(Math.max(d * f, 0.5), Math.max(d - 0.2, 0))) : [0.5];
    const probe = document.createElement("canvas"); probe.width = 32; probe.height = 18;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    let at = spots[0];
    for (const t of spots) {
      at = t;
      v.currentTime = t;
      await wait("seeked", 6000);
      await Promise.race([frameReady(), new Promise(r => setTimeout(r, 400))]);
      pctx.drawImage(v, 0, 0, 32, 18);
      const px = pctx.getImageData(0, 0, 32, 18).data;
      let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
      if (sum / (px.length / 4) / 3 > 18) break;          // bright enough to be a real picture
    }
    const W = 480, H = Math.round(W * ((v.videoHeight / v.videoWidth) || 0.5625));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").drawImage(v, 0, 0, W, H);
    const out = await new Promise((res, rej) => c.toBlob(x => (x ? res(x) : rej(new Error("no frame"))), "image/jpeg", 0.82));
    return { blob: out, w: v.videoWidth, h: v.videoHeight, duration: d, at };
  } finally {
    URL.revokeObjectURL(url); v.removeAttribute("src"); v.load();
  }
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
  for (const m of media.filter(x => x.category === "tv")) {
    const k = m.series || tr("Unsorted Episodes");
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
