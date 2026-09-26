// Small shared helpers: DOM building, formatting, events, icons.
import { tr, locale } from "./i18n.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/** Build an element from an HTML string (first element child). */
export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const debounce = (fn, ms = 160) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
}
export function fmtLeft(s) {
  if (!isFinite(s) || s <= 0) return "";
  const m = Math.round(s / 60);
  if (m < 1) return tr("<1m left");
  const hh = Math.floor(m / 60), mm = m % 60;
  return tr("{d} left", { d: hh ? `${hh}h ${mm}m` : `${mm}m` });
}
export function fmtDur(s) {
  if (!isFinite(s) || s <= 0) return "";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.round(s / 60), hh = Math.floor(m / 60);
  return hh ? `${hh}h ${m % 60}m` : `${m}m`;
}
export function fmtBytes(b) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b < 10 && i ? b.toFixed(1) : Math.round(b)} ${u[i]}`;
}
export function resLabel(h) {
  if (!h) return "";
  if (h >= 2000) return "4K";
  if (h >= 1000) return "HD 1080";
  if (h >= 700) return "HD 720";
  return "SD";
}

/** App-wide event bus. */
export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
/** Subscribe; returns an unsubscribe function. */
export const on = (type, fn) => { const l = e => fn(e.detail); bus.addEventListener(type, l); return () => bus.removeEventListener(type, l); };

/** Run fn, report failures instead of throwing — keeps subsystems isolated. */
export async function guard(label, fn) {
  try { return await fn(); }
  catch (e) { console.error(label, e); emit("error", { label, error: e }); return undefined; }
}

export const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const canHover = matchMedia("(hover:hover)").matches;

// ---- Icons: simple line glyphs drawn for LunaTV (no third-party marks). ----
const P = {
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
  tv: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/>',
  playlist: '<path d="M3 6h13M3 11h13M3 16h8"/><path d="M15 15.5l5-2.5v7l-5-2.5z" fill="currentColor" stroke="none"/><path d="M19 3v6M16 6h6"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.1 4c2 0 3.5 1.1 4.9 3 1.4-1.9 2.9-3 4.9-3 3.3 0 5.5 3.2 4.3 6.6C19.5 15.4 12 20 12 20z"/>',
  heartFill: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.1 4c2 0 3.5 1.1 4.9 3 1.4-1.9 2.9-3 4.9-3 3.3 0 5.5 3.2 4.3 6.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
  download: '<circle cx="12" cy="12" r="9.2"/><path d="M12 7v9M8 12.5l4 4 4-4"/>',
  folder: '<path d="M2.5 7.5a2 2 0 0 1 2-2h4.8l2 2.2h8.2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="currentColor" stroke="none"/><path d="M2.5 10h19" stroke="rgba(0,0,0,.25)"/>',
  folderLine: '<path d="M2.5 7.5a2 2 0 0 1 2-2h4.8l2 2.2h8.2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"/>',
  home: '<path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none"/>',
  live: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
  playRect: '<rect x="2.5" y="5" width="19" height="14" rx="3.5" fill="currentColor" stroke="none"/><path d="M10 9v6l5-3z" fill="#05101c" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>', chevL: '<path d="M15 5l-7 7 7 7"/>', chevD: '<path d="M5 9l7 7 7-7"/>',
  more: '<circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  back10: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5v4h4"/><text x="12" y="15.2" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700" font-family="system-ui">10</text>',
  fwd10: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M20 3.5v4h-4"/><text x="12" y="15.2" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700" font-family="system-ui">10</text>',
  prev: '<path d="M6 5v14"/><path d="M19 5v14l-10-7z" fill="currentColor" stroke="none"/>',
  next: '<path d="M18 5v14"/><path d="M5 5v14l10-7z" fill="currentColor" stroke="none"/>',
  stepB: '<path d="M4 5v14"/><path d="M20 6v12l-9-6z"/>', stepF: '<path d="M20 5v14"/><path d="M4 6v12l9-6z"/>',
  rev: '<path d="M11 6v12l-8-6zM21 6v12l-8-6z"/>',
  camera: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2.2L9.3 4.5h5.4l1.6 2h2.2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  pip: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11.5" width="7" height="5.5" rx="1" fill="currentColor" stroke="none"/>',
  aspect: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M17 10v4M7 12h3M14 12h3"/>',
  shuffle: '<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.8 0 3-1.6 4-3.5M13.5 10.5C14.5 8.6 15.7 7 17.5 7H21"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h13M20 13v2a3 3 0 0 1-3 3H4"/><path d="M17 3l3 3-3 3M7 21l-3-3 3-3"/>',
  pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 7.5l3 3"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v6M14 11v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5v4h4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  starFill: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  signout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
  storage: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  audio: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  guide: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v11M15 9v11"/>',
  airplay: '<path d="M6 17H4.5A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H18"/><path d="M12 14l5 6H7z" fill="currentColor" stroke="none"/>',
  cast: '<path d="M3 17a4 4 0 0 1 4 4M3 13a8 8 0 0 1 8 8M3 9.2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/><circle cx="3.5" cy="20.5" r=".6" fill="currentColor"/>',
  ab: '<path d="M4 18 7.5 6 11 18M5.2 14h4.6"/><path d="M14 6h3.5a2.8 2.8 0 0 1 0 5.6H14zM14 11.6h4a3.2 3.2 0 0 1 0 6.4h-4z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  poster: '<rect x="3" y="4" width="7.5" height="16" rx="1.6"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.6"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 1.8"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none"/>',
  film2: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 8h18M3 16h18M8 3v5M16 3v5M8 16v5M16 16v5"/>',
  minimize: '<path d="M5 12h14"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5v5l4.3-2.5z" fill="currentColor" stroke="none"/>',
  folderOpen: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7.5a2 2 0 0 0-1.9 1.4L3 19z"/><path d="M3 19l2.6-7.6A2 2 0 0 1 7.5 10H22l-2.8 8a1.5 1.5 0 0 1-1.4 1z"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.5 10.5 0 0 1 12 5c5.5 0 9 5.5 9 7 0 .7-.8 2.2-2.2 3.7M6.3 6.3C4.2 7.8 3 10.9 3 12c0 1.5 3.5 7 9 7 1.8 0 3.3-.5 4.6-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};
export function icon(name, cls = "") {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

// ---- text matching for search: case/diacritic-insensitive, all tokens must match
export const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function fuzzy(q) {
  const toks = norm(q).split(" ").filter(Boolean);
  return (...fields) => { const hay = norm(fields.join(" ")); return toks.every(t => hay.includes(t)); };
}
/** Only allow http(s) URLs into src/href attributes built from untrusted data. */
export const safeURL = u => { if (!u || typeof u !== "string") return ""; try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
export const isInsecure = u => location.protocol === "https:" && /^http:/i.test(u || "");
export async function shareOrCopy({ title, url }) {
  if (navigator.share) { try { await navigator.share({ title, url }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; } }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch { return "failed"; }
}
export const canShare = () => !!navigator.share || !!navigator.clipboard;
