// Live TV data: sources (M3U file/URL, direct streams, the IPTV-org
// directory), channels, per-channel edits, XMLTV guides, the Now Playing
// engine and reminders. UI-free.
import * as db from "./database.js";
import { emit, norm, isInsecure } from "./util.js";
import { parseM3U, categorize, hash, ADULT_RE, CHANNEL_CATEGORIES } from "./m3u.js";
import { recordHistory } from "./collections.js";

export { CHANNEL_CATEGORIES };
const W = p => new URL(p, import.meta.url).href;

// ------------------------------------------------------------------ state
const state = { loaded: false, channels: [], byId: new Map(), edits: new Map(), sources: [], epg: [], epgIndex: new Map(), epgChan: new Map(), progress: 0 };
export const live = state;

export async function loadAll() {
  const [sources, channels, edits, epg] = await Promise.all([db.all("sources"), db.all("channels"), db.all("channelEdits"), db.all("epg")]);
  state.sources = sources.sort((a, b) => a.added - b.added);
  state.edits = new Map(edits.map(e => [e.id, e]));
  state.channels = channels.map(applyEdit);
  state.byId = new Map(state.channels.map(c => [c.id, c]));
  state.epg = epg;
  buildEpgIndex();
  state.loaded = true;
  emit("live-changed");
}
function applyEdit(c) {
  const e = state.edits.get(c.id);
  return e ? { ...c, orig: { name: c.name, category: c.category, logo: c.logo }, name: e.name || c.name, category: e.category || c.category, logo: e.logo || c.logo, hidden: !!e.hidden, order: e.order ?? c.order } : c;
}
/** Channels for ordinary Live TV: never adult, hidden ones excluded unless asked. */
export function channels({ includeHidden = false, adult = false } = {}) {
  return state.channels.filter(c => (adult ? c.adult : !c.adult) && (includeHidden || !c.hidden))
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.name.localeCompare(b.name));
}
export const channelById = id => state.byId.get(id);

// ------------------------------------------------------------------ sources
const sid = () => `src:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
async function saveChannels(source, list) {
  await db.deleteWhere("channels", c => c.sourceId === source.id);
  const seen = new Map();
  const recs = list.map((c, i) => {
    let id = `${source.id}:${hash(c.url + "|" + c.name)}`;
    const n = seen.get(id) || 0; seen.set(id, n + 1); if (n) id += `-${n}`;
    return { ...c, id, sourceId: source.id, adult: !!(source.adult || c.adult), order: i, insecure: isInsecure(c.url) };
  });
  await db.putMany("channels", recs);
  return recs.length;
}
export async function addM3U(text, { name, url = "", adult = false } = {}) {
  const r = parseM3U(text);
  if (r.isStream) return { isStream: true };
  if (!r.channels.length) throw new Error("No channels found in that playlist.");
  const source = { id: sid(), type: url ? "m3u-url" : "m3u", name: name || "Playlist", url, adult, added: Date.now(), epgUrl: r.epgUrl };
  const n = await saveChannels(source, r.channels);
  await db.put("sources", { ...source, count: n, updated: Date.now() });
  await loadAll();
  const insecure = r.channels.filter(c => isInsecure(c.url)).length;
  return { count: n, adultCount: r.channels.filter(c => c.adult).length, epgUrl: r.epgUrl, insecure, needsHeaders: r.channels.filter(c => c.needsHeaders).length };
}
export async function fetchText(url, timeout = 20000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`The server answered HTTP ${r.status}.`);
    return await r.text();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The server took too long to answer.");
    if (e instanceof TypeError) throw new Error("LunaTV couldn’t download that. The server may not allow browsers to read it (CORS), or it’s unreachable. Download the file and import it instead.");
    throw e;
  } finally { clearTimeout(t); }
}
export async function addM3UUrl(url, opts = {}) {
  const text = await fetchText(url);
  const r = await addM3U(text, { name: opts.name || new URL(url).hostname, url, adult: opts.adult });
  if (r.isStream) { await addDirect(opts.name || new URL(url).hostname, url, opts); return { count: 1, direct: true }; }
  return r;
}
export async function addDirect(name, url, { adult = false } = {}) {
  let src = state.sources.find(s => s.type === "direct" && !!s.adult === !!adult);
  if (!src) { src = { id: sid(), type: "direct", name: adult ? "Adult Direct Streams" : "Direct Streams", adult, added: Date.now() }; }
  const existing = state.channels.filter(c => c.sourceId === src.id);
  const rec = { id: `${src.id}:${hash(url + "|" + name)}`, sourceId: src.id, name, url, urls: [url], logo: "", tvgId: "", group: "Direct", category: categorize(name), adult, order: existing.length, insecure: isInsecure(url) };
  await db.put("channels", rec);
  await db.put("sources", { ...src, count: existing.length + 1, updated: Date.now() });
  await loadAll();
  return rec;
}
export async function refreshSource(id) {
  const s = state.sources.find(x => x.id === id); if (!s) return;
  if (s.type === "m3u-url") {
    const r = parseM3U(await fetchText(s.url));
    if (!r.channels.length) throw new Error("The playlist is empty now.");
    const n = await saveChannels(s, r.channels);
    await db.put("sources", { ...s, count: n, updated: Date.now(), epgUrl: r.epgUrl || s.epgUrl });
  } else if (s.type === "directory") await addDirectory({ refresh: s });
  else if (s.type === "xmltv-url") await addXMLTV({ url: s.url, refresh: s });
  await loadAll();
}
export async function removeSource(id) {
  await db.del("sources", id);
  await db.deleteWhere("channels", c => c.sourceId === id);
  await db.del("epg", id);
  await loadAll();
}
export async function renameSource(id, name) { const s = await db.get("sources", id); if (s) { await db.put("sources", { ...s, name }); await loadAll(); } }

// IPTV-org worldwide directory as an optional one-tap source.
export const DIRECTORY = { name: "Worldwide Free Channels (IPTV-org)", base: "https://iptv-org.github.io/api/" };
export function addDirectory({ refresh } = {}) {
  return new Promise((res, rej) => {
    const w = new Worker(W("./workers/directory-worker.js"));
    const t = setTimeout(() => { w.terminate(); rej(new Error("The directory took too long to load.")); }, 120000);
    w.onmessage = async e => {
      const m = e.data;
      if ("progress" in m) { state.progress = m.progress; emit("live-progress", m.progress); return; }
      clearTimeout(t); w.terminate();
      if (!m.ok) return rej(new Error(m.error));
      const d = m.data, source = refresh || { id: sid(), type: "directory", name: DIRECTORY.name, url: DIRECTORY.base, added: Date.now() };
      const list = d.channels.map(c => ({
        name: c.n, url: c.u[0], urls: c.u, tvgId: c.id, logo: c.g, group: d.categories[c.k[0]] || c.k[0],
        category: categorize(c.k.map(k => d.categories[k] || k).join(" "), c.n), country: c.c, countryName: d.countries[c.c]?.name || c.c, flag: d.countries[c.c]?.flag || "",
        languages: c.l, labels: c.lb, adult: c.x || ADULT_RE.test(c.n),
      }));
      try {
        const n = await saveChannels(source, list);
        await db.put("sources", { ...source, count: n, dropped: d.dropped, updated: Date.now() });
        await loadAll();
        res({ count: n, dropped: d.dropped });
      } catch (err) { rej(err); }
    };
    w.onerror = e => { clearTimeout(t); w.terminate(); rej(new Error(e.message || "Directory worker failed")); };
    w.postMessage({ provider: "iptv-org", base: DIRECTORY.base, https: location.protocol === "https:" });
  });
}

// ------------------------------------------------------------------ channel edits
export async function editChannel(id, patch) {
  const cur = state.edits.get(id) || { id };
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
  if (Object.keys(next).length === 1) await db.del("channelEdits", id); else await db.put("channelEdits", next);
  await loadAll();
}
export async function restoreChannel(id) { await db.del("channelEdits", id); await loadAll(); }
export async function moveChannel(id, dir, list) {
  const i = list.findIndex(c => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  await editChannel(a.id, { order: (b.order ?? j) }); await editChannel(b.id, { order: (a.order ?? i) });
}

// ------------------------------------------------------------------ XMLTV / EPG
export function parseXMLTV(input) {
  return new Promise((res, rej) => {
    const w = new Worker(W("./workers/xmltv-worker.js"));
    const t = setTimeout(() => { w.terminate(); rej(new Error("The guide took too long to process.")); }, 120000);
    w.onmessage = e => { clearTimeout(t); w.terminate(); e.data.ok ? res(e.data.data) : rej(new Error(e.data.error)); };
    w.onerror = e => { clearTimeout(t); w.terminate(); rej(new Error(e.message || "Guide worker failed")); };
    w.postMessage({ input }, input instanceof ArrayBuffer ? [input] : []);
  });
}
export async function addXMLTV({ buffer, url, name, refresh } = {}) {
  const data = await parseXMLTV(buffer || url);
  if (!data.count) throw new Error("No current or upcoming programmes were found in that guide.");
  const src = refresh || { id: sid(), type: url ? "xmltv-url" : "xmltv", name: name || (url ? new URL(url).hostname : "Guide"), url: url || "", added: Date.now() };
  await db.put("epg", { id: src.id, at: Date.now(), channels: data.channels, programmes: data.programmes });
  await db.put("sources", { ...src, guide: true, count: data.count, updated: Date.now() });
  await loadAll();
  const matched = state.channels.filter(c => programmesFor(c).length).length;
  return { programmes: data.count, guideChannels: data.channels.length, matched };
}

function buildEpgIndex() {
  state.epgIndex = new Map(); state.epgChan = new Map();
  const byName = new Map();
  for (const g of state.epg) {
    for (const ch of g.channels || []) {
      state.epgChan.set(ch.id.toLowerCase(), { ...ch, src: g.id });
      for (const n of ch.names || []) byName.set(norm(n), ch.id.toLowerCase());
    }
    for (const [cid, list] of Object.entries(g.programmes || {})) {
      const k = cid.toLowerCase(), prev = state.epgIndex.get(k);
      if (!prev) { state.epgIndex.set(k, list); continue; }
      // the same channel in two guides: keep one copy of each programme
      const seen = new Set(prev.map(p => `${p.s}|${p.t}`));
      state.epgIndex.set(k, prev.concat(list.filter(p => !seen.has(`${p.s}|${p.t}`))).sort((a, b) => a.s - b.s));
    }
  }
  // tvg-id first; fall back to an exact normalised-name match (never fuzzy — wrong guide data is worse than none)
  for (const c of state.channels) {
    const id = c.tvgId && state.epgIndex.has(c.tvgId.toLowerCase()) ? c.tvgId.toLowerCase()
      : byName.get(norm(c.tvgName)) || byName.get(norm(c.name)) || byName.get(norm(c.name.replace(/\s*\b(hd|sd|fhd|uhd|4k)\b\s*/gi, " ")));
    c.epgId = id && state.epgIndex.has(id) ? id : "";
    if (c.epgId && !c.logo) c.logo = state.epgChan.get(c.epgId)?.icon || "";
  }
}
export const programmesFor = c => (c?.epgId ? state.epgIndex.get(c.epgId) || [] : []);
export const hasGuide = () => state.epgIndex.size > 0;

// ------------------------------------------------------------------ Now Playing engine
/** Active when start ≤ now < end. */
export function nowNext(c, now = Date.now()) {
  const list = programmesFor(c);
  const i = list.findIndex(p => p.s <= now && p.e > now);
  const cur = i >= 0 ? list[i] : null, next = i >= 0 ? list[i + 1] : list.find(p => p.s > now);
  return { now: cur ? progressOf(cur, now) : null, next: next || null };
}
export function progressOf(p, now = Date.now()) {
  const duration = p.e - p.s, elapsed = Math.max(0, now - p.s);
  return { ...p, title: p.t, duration, elapsed, remaining: Math.max(0, p.e - now), progress: Math.min(1, elapsed / duration) };
}
export const isMovie = (p, c) => p.cat?.some(x => /movie|film|cine|pel[ií]cula|kino/i.test(x)) || ((c?.category === "Movies") && (p.e - p.s) >= 75 * 60000 && !p.episode);
export function liveNow({ adult = false } = {}) {
  const now = Date.now(), out = [];
  for (const c of channels({ adult })) { const nn = nowNext(c, now); if (nn.now) out.push({ channel: c, program: nn.now, next: nn.next }); }
  return out;
}
export function moviesOnNow() { return liveNow().filter(x => isMovie(x.program, x.channel)).sort((a, b) => a.program.remaining - b.program.remaining); }
export function comingUp({ hours = 24, limit = 40 } = {}) {
  const now = Date.now(), until = now + hours * 3600e3, out = [];
  for (const c of channels()) for (const p of programmesFor(c)) if (p.s > now && p.s < until && isMovie(p, c)) out.push({ channel: c, program: p });
  return out.sort((a, b) => a.program.s - b.program.s).slice(0, limit);
}
export function whenLabel(p, now = Date.now()) {
  const mins = Math.round((p.s - now) / 60000);
  if (mins <= 0) return "On now";
  if (mins < 60) return `Starts in ${mins} min`;
  const d = new Date(p.s), today = new Date(now), tmr = new Date(now + 86400e3);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return d.getHours() >= 17 ? `Tonight · ${t}` : `Today · ${t}`;
  if (d.toDateString() === tmr.toDateString()) return `Tomorrow · ${t}`;
  return `${d.toLocaleDateString([], { weekday: "short" })} · ${t}`;
}
export const progKey = (c, p) => `${c.id}@${p.s}`;

// ------------------------------------------------------------------ watching history
export function recordChannel(c) {
  recordHistory({ type: "channel", ref: c.id, title: c.name, adult: !!c.adult, snapshot: { id: c.id, name: c.name, logo: c.logo, url: c.url, urls: c.urls } });
}

// ------------------------------------------------------------------ reminders
// Work while LunaTV is open. System notifications are used only where the
// browser supports and the user has allowed them; otherwise an in-app notice.
let remT = null;
export async function reminders() { return (await db.all("reminders")).sort((a, b) => a.start - b.start); }
export async function toggleReminder(c, p) {
  const id = progKey(c, p);
  if (await db.get("reminders", id)) { await db.del("reminders", id); emit("reminders-changed"); return false; }
  await db.put("reminders", { id, channelId: c.id, channel: c.name, title: p.t, start: p.s });
  if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch {} }
  emit("reminders-changed");
  return true;
}
export async function hasReminder(c, p) { return !!(await db.get("reminders", progKey(c, p))); }
export function startReminderLoop(onDue) {
  clearInterval(remT);
  const check = async () => {
    const now = Date.now();
    for (const r of await reminders()) {
      if (r.start - now <= 60000) {
        await db.del("reminders", r.id);
        if (r.start > now - 30 * 60000) {
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) try { new Notification(`${r.title} is starting`, { body: `On ${r.channel}`, icon: W("../assets/icons/icon-192.png") }); } catch {}
          onDue(r);
        }
        emit("reminders-changed");
      }
    }
  };
  check(); remT = setInterval(check, 30000);
}
