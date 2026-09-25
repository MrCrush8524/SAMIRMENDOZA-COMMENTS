// Live TV (worldwide free directory) and X TV (separate 18+ area).
// Both browse Country → Category → Channel with the same components, but
// they never share data: X TV has its own favorites, history and imports,
// and adult channels never appear in Live TV, global search or Home.
import { $, h, esc, icon, debounce, emit, on } from "./util.js";
import * as db from "./db.js";
import { setRoot, push, back, sheet, toast, ask, confirmBox, pinPad, searchField, incremental, popWhere } from "./ui.js";
import { playStream } from "./player.js";

const SOURCE = { provider: "iptv-org", name: "IPTV-org community directory", base: "https://iptv-org.github.io/api/" };
const TTL = 12 * 3600e3;
const CACHE_ID = "dir:" + SOURCE.provider;

// ------------------------------------------------------------------ directory
const dir = { state: "idle", data: null, error: "", progress: 0, live: [], adult: [] };
let loading = null;
export const directory = () => dir;

export function loadDirectory({ force = false } = {}) {
  if (loading) return loading;
  loading = (async () => {
    if (!dir.data) {
      const cached = await db.get("cache", CACHE_ID).catch(() => null);
      if (cached?.data) setData(cached.data);
    }
    if (!force && dir.data && Date.now() - dir.data.at < TTL) return;
    if (!dir.data) { dir.state = "loading"; emit("dir"); }
    try {
      const data = await fetchDirectory();
      setData(data);
      db.put("cache", { id: CACHE_ID, data }).catch(() => {});
    } catch (e) {
      if (!dir.data) { dir.state = "error"; dir.error = e.message || String(e); emit("dir"); }
      else toast("Couldn’t refresh the channel directory. Showing the saved copy.");
    }
  })().finally(() => { loading = null; });
  return loading;
}
function setData(data) {
  dir.data = data; dir.state = "ready"; dir.error = "";
  dir.live = data.channels.filter(c => !c.x);
  dir.adult = data.channels.filter(c => c.x);
  emit("dir");
}
function fetchDirectory() {
  return new Promise((res, rej) => {
    let w;
    try { w = new Worker("js/directory-worker.js"); } catch (e) { return rej(e); }
    const t = setTimeout(() => { w.terminate(); rej(new Error("The channel directory took too long to load.")); }, 90000);
    w.onmessage = e => {
      const m = e.data;
      if ("progress" in m) { dir.progress = m.progress; emit("dir-progress"); return; }
      clearTimeout(t); w.terminate();
      m.ok ? res(m.data) : rej(new Error(m.error));
    };
    w.onerror = e => { clearTimeout(t); w.terminate(); rej(new Error(e.message || "Directory worker failed")); };
    w.postMessage({ provider: SOURCE.provider, base: SOURCE.base, https: location.protocol === "https:" });
  });
}

// ------------------------------------------------------------------ helpers
const flagOf = code => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐";
export function countryInfo(code) {
  const c = dir.data?.countries?.[code];
  return c ? { name: c.name, flag: c.flag } : { name: code || "Unspecified", flag: flagOf(code) };
}
export const catName = id => dir.data?.categories?.[id] || id;

function countriesOf(chs) {
  const m = new Map();
  for (const c of chs) m.set(c.c, (m.get(c.c) || 0) + 1);
  return [...m].map(([code, count]) => ({ code, count, ...countryInfo(code) })).sort((a, b) => a.name.localeCompare(b.name));
}
function categoriesOf(chs) {
  const m = new Map();
  for (const c of chs) for (const k of c.k) m.set(k, (m.get(k) || 0) + 1);
  return [...m].map(([id, count]) => ({ id, count, name: catName(id) }))
    .sort((a, b) => (a.id === "other") - (b.id === "other") || b.count - a.count || a.name.localeCompare(b.name));
}
const matches = (c, q) => c.n.toLowerCase().includes(q) || c.net?.toLowerCase().includes(q) || countryInfo(c.c).name.toLowerCase().includes(q);

// ------------------------------------------------------------------ favorites & history
// ctx.adult picks the store pair; the two never mix.
const stores = adult => adult ? { fav: "xfav", hist: "xhist" } : { fav: "tvfav", hist: "tvhist" };
const favIds = { true: new Set(), false: new Set() };
async function loadFavIds() {
  for (const a of [false, true]) favIds[a] = new Set((await db.all(stores(a).fav)).map(f => f.id));
}
export async function favorites(adult = false) { return (await db.all(stores(adult).fav)).sort((a, b) => b.at - a.at).map(f => f.ch); }
export async function recents(adult = false) { return (await db.all(stores(adult).hist)).sort((a, b) => b.at - a.at).map(f => f.ch); }
async function toggleFav(ch, adult) {
  const s = stores(adult).fav;
  if (favIds[adult].has(ch.id)) { await db.del(s, ch.id); favIds[adult].delete(ch.id); return false; }
  await db.put(s, { id: ch.id, ch, at: Date.now() }); favIds[adult].add(ch.id); return true;
}
async function addHistory(ch, adult) {
  const s = stores(adult).hist;
  await db.put(s, { id: ch.id, ch, at: Date.now() });
  const all = (await db.all(s)).sort((a, b) => b.at - a.at);
  for (const old of all.slice(40)) await db.del(s, old.id);
  emit(adult ? "xtv-changed" : "tv-changed");
}
export async function clearHistory(adult = false) { await db.clear(stores(adult).hist); emit(adult ? "xtv-changed" : "tv-changed"); }

export function playChannel(ch, adult = false) {
  playStream({ name: ch.n, urls: ch.u }, { onStarted: () => addHistory(ch, adult) });
}

// ------------------------------------------------------------------ channel card
export function channelCard(ch, { adult = false, mini = false } = {}) {
  const info = countryInfo(ch.c);
  const meta = [info.name, catName(ch.k[0]), ch.l?.[0]].filter(Boolean).join(" · ");
  const avail = [...(ch.lb || []), ch.warn].filter(Boolean).join(" · ");
  const initials = esc(ch.n.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "TV");
  const el = h(`<div class="channel glass${mini ? " channel-mini" : ""}">
    <button class="open" aria-label="Play ${esc(ch.n)}"></button>
    <div class="logo-box">${ch.g ? `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" src="${esc(ch.g)}">` : `<span class="ph">${initials}</span>`}</div>
    <b>${esc(ch.n)}</b><small>${esc(meta)}</small>${avail ? `<span class="avail">${esc(avail)}</span>` : ""}
    <button class="fav${favIds[adult].has(ch.id) ? " on" : ""}" aria-label="Favorite ${esc(ch.n)}" aria-pressed="${favIds[adult].has(ch.id)}">${icon(favIds[adult].has(ch.id) ? "heartFill" : "heart")}</button>
  </div>`);
  const img = el.querySelector("img");
  if (img) img.onerror = () => img.replaceWith(h(`<span class="ph">${initials}</span>`));
  el.querySelector(".open").onclick = () => playChannel(ch, adult);
  const fav = el.querySelector(".fav");
  fav.onclick = async e => {
    e.stopPropagation();
    const on = await toggleFav(ch, adult);
    fav.classList.toggle("on", on); fav.setAttribute("aria-pressed", on); fav.innerHTML = icon(on ? "heartFill" : "heart");
    toast(on ? "Added to favorites" : "Removed from favorites");
    emit(adult ? "xtv-changed" : "tv-changed");
  };
  return el;
}

function channelGrid(container, chs, adult, root) {
  const g = h(`<div class="ch-grid"></div>`);
  container.append(g);
  return incremental(g, chs, c => channelCard(c, { adult }), { chunk: 48, root });
}
function countryRow(c, onClick) {
  const b = h(`<button class="row"><span class="flag" aria-hidden="true">${c.flag}</span><span class="label">${esc(c.name)}</span><span class="trail"><span class="count">${c.count.toLocaleString()}</span><span class="chev">${icon("chevR")}</span></span></button>`);
  b.onclick = onClick; return b;
}
function rail(title, items, render) {
  const s = h(`<section class="shelf"><h2 class="shelf-h">${esc(title)}</h2><div class="rail"></div></section>`);
  items.forEach(i => s.lastElementChild.append(render(i)));
  return s;
}

// ------------------------------------------------------------------ Country → Category → Channel
/** ctx: {adult, channels: () => array, scope: label} */
function openCountry(code, ctx) {
  const info = countryInfo(code);
  push({
    title: info.name, build(content, view) {
      let stop = () => {};
      const all = () => ctx.channels().filter(c => c.c === code);
      const results = h(`<div></div>`);
      const render = q => {
        stop(); results.innerHTML = "";
        const chs = all();
        if (q) {
          const hits = chs.filter(c => matches(c, q));
          results.append(h(`<p class="note">${hits.length.toLocaleString()} channel${hits.length === 1 ? "" : "s"} in ${esc(info.name)}</p>`));
          stop = channelGrid(results, hits, ctx.adult, view);
          return;
        }
        const list = h(`<div class="list glass"></div>`);
        const allRow = h(`<button class="row"><span class="ic">${icon("grid")}</span><span class="label">All Channels</span><span class="trail"><span class="count">${chs.length.toLocaleString()}</span><span class="chev">${icon("chevR")}</span></span></button>`);
        allRow.onclick = () => openCategory(code, null, ctx);
        list.append(allRow);
        for (const k of categoriesOf(chs)) {
          const r = h(`<button class="row"><span class="ic">${icon("live")}</span><span class="label">${esc(k.name)}</span><span class="trail"><span class="count">${k.count.toLocaleString()}</span><span class="chev">${icon("chevR")}</span></span></button>`);
          r.onclick = () => openCategory(code, k.id, ctx);
          list.append(r);
        }
        results.append(h(`<div class="section-label">Categories</div>`), list);
      };
      content.append(h(`<div class="big-title">${info.flag} ${esc(info.name)}</div>`), searchField(`Search ${info.name}`, render), results);
      render("");
      return { destroy: () => stop() };
    },
  });
}

function openCategory(code, cat, ctx) {
  const info = countryInfo(code);
  push({
    title: cat ? catName(cat) : info.name, build(content, view) {
      let stop = () => {};
      const grid = h(`<div></div>`);
      const base = () => ctx.channels().filter(c => c.c === code && (!cat || c.k.includes(cat))).sort((a, b) => a.n.localeCompare(b.n));
      const render = q => {
        stop(); grid.innerHTML = "";
        const chs = q ? base().filter(c => matches(c, q)) : base();
        if (!chs.length) { grid.append(h(`<div class="empty">No channels match.</div>`)); return; }
        stop = channelGrid(grid, chs, ctx.adult, view);
      };
      content.append(h(`<div class="big-title">${cat ? esc(catName(cat)) : "All Channels"}</div>`), h(`<p class="note">${info.flag} ${esc(info.name)}</p>`), searchField("Search channels", render), h(`<div style="height:12px"></div>`), grid);
      render("");
      return { destroy: () => stop() };
    },
  });
}

// ------------------------------------------------------------------ Live TV root
export function initLive() {
  setRoot("live", {
    build(content, view) {
      let query = "", stop = () => {};
      const head = h(`<div><h1 class="page-title">Live TV</h1></div>`);
      const status = h(`<div></div>`), body = h(`<div></div>`);
      head.append(searchField("Search countries and channels", q => { query = q.toLowerCase(); render(); }));
      content.append(head, status, body);

      const ctx = { adult: false, channels: () => dir.live };
      let token = 0;
      async function render() {
        const my = ++token;
        const [favs, recent] = await Promise.all([favorites(false), recents(false)]);
        if (my !== token) return;                     // a newer render started meanwhile
        stop(); stop = () => {};
        status.innerHTML = ""; body.innerHTML = "";
        if (dir.state === "loading" || dir.state === "idle") {
          status.append(h(`<div class="loading"><span class="spinner"></span><span>Loading worldwide channels… ${Math.round(dir.progress * 100)}%</span></div>`));
        } else if (dir.state === "error") {
          const e = h(`<div class="empty">The channel directory couldn’t load.<br><small>${esc(dir.error)}</small><br><button class="btn blue sm">Try again</button></div>`);
          e.querySelector("button").onclick = () => loadDirectory({ force: true });
          status.append(e);
        }
        if (query && dir.state === "ready") {
          const cs = countriesOf(dir.live).filter(c => c.name.toLowerCase().includes(query));
          const chs = dir.live.filter(c => matches(c, query));
          if (cs.length) { const l = h(`<div class="list glass"></div>`); cs.forEach(c => l.append(countryRow(c, () => openCountry(c.code, ctx)))); body.append(h(`<div class="section-label">Countries</div>`), l); }
          body.append(h(`<div class="section-label">Channels · ${chs.length.toLocaleString()}</div>`));
          if (chs.length) stop = channelGrid(body, chs, false, view); else body.append(h(`<div class="empty">No channels match “${esc(query)}”.</div>`));
          return;
        }
        if (!db.prefs.get("xtv.hidden", false)) {
          const x = h(`<button class="xtv-entry glass"><span class="badge">18+</span><span style="flex:1"><b>X TV</b><small>Separate adult area · 18+ only</small></span><span class="chev">${icon("chevR")}</span></button>`);
          x.onclick = openXTV;
          body.append(x);
        }
        if (favs.length) body.append(rail("Favorite Channels", favs, c => channelCard(c, { mini: true })));
        if (recent.length) body.append(rail("Recently Watched", recent, c => channelCard(c, { mini: true })));
        if (dir.state === "ready") {
          const cs = countriesOf(dir.live);
          const hdr = h(`<div class="section-label">${cs.length} countries · ${dir.live.length.toLocaleString()} channels</div>`);
          const list = h(`<div class="list glass"></div>`);
          body.append(hdr, list);
          stop = incremental(list, cs, c => countryRow(c, () => openCountry(c.code, ctx)), { chunk: 40, root: view });
          body.append(h(`<p class="note">Channels come from the ${esc(SOURCE.name)}, a public list of free-to-air streams. VIDeX hides ${dir.data.dropped.toLocaleString()} streams a browser can’t play (insecure http, or ones that need special headers). Some channels only work in their own country, and any stream can go offline.</p>`));
        }
      }
      on("dir", () => render());
      on("dir-progress", () => { const s = status.querySelector(".loading span:last-child"); if (s) s.textContent = `Loading worldwide channels… ${Math.round(dir.progress * 100)}%`; });
      on("tv-changed", debounce(() => { if (!query) render(); }, 100));
      on("xtv-visibility", () => render());
      render();
      return { shown: () => loadDirectory(), refresh: () => {} };
    },
  });
}

// ------------------------------------------------------------------ X TV
let ageOK = false, unlocked = false;
const hasPin = () => !!db.prefs.get("xtv.pin", "");
async function hashPin(pin) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("videx-xtv:" + pin));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && hasPin()) { unlocked = false; popWhere("live", v => v.dataset.xtv === "1"); }
});

export async function openXTV() {
  if (!ageOK) {
    const ok = await confirmBox({ title: "18+ only", message: "X TV contains adult content. Continue only if you are 18 or older and viewing adult content is legal where you are.", ok: "I’m 18 or older" });
    if (!ok) return;
    ageOK = true;
  }
  if (hasPin() && !unlocked) {
    const pin = await pinPad({ title: "Enter X TV PIN" });
    if (!pin) return;
    if (await hashPin(pin) !== db.prefs.get("xtv.pin")) { toast("Wrong PIN", { err: true }); return; }
    unlocked = true;
  }
  const v = push({
    title: "X TV",
    actions: (() => { const b = h(`<button class="icon-btn" aria-label="X TV settings">${icon("gear")}</button>`); b.onclick = xtvSettings; return b; })(),
    build: buildXTV,
  });
  v.dataset.xtv = "1";
}

function buildXTV(content, view) {
  let query = "", stop = () => {};
  const fileIn = h(`<input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,audio/mpegurl,application/vnd.apple.mpegurl,application/x-mpegurl,text/plain" hidden>`);
  fileIn.onchange = async () => { const f = fileIn.files[0]; fileIn.value = ""; if (f) await importText(await f.text(), f.name.replace(/\.[^.]+$/, ""), "file"); };
  const body = h(`<div></div>`);
  content.append(fileIn, h(`<div class="big-title">X TV</div>`), searchField("Search X TV", q => { query = q.toLowerCase(); render(); }), body);
  const dirCtx = { adult: true, channels: () => dir.adult };

  let token = 0;
  async function render() {
    const my = ++token;
    const lists = (await db.all("xlists")).sort((a, b) => a.added - b.added);
    const [favs, recent] = await Promise.all([favorites(true), recents(true)]);
    if (my !== token) return;
    stop(); stop = () => {}; body.innerHTML = "";
    if (query) {
      const pool = [...dir.adult, ...lists.flatMap(l => l.channels)];
      const hits = pool.filter(c => matches(c, query));
      body.append(h(`<div class="section-label">Results · ${hits.length}</div>`));
      if (hits.length) stop = channelGrid(body, hits, true, view); else body.append(h(`<div class="empty">Nothing in X TV matches “${esc(query)}”.</div>`));
      return;
    }
    if (favs.length) body.append(rail("Favorites", favs, c => channelCard(c, { adult: true, mini: true })));
    if (recent.length) body.append(rail("Recently Watched", recent, c => channelCard(c, { adult: true, mini: true })));

    body.append(h(`<div class="section-label">Directory</div>`));
    if (dir.state !== "ready") {
      body.append(h(`<div class="loading"><span class="spinner"></span><span>Loading directory…</span></div>`));
      loadDirectory();
    } else if (!dir.adult.length) {
      body.append(h(`<div class="empty">The ${esc(SOURCE.name)} doesn’t list any adult channels right now, so there’s nothing to show here yet. You can import your own playlists below.</div>`));
    } else {
      const l = h(`<div class="list glass"></div>`);
      countriesOf(dir.adult).forEach(c => l.append(countryRow(c, () => openCountry(c.code, dirCtx))));
      body.append(l);
    }

    body.append(h(`<div class="section-label">My Playlists</div>`));
    const pl = h(`<div class="list glass"></div>`);
    for (const L of lists) {
      const r = h(`<button class="row tall"><span class="ic">${icon(L.kind === "direct" ? "link" : "playlist")}</span><span class="label">${esc(L.name)}<span class="sub">${L.channels.length} channel${L.channels.length === 1 ? "" : "s"} · ${L.kind === "remote" ? "Remote URL" : L.kind === "direct" ? "Direct URLs" : "Imported file"}</span></span><span class="trail"><span class="chev">${icon("chevR")}</span></span></button>`);
      r.onclick = () => openImported(L.id);
      pl.append(r);
    }
    const addRows = [
      ["file", "Import M3U / M3U8 file", () => fileIn.click()],
      ["link", "Add playlist from URL", addRemote],
      ["plus", "Add direct stream URL", addDirect],
    ];
    for (const [ic, label, fn] of addRows) { const r = h(`<button class="row"><span class="ic">${icon(ic)}</span><span class="label">${label}</span></button>`); r.onclick = fn; pl.append(r); }
    body.append(pl, h(`<p class="note">Imported playlists stay inside X TV on this device. VIDeX doesn’t check what a playlist contains, so only add sources you’re allowed to watch.</p>`));
  }
  const offs = [on("xtv-changed", debounce(() => { if (!query) render(); }, 80)), on("dir", () => render())];
  render();
  return { destroy: () => { stop(); offs.forEach(f => f()); if (hasPin()) unlocked = false; } };
}

function openImported(id) {
  const ctxFor = L => ({ adult: true, channels: () => L.channels });
  const v = push({
    title: "Playlist",
    actions: (() => { const b = h(`<button class="icon-btn" aria-label="Playlist options">${icon("more")}</button>`); b.onclick = async () => {
      const L = await db.get("xlists", id); if (!L) return;
      sheet({ title: L.name, groups: [[
        { icon: "pencil", label: "Rename", run: async () => { const n = await ask({ title: "Rename playlist", value: L.name }); if (n) { await db.put("xlists", { ...L, name: n }); emit("xtv-changed"); back(); } } },
        L.kind === "remote" && { icon: "restart", label: "Refresh from URL", run: () => refreshRemote(L) },
      ], [{ icon: "trash", label: "Delete playlist", danger: true, run: async () => { if (await confirmBox({ title: `Delete “${L.name}”?`, ok: "Delete", danger: true })) { await db.del("xlists", id); emit("xtv-changed"); back(); } } }]] });
    }; return b; })(),
    async build(content) {
      const L = await db.get("xlists", id);
      if (!L) { content.append(h(`<div class="empty">This playlist was removed.</div>`)); return; }
      const ctx = ctxFor(L), cs = countriesOf(L.channels);
      content.append(h(`<div class="big-title">${esc(L.name)}</div>`), h(`<p class="note">${L.channels.length} channels${L.source ? " · " + esc(L.source) : ""}</p>`));
      const l = h(`<div class="list glass"></div>`);
      cs.forEach(c => l.append(countryRow(c, () => openCountry(c.code, ctx))));
      content.append(h(`<div class="section-label">Countries</div>`), l);
    },
  });
  v.dataset.xtv = "1";
}

// ---- imports
/** Parse M3U/M3U8 channel lists. Returns {channels, isStream}. */
export function parseM3U(text, prefix) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.some(l => /^#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/.test(l))) return { isStream: true, channels: [] };
  const out = []; let cur = {};
  const https = location.protocol === "https:";
  for (const l of lines) {
    if (l.startsWith("#EXTINF")) {
      const attrs = Object.fromEntries([...l.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1].toLowerCase(), m[2]]));
      const name = l.replace(/([\w-]+)="[^"]*"/g, "").replace(/^#EXTINF:[^,]*,/, "").trim();
      cur = { name: name || attrs["tvg-name"], logo: attrs["tvg-logo"], group: attrs["group-title"], country: attrs["tvg-country"], lang: attrs["tvg-language"] };
    } else if (l.startsWith("#EXTGRP:")) cur.group ||= l.slice(8).trim();
    else if (/^#EXTVLCOPT:http-(referrer|user-agent)/i.test(l)) cur.hdr = true;
    else if (!l.startsWith("#") && /^(https?:)?\/\//i.test(l)) {
      const cc = (cur.country || "").split(/[;,]/)[0].trim().toUpperCase();
      const warn = cur.hdr ? "Needs headers a browser can’t send" : https && l.startsWith("http:") ? "Insecure http — may be blocked" : "";
      out.push({
        id: `${prefix}:${out.length}`, n: cur.name || new URL(l, location.href).hostname, c: /^[A-Z]{2}$/.test(cc) ? cc : "",
        k: [cur.group?.split(";")[0].trim() || "Uncategorized"], l: cur.lang ? cur.lang.split(/[;,]/).map(s => s.trim()).slice(0, 2) : [],
        g: cur.logo || "", u: [l], lb: [], warn, x: true,
      });
      cur = {};
    }
  }
  return { isStream: false, channels: out };
}

async function importText(text, name, kind, source = "") {
  const id = `xl:${Date.now().toString(36)}`;
  const { isStream, channels } = parseM3U(text, id);
  if (isStream) {
    if (source) return saveDirect(name, source);
    toast("That file is a single video stream, not a channel list. Use “Add direct stream URL” for its address.", { err: true, ms: 4000 });
    return;
  }
  if (!channels.length) { toast("No channels found in that playlist.", { err: true }); return; }
  await db.put("xlists", { id, name, kind, source, channels, added: Date.now() });
  toast(`Imported ${channels.length} channel${channels.length === 1 ? "" : "s"}`);
  emit("xtv-changed");
}

async function fetchText(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`The server answered HTTP ${r.status}.`);
    return await r.text();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The server took too long to answer.");
    if (e instanceof TypeError) throw new Error("That server doesn’t let browsers read the playlist (CORS), or it’s unreachable. Download the file and import it instead.");
    throw e;
  } finally { clearTimeout(t); }
}

async function addRemote() {
  const url = await ask({ title: "Playlist URL", message: "Link to an M3U or M3U8 channel list.", placeholder: "https://…/playlist.m3u", type: "url", ok: "Import" });
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { toast("Enter a full http(s):// address.", { err: true }); return; }
  toast("Downloading playlist…", { ms: 1500 });
  try { await importText(await fetchText(url), new URL(url).hostname, "remote", url); }
  catch (e) { toast(e.message, { err: true, ms: 5000 }); }
}
async function refreshRemote(L) {
  try {
    const { channels } = parseM3U(await fetchText(L.source), L.id);
    if (!channels.length) throw new Error("The playlist is empty now.");
    await db.put("xlists", { ...L, channels });
    toast(`Updated · ${channels.length} channels`); emit("xtv-changed");
  } catch (e) { toast(e.message, { err: true, ms: 5000 }); }
}
async function addDirect() {
  const url = await ask({ title: "Direct stream URL", message: "An .m3u8 (HLS) or MP4/WebM address.", placeholder: "https://…/stream.m3u8", type: "url", ok: "Next" });
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { toast("Enter a full http(s):// address.", { err: true }); return; }
  const name = await ask({ title: "Name this stream", value: new URL(url).hostname, ok: "Add" });
  if (name) saveDirect(name, url);
}
async function saveDirect(name, url) {
  const L = (await db.get("xlists", "xl:direct")) || { id: "xl:direct", name: "Direct URLs", kind: "direct", source: "", channels: [], added: Date.now() };
  const https = location.protocol === "https:";
  L.channels.push({ id: `xl:direct:${Date.now().toString(36)}`, n: name, c: "", k: ["Direct"], l: [], g: "", u: [url], lb: [], warn: https && url.startsWith("http:") ? "Insecure http — may be blocked" : "", x: true });
  await db.put("xlists", L);
  toast("Stream added"); emit("xtv-changed");
}

// ---- X TV privacy settings
function xtvSettings() {
  const pin = hasPin();
  sheet({
    title: "X TV Privacy", groups: [
      [
        { icon: "lock", label: pin ? "Change PIN" : "Set a PIN", sub: pin ? "" : "Ask for a PIN each time X TV opens", run: setPin },
        pin && { icon: "lock", label: "Remove PIN", run: async () => { if (await confirmBox({ title: "Remove the X TV PIN?", ok: "Remove", danger: true })) { db.prefs.set("xtv.pin", ""); toast("PIN removed"); } } },
        pin && { icon: "lock", label: "Lock X TV now", run: () => { unlocked = false; popWhere("live", v => v.dataset.xtv === "1"); } },
      ],
      [
        { icon: "eyeOff", label: "Hide X TV", sub: "Removes the entry from Live TV. Turn it back on in Home › Settings.", run: async () => { db.prefs.set("xtv.hidden", true); popWhere("live", v => v.dataset.xtv === "1"); emit("xtv-visibility"); toast("X TV hidden"); } },
        { icon: "clock", label: "Clear X TV history", run: async () => { await clearHistory(true); toast("X TV history cleared"); } },
        { icon: "heart", label: "Clear X TV favorites", run: async () => { await db.clear("xfav"); favIds.true.clear(); emit("xtv-changed"); toast("X TV favorites cleared"); } },
      ],
    ],
  });
}
async function setPin() {
  const a = await pinPad({ title: "New X TV PIN", message: "4 digits" }); if (!a) return;
  const b = await pinPad({ title: "Confirm PIN" }); if (!b) return;
  if (a !== b) { toast("PINs didn’t match", { err: true }); return; }
  db.prefs.set("xtv.pin", await hashPin(a)); unlocked = true;
  toast("PIN set");
}

export function setXTVHidden(hidden) { db.prefs.set("xtv.hidden", hidden); emit("xtv-visibility"); }

// ------------------------------------------------------------------ search (ordinary Live TV only)
export function searchLive(q) {
  q = q.toLowerCase();
  if (dir.state !== "ready" || !q) return { countries: [], channels: [] };
  return { countries: countriesOf(dir.live).filter(c => c.name.toLowerCase().includes(q)), channels: dir.live.filter(c => matches(c, q)) };
}
export { openCountry };
export const liveCtx = { adult: false, channels: () => dir.live };

export async function initTV() { await loadFavIds(); }
