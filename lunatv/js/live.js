// Live TV screens: Now Playing rails, channel browser, channel editing,
// program details, the full guide, and source management.
import { tr, trn, locale } from "./i18n.js";
import { h, esc, icon, on, emit, fuzzy, safeURL, debounce, isInsecure } from "./util.js";
import * as db from "./database.js";
import * as L from "./channels.js";
import * as C from "./collections.js";
import { lookupMovie, credits, active as metaProvider } from "./metadata.js";
import { setRoot, push, back, sheet, toast, ask, confirmBox, form, searchField, incremental, segmented } from "./ui.js";
import { playStream } from "./player.js";

let regionNames = null;
try { regionNames = new Intl.DisplayNames([locale()], { type: "region" }); } catch {}
const countryLabel = c => { try { return (c.country && /^[A-Z]{2}$/.test(c.country) && regionNames?.of(c.country)) || c.countryName || c.country || ""; } catch { return c.countryName || c.country || ""; } };
const tfmt = ts => new Date(ts).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
const mins = ms => { const m = Math.round(ms / 60000); return m >= 60 ? tr("{h} HR {m} MIN", { h: Math.floor(m / 60), m: m % 60 }) : tr("{m} MIN", { m }); };
const fallback = title => `<div class="ph lunafall"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""><span>${esc(title || "")}</span></div>`;
const logoImg = (src, cls = "") => { const u = safeURL(src); return u ? `<img class="${cls}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(u)}">` : ""; };

// ------------------------------------------------------------------ playing
export function playChannel(c, list) {
  const surf = db.setting("live.surfFavorites") ? L.channels().filter(x => C.isFavorite("channel", x.id)) : null;
  const pool = surf && surf.some(x => x.id === c.id) ? surf : list || L.channels();
  playStream({ id: c.id, name: c.name, urls: c.urls?.length ? c.urls : [c.url], logo: c.logo, url: c.url }, {
    channels: pool.map(x => ({ id: x.id, name: x.name, urls: x.urls?.length ? x.urls : [x.url], logo: x.logo, url: x.url })),
    nowNext: ch => { const nn = L.nowNext(L.channelById(ch.id)); return nn; },
    onStarted: () => L.recordChannel(c),
    onChannel: (ch, started) => { if (started) { const full = L.channelById(ch.id); if (full) L.recordChannel(full); } },
  });
}

// ------------------------------------------------------------------ artwork (priority: custom → EPG → playlist → metadata → LunaTV)
const artIO = new IntersectionObserver(es => es.forEach(async e => {
  if (!e.isIntersecting) return;
  artIO.unobserve(e.target);
  const { title, year } = e.target.dataset;
  const m = await lookupMovie(title, year);
  const url = m?.backdrop || m?.poster;
  const ph = e.target.querySelector(".lunafall, .logo-fill");
  if (url && ph) ph.replaceWith(Object.assign(new Image(), { src: url, alt: "", referrerPolicy: "no-referrer" }));
}), { rootMargin: "200px" });
function programArt(c, p) {
  const custom = db.setting(`art.${L.progKey(c, p)}`);
  const src = safeURL(custom || p.img);
  if (src) return `<img class="pa" alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(src)}">`;
  return c.logo ? `<div class="logo-fill">${logoImg(c.logo)}</div>` : fallback(p.t);
}

// ------------------------------------------------------------------ cards & rows
export function programCard({ channel: c, program: p }, { upcoming = false } = {}) {
  const pr = upcoming ? null : L.progressOf(p);
  const el = h(`<div class="pcard" data-s="${p.s}" data-e="${p.e}">
    <div class="pc-art" data-title="${esc(p.t)}" data-year="${esc(p.y || "")}">${programArt(c, p)}${upcoming ? `<span class="pc-when">${esc(L.whenLabel(p))}</span>` : `<span class="pc-live">${tr("LIVE")}</span>`}</div>
    <button class="open" aria-label="${esc(p.t)} on ${esc(c.name)}"></button>
    <div class="pc-meta"><span class="t">${esc(p.t)}</span><span class="s">${logoImg(c.logo, "mini-logo")}${esc(c.name)}</span>
    <span class="s times">${tfmt(p.s)} — ${tfmt(p.e)}</span>
    ${pr ? `<div class="pbar"><i style="width:${pr.progress * 100}%"></i></div><span class="s rem">${tr("{t} REMAINING", { t: mins(pr.remaining) })}</span>` : ""}</div></div>`);
  el.querySelector(".open").onclick = () => openProgram(c, p);
  const art = el.querySelector(".pc-art"), pa = art.querySelector("img.pa");
  if (pa) pa.onerror = () => pa.replaceWith(h(fallback(p.t)));
  if (!safeURL(p.img) && metaProvider() && L.isMovie(p, c)) artIO.observe(art);
  el.querySelectorAll("img").forEach(i => { if (!i.onerror) i.onerror = () => i.remove(); });
  return el;
}
export function channelRow(c, list, { adult = false } = {}) {
  const nn = L.nowNext(c), fav = C.isFavorite("channel", c.id, adult);
  const el = h(`<div class="row tall ch-row"${nn.now ? ` data-s="${nn.now.s}" data-e="${nn.now.e}"` : ""}>
    <button class="ch-logo" aria-label="${tr("Play")} ${esc(c.name)}">${logoImg(c.logo) || `<span>${esc(initials(c.name))}</span>`}</button>
    <button class="label" style="text-align:left">${esc(c.name)}${fav ? ` <span class="favdot" aria-label="${tr("Favorite")}">${icon("heartFill")}</span>` : ""}<span class="sub">${nn.now ? `${esc(nn.now.title)} · ${tfmt(nn.now.s)}–${tfmt(nn.now.e)}` : esc([countryLabel(c), tr(c.category)].filter(Boolean).join(" · "))}${c.insecure ? " · " + tr("insecure http") : ""}</span>${nn.now ? `<span class="pbar sm"><i style="width:${nn.now.progress * 100}%"></i></span>` : ""}</button>
    <button class="icon-btn plain" aria-label="${tr("Options for")} ${esc(c.name)}">${icon("more")}</button></div>`);
  const play = () => playChannel(c, list);
  el.querySelector(".ch-logo").onclick = play; el.querySelector(".label").onclick = play;
  el.querySelector(".icon-btn").onclick = () => channelMenu(c, list, { adult });
  el.querySelectorAll("img").forEach(i => { i.onerror = () => i.replaceWith(h(`<span>${esc(initials(c.name))}</span>`)); });
  return el;
}
const initials = n => (n.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("") || "TV").toUpperCase();
export function channelTile(c, list) {
  const el = h(`<button class="ch-tile glass"><span class="ch-logo">${logoImg(c.logo) || `<span>${esc(initials(c.name))}</span>`}</span><b>${esc(c.name)}</b></button>`);
  el.onclick = () => playChannel(c, list);
  el.querySelectorAll("img").forEach(i => { i.onerror = () => i.replaceWith(h(`<span>${esc(initials(c.name))}</span>`)); });
  return el;
}

// keep progress bars and "remaining" live without reloading anything
setInterval(() => {
  const now = Date.now();
  for (const el of document.querySelectorAll("[data-s][data-e]")) {
    const s = +el.dataset.s, e = +el.dataset.e, pct = Math.min(100, Math.max(0, (now - s) / (e - s) * 100));
    el.querySelectorAll(".pbar i").forEach(i => { i.style.width = pct + "%"; });
    const rem = el.querySelector(".rem"); if (rem) rem.textContent = now >= e ? tr("ENDED") : tr("{t} REMAINING", { t: mins(e - now) });
  }
}, 30000);

function rail(title, items, render, onMore) {
  if (!items.length) return null;
  const s = h(`<section class="shelf"><${onMore ? "button" : "h2"} class="shelf-h">${esc(title)}${onMore ? icon("chevR") : ""}</${onMore ? "button" : "h2"}><div class="rail"></div></section>`);
  if (onMore) s.firstElementChild.onclick = onMore;
  items.forEach(i => s.lastElementChild.append(render(i)));
  return s;
}

// ------------------------------------------------------------------ channel menu (edits)
function channelMenu(c, list, { adult = false } = {}) {
  const fav = C.isFavorite("channel", c.id, adult), edited = !!c.orig;
  sheet({ title: c.name, subtitle: [countryLabel(c), tr(c.category)].filter(Boolean).join(" · "), groups: [
    [{ icon: "play", label: tr("Watch"), run: () => playChannel(c, list) },
      { icon: fav ? "heartFill" : "heart", label: fav ? tr("Remove from Favorites") : tr("Add to Favorites"), run: async () => { const on2 = await C.toggleFavorite({ type: "channel", ref: c.id, title: c.name, adult, snapshot: { id: c.id, name: c.name, logo: c.logo } }); toast(on2 ? tr("Added to Favorites") : tr("Removed from Favorites")); emit("live-changed"); } }],
    [{ icon: "pencil", label: tr("Rename"), run: async () => { const n = await ask({ title: tr("Rename channel"), value: c.name }); if (n) await L.editChannel(c.id, { name: n }); } },
      { icon: "grid", label: tr("Move to Category"), sub: tr(c.category), run: () => sheet({ title: tr("Category"), groups: [L.CHANNEL_CATEGORIES.map(k => ({ label: tr(k), check: c.category === k, run: () => L.editChannel(c.id, { category: k }) }))] }) },
      { icon: "up", label: tr("Move Up"), run: () => L.moveChannel(c.id, -1, list) },
      { icon: "down", label: tr("Move Down"), run: () => L.moveChannel(c.id, 1, list) },
      { icon: "camera", label: tr("Custom Artwork"), sub: tr("Image URL"), run: async () => { const u = await ask({ title: tr("Artwork image URL"), value: c.logo, type: "url", placeholder: "https://…/logo.png" }); if (u == null) return; if (u && !safeURL(u)) { toast(tr("Enter a full https:// image address."), { err: true }); return; } await L.editChannel(c.id, { logo: u }); } },
      { icon: "eyeOff", label: tr("Hide Channel"), run: async () => { await L.editChannel(c.id, { hidden: true }); toast(tr("Hidden. Restore it from Live › Sources › Hidden Channels.")); } },
      edited && { icon: "restart", label: tr("Restore Original"), run: () => L.restoreChannel(c.id) }],
    [{ icon: "share", label: tr("Copy Stream Link"), run: async () => { try { await navigator.clipboard.writeText(c.url); toast(tr("Link copied")); } catch { toast(tr("Couldn’t copy"), { err: true }); } } }],
  ] });
}

// ------------------------------------------------------------------ Live root
export function initLive() {
  setRoot("live", {
    build(content, view) {
      let cat = "All", country = "", q = "", stop = () => {};
      const head = h(`<div><h1 class="page-title">${tr("Live")}</h1><div class="btn-row"><button class="btn">${icon("guide")}${tr("Guide")}</button><button class="btn">${icon("live")}${tr("Sources")}</button><button class="btn blue">${icon("plus")}${tr("Add Source")}</button></div></div>`);
      const [gB, sB, aB] = head.querySelectorAll(".btn");
      gB.onclick = openGuide; sB.onclick = openSources; aB.onclick = addSourceSheet;
      const body = h(`<div></div>`);
      content.append(head, body);
      let listRenderer = () => {};
      const renderList = debounce(() => listRenderer(), 120);
      function render() {
        stop(); stop = () => {};
        const all = L.channels();
        gB.hidden = !L.hasGuide();
        if (!L.live.loaded) { body.replaceChildren(h(`<div class="loading"><span class="spinner"></span><span>${tr("Loading channels…")}</span></div>`)); return; }
        if (!all.length) {
          const e = h(`<div class="empty big-empty"><img src="assets/branding/lunatv-crescent.webp" alt="" class="empty-mark"><b>${tr("No live sources")}</b><span>${tr("Add a playlist or direct stream, or start with free worldwide channels.")}</span><div class="btn-row" style="justify-content:center"><button class="btn blue">${icon("plus")}${tr("Add Source")}</button><button class="btn">${icon("globe")}${tr("Worldwide Free Channels")}</button></div></div>`);
          const [a, b] = e.querySelectorAll("button"); a.onclick = addSourceSheet; b.onclick = addDirectoryFlow;
          body.replaceChildren(e); return;
        }
        const parts = [];
        const nowList = L.liveNow().sort((a, b) => (C.isFavorite("channel", b.channel.id) - C.isFavorite("channel", a.channel.id)) || a.program.remaining - b.program.remaining);
        parts.push(rail(tr("Live Now"), nowList.slice(0, 24), x => programCard(x), L.hasGuide() ? openGuide : null));
        parts.push(rail(tr("Movies On Now"), L.moviesOnNow().slice(0, 24), x => programCard(x)));
        parts.push(rail(tr("Coming Up"), L.comingUp(), x => programCard(x, { upcoming: true })));
        const favs = all.filter(c => C.isFavorite("channel", c.id));
        parts.push(rail(tr("Favorite Channels"), favs, c => channelTile(c, favs)));
        const listBox = h(`<div></div>`);
        const cats = ["All", "Favorites", ...L.CHANNEL_CATEGORIES.filter(k => all.some(c => c.category === k))];
        const chips = h(`<div class="chips">${cats.map(k => `<button class="chip${k === cat ? " on" : ""}" data-k="${esc(k)}">${esc(tr(k))}</button>`).join("")}</div>`);
        chips.onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; cat = b.dataset.k; chips.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b)); renderList(); };
        const countries = [...new Map(all.filter(c => c.country).map(c => [c.country, `${c.flag || ""} ${countryLabel(c)}`.trim()])).entries()].sort((a, b) => a[1].replace(/^\S+\s/, "").localeCompare(b[1].replace(/^\S+\s/, ""), locale()));
        const tools = h(`<div class="lib-tools"></div>`);
        tools.append(searchField(tr("Search channels"), v => { q = v; renderList(); }));
        if (countries.length > 1) {
          const sel = h(`<select class="input select" aria-label="${tr("Country")}"><option value="">${tr("All countries")}</option>${countries.map(([k, n]) => `<option value="${esc(k)}"${k === country ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`);
          sel.onchange = () => { country = sel.value; renderList(); };
          tools.append(sel);
        }
        parts.push(h(`<div class="section-label">${tr("Channels")}</div>`), tools, chips, listBox);
        body.replaceChildren(...parts.filter(Boolean));
        listRenderer = renderChannels;
        renderChannels();
        function renderChannels() {
          stop(); listBox.replaceChildren();
          const match = fuzzy(q);
          const list = L.channels().filter(c => (cat === "All" || (cat === "Favorites" ? C.isFavorite("channel", c.id) : c.category === cat)) && (!country || c.country === country) && (!q || match(c.name, c.group, c.countryName, countryLabel(c), tr(c.category), L.nowNext(c).now?.title)));
          if (!list.length) { listBox.append(h(`<div class="empty">${tr("No channels match.")}</div>`)); return; }
          listBox.append(h(`<p class="note">${trn("{n} channel", "{n} channels", list.length)}</p>`));
          const l = h(`<div class="list glass"></div>`); listBox.append(l);
          stop = incremental(l, list, c => channelRow(c, list), { chunk: 50, root: view });
        }
      }
      on("live-changed", render); on("favorites-changed", render);
      on("live-progress", p => { const s = body.querySelector(".loading span:last-child"); if (s) s.textContent = `${tr("Loading worldwide channels…")} ${Math.round(p * 100)}%`; });
      render();
      return { refresh: () => {} };
    },
  });
}

// ------------------------------------------------------------------ program details
export function openProgram(c, p) {
  push({
    bare: true, async build(content) {
      const render = async () => {
        const now = Date.now(), airing = p.s <= now && p.e > now, pr = L.progressOf(p);
        const meta = L.isMovie(p, c) || p.y ? await lookupMovie(p.t, p.y) : null;
        const cr = meta?.id && (!p.cast?.length && !p.dir?.length) ? await credits(meta.id) : null;
        const backdrop = safeURL(db.setting(`art.${L.progKey(c, p)}`) || p.img || meta?.backdrop || meta?.poster);
        const fav = C.isFavorite("program", L.progKey(c, p)), rem = !airing && await L.hasReminder(c, p);
        const genres = p.cat?.length ? p.cat : [];
        const cast = p.cast?.length ? p.cast : cr?.cast || [], dir = p.dir?.length ? p.dir : cr?.director || [];
        const el = h(`<div>
          <div class="detail-hero">${backdrop ? `<img alt="" referrerpolicy="no-referrer" src="${esc(backdrop)}">` : c.logo ? `<div class="logo-fill big">${logoImg(c.logo)}</div>` : fallback(p.t)}
            <div class="detail-top"><button class="round" data-a="back" aria-label="${tr("Back")}">${icon("chevL")}</button></div></div>
          <div class="detail-body">
            ${airing ? `<span class="live-pill">${tr("LIVE")}</span>` : `<span class="soon-pill">${esc(L.whenLabel(p))}</span>`}
            <h2>${esc(p.t)}</h2>
            ${p.st ? `<p class="desc">${esc(p.st)}</p>` : ""}
            <div class="meta">${[p.y || meta?.year, genres.slice(0, 2).join(" / ").toUpperCase(), p.r, p.season ? `S${p.season} E${p.episode}` : "", mins(p.e - p.s).toLowerCase()].filter(Boolean).map(esc).join(" · ")}</div>
            <p class="note">${logoImg(c.logo, "mini-logo")} ${esc(c.name)} · ${tfmt(p.s)} — ${tfmt(p.e)}</p>
            ${airing ? `<div class="pbar big" data-s="${p.s}" data-e="${p.e}"><i style="width:${pr.progress * 100}%"></i></div><p class="note rem-line">${tr("{t} remaining", { t: mins(pr.remaining) })}</p>` : ""}
            <div class="btn-row">
              ${airing ? `<button class="btn primary" data-a="watch">${icon("play")}${tr("Watch Live")}</button>` : `<button class="btn${rem ? " on" : " primary"}" data-a="remind">${icon("bell")}${rem ? tr("Reminder Set") : tr("Remind Me")}</button>`}
              <button class="round${fav ? " on" : ""}" data-a="fav" aria-label="${fav ? tr("Remove from favorites") : tr("Add to favorites")}">${icon(fav ? "heartFill" : "heart")}</button>
            </div>
            ${p.d || meta?.overview ? `<p class="desc">${esc(p.d || meta.overview)}</p>` : ""}
            ${dir.length ? `<p class="note"><b>${tr("Director")}</b> ${esc(dir.join(", "))}</p>` : ""}
            ${cast.length ? `<p class="note"><b>${tr("Cast")}</b> ${esc(cast.join(", "))}</p>` : ""}
            ${meta && !p.img ? `<p class="note small">${tr("Artwork and details from")} ${esc(metaProvider()?.name || "")}.</p>` : ""}
          </div></div>`);
        el.querySelectorAll("img").forEach(i => { i.onerror = () => i.remove(); });
        const acts = {
          back: () => back(),
          watch: () => playChannel(c),
          remind: async () => { const on2 = await L.toggleReminder(c, p); toast(on2 === "push" ? tr("We’ll notify you when it starts, even if LunaTV is closed") : on2 ? tr("We’ll remind you when it starts while LunaTV is open") : tr("Reminder removed")); render(); },
          fav: async () => { const on2 = await C.toggleFavorite({ type: "program", ref: L.progKey(c, p), title: p.t, snapshot: { channelId: c.id, channel: c.name, title: p.t, s: p.s, e: p.e, img: p.img } }); toast(on2 ? tr("Added to Favorites") : tr("Removed from Favorites")); render(); },
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
      };
      await render();
      return { refresh: render };
    },
  });
}

// ------------------------------------------------------------------ full guide
const PX_PER_MIN = 4;
export function openGuide() {
  push({
    title: tr("Guide"), build(content, view) {
      const start = Math.floor((Date.now() - 30 * 60000) / (30 * 60000)) * 30 * 60000, hours = 24, end = start + hours * 3600e3;
      const chs = L.channels().filter(c => L.programmesFor(c).length).sort((a, b) => C.isFavorite("channel", b.id) - C.isFavorite("channel", a.id));
      if (!chs.length) { content.append(h(`<div class="empty">${tr("No guide data matches your channels yet. Add an XMLTV guide from Live › Add Source.")}</div>`)); return; }
      const W = hours * 60 * PX_PER_MIN;
      const grid = h(`<div class="epg" role="grid" aria-label="${tr("Programme guide")}"><div class="epg-scroll"><div class="epg-inner" style="width:${W + 132}px"><div class="epg-times"><div class="epg-corner"></div></div><div class="epg-rows"></div><div class="epg-now" aria-hidden="true"></div></div></div></div>`);
      const times = grid.querySelector(".epg-times"), rows = grid.querySelector(".epg-rows"), nowLine = grid.querySelector(".epg-now");
      for (let t = start; t < end; t += 30 * 60000) times.append(h(`<span style="width:${30 * PX_PER_MIN}px">${tfmt(t)}</span>`));
      const drawRow = c => {
        const r = h(`<div class="epg-row" role="row"><button class="epg-ch" aria-label="${tr("Play")} ${esc(c.name)}">${logoImg(c.logo) || ""}<span>${esc(c.name)}</span></button><div class="epg-progs" style="width:${W}px"></div></div>`);
        r.querySelector(".epg-ch").onclick = () => playChannel(c, chs);
        const box = r.querySelector(".epg-progs");
        for (const p of L.programmesFor(c)) {
          if (p.e <= start || p.s >= end) continue;
          const l = Math.max(0, (p.s - start) / 60000 * PX_PER_MIN), w = Math.max(24, (Math.min(p.e, end) - Math.max(p.s, start)) / 60000 * PX_PER_MIN - 3);
          const airing = p.s <= Date.now() && p.e > Date.now();
          const b = h(`<button class="epg-prog${airing ? " now" : ""}" style="left:${l}px;width:${w}px" role="gridcell"><b>${esc(p.t)}</b><small>${tfmt(p.s)}</small></button>`);
          b.onclick = () => openProgram(c, p);        // details first — never an instant channel change
          box.append(b);
        }
        r.querySelectorAll("img").forEach(i => { i.onerror = () => i.remove(); });
        return r;
      };
      content.append(h(`<p class="note">${trn("{n} channel with guide data · tap a programme for details", "{n} channels with guide data · tap a programme for details", chs.length)}</p>`), grid);
      const stop = incremental(rows, chs, drawRow, { chunk: 30, root: view });
      const scroller = grid.querySelector(".epg-scroll");
      const placeNow = () => { nowLine.style.left = `${132 + (Date.now() - start) / 60000 * PX_PER_MIN}px`; };
      placeNow();
      requestAnimationFrame(() => { scroller.scrollLeft = Math.max(0, (Date.now() - start) / 60000 * PX_PER_MIN - 60); });
      const t = setInterval(placeNow, 30000);
      return { destroy: () => { clearInterval(t); stop(); } };
    },
  });
}

// ------------------------------------------------------------------ sources
let m3uIn, xmlIn;
function inputs() {
  if (m3uIn) return;
  m3uIn = document.body.appendChild(h(`<input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,audio/mpegurl,application/vnd.apple.mpegurl,application/x-mpegurl,text/plain" hidden>`));
  xmlIn = document.body.appendChild(h(`<input type="file" accept=".xml,.xmltv,.gz,text/xml,application/xml,application/gzip" hidden>`));
  m3uIn.onchange = async () => { const f = m3uIn.files[0]; m3uIn.value = ""; if (f) importM3UText(await f.text(), f.name.replace(/\.[^.]+$/, ""), m3uIn._adult); };
  xmlIn.onchange = async () => {
    const f = xmlIn.files[0]; xmlIn.value = ""; if (!f) return;
    toast(tr("Reading guide…"), { ms: 60000 });
    try { const r = await L.addXMLTV({ buffer: await f.arrayBuffer(), name: f.name.replace(/\.(xml|gz)+$/i, "") }); toast(tr("Guide added · {p0} programmes · matched {p1}", { p0: r.programmes.toLocaleString(locale()), p1: trn("{n} channel", "{n} channels", r.matched) }), { ms: 4500 }); }
    catch (e) { toast(e.message, { err: true, ms: 5000 }); }
  };
}
async function importM3UText(text, name, adult = false) {
  try {
    const r = await L.addM3U(text, { name, adult });
    if (r.isStream) { toast(tr("That file is a single stream, not a channel list. Use Add Direct Stream."), { err: true, ms: 4500 }); return; }
    reportImport(r);
  } catch (e) { toast(e.message, { err: true, ms: 4500 }); }
}
function reportImport(r) {
  const bits = [tr("Added {p0}", { p0: trn("{n} channel", "{n} channels", r.count) })];
  if (r.adultCount && !db.setting("content.adult")) bits.push(tr("{n} adult kept out of Live TV", { n: r.adultCount }));
  if (r.insecure) bits.push(tr("{n} use insecure http and may be blocked", { n: r.insecure }));
  toast(bits.join(" · "), { ms: 5000 });
  if (r.epgUrl) setTimeout(async () => { if (await confirmBox({ title: tr("Add this playlist’s guide?"), message: tr("The playlist points to a programme guide at {p0}.", { p0: r.epgUrl }), ok: tr("Add Guide") })) addXmltvUrl(r.epgUrl); }, 600);
}
async function addXmltvUrl(url) {
  toast(tr("Downloading guide…"), { ms: 60000 });
  try { const r = await L.addXMLTV({ url }); toast(tr("Guide added · matched {p0}", { p0: trn("{n} channel", "{n} channels", r.matched) }), { ms: 4500 }); }
  catch (e) { toast(e.message, { err: true, ms: 6000 }); }
}
async function addDirectoryFlow() {
  if (L.live.sources.some(s => s.type === "directory")) { toast(tr("The worldwide directory is already added.")); return; }
  toast(tr("Loading worldwide channels…"), { ms: 90000 });
  try { const r = await L.addDirectory(); toast(tr("Added {p0} free channels", { p0: r.count.toLocaleString(locale()) }), { ms: 4000 }); }
  catch (e) { toast(e.message, { err: true, ms: 5000 }); }
}
export function addSourceSheet({ adult = false } = {}) {
  inputs();
  const warnHttp = u => { if (isInsecure(u)) toast(tr("This source uses insecure http and may be blocked by your browser."), { err: true, ms: 4500 }); };
  sheet({ title: adult ? tr("Add Adult Source") : tr("Add Source"), subtitle: adult ? tr("Stays inside Discover › Adult") : "", groups: [
    [
      { icon: "file", label: tr("Import M3U File"), run: () => { m3uIn._adult = adult; m3uIn.click(); } },
      { icon: "link", label: tr("Add M3U URL"), run: async () => {
        const u = await ask({ title: tr("Playlist URL"), message: tr("An M3U or M3U8 channel list."), placeholder: "https://…/playlist.m3u", type: "url", ok: tr("Add") });
        if (!u) return; if (!safeURL(u)) { toast(tr("Enter a full http(s):// address."), { err: true }); return; } warnHttp(u);
        toast(tr("Downloading playlist…"), { ms: 30000 });
        try { const r = await L.addM3UUrl(u, { adult }); r.direct ? toast(tr("That link is a single stream. Added as a direct stream.")) : reportImport(r); } catch (e) { toast(e.message, { err: true, ms: 6000 }); }
      } },
      { icon: "plus", label: tr("Add Direct Stream"), sub: tr("HLS (.m3u8), MP4 or WebM URL"), run: async () => {
        const r = await form({ title: tr("Direct Stream"), fields: [{ name: "url", label: tr("Stream URL"), type: "url", placeholder: "https://…/stream.m3u8" }, { name: "name", label: tr("Name"), placeholder: tr("My Channel") }], ok: tr("Add") });
        if (!r?.url) return; if (!safeURL(r.url)) { toast(tr("Enter a full http(s):// address."), { err: true }); return; } warnHttp(r.url);
        await L.addDirect(r.name || new URL(r.url).hostname, r.url, { adult }); toast(tr("Stream added"));
      } },
    ],
    !adult && [
      { icon: "guide", label: tr("Import XMLTV File"), sub: ".xml or .xml.gz", run: () => xmlIn.click() },
      { icon: "link", label: tr("Add XMLTV URL"), run: async () => { const u = await ask({ title: tr("Guide URL"), placeholder: "https://…/guide.xml", type: "url", ok: tr("Add") }); if (u && safeURL(u)) { warnHttp(u); addXmltvUrl(u); } else if (u) toast(tr("Enter a full http(s):// address."), { err: true }); } },
    ],
    !adult && [
      { icon: "globe", label: tr("Worldwide Free Channels"), sub: tr("Public IPTV-org directory"), run: addDirectoryFlow },
      { icon: "restart", label: tr("Import LunaTV Backup"), run: () => emit("import-backup") },
    ],
  ] });
}
on("add-source", () => addSourceSheet());
on("open-direct-url", async () => {
  const r = await form({ title: tr("Play a Stream or Video URL"), fields: [{ name: "url", label: "URL", type: "url", placeholder: "https://…/video.mp4 or .m3u8" }], ok: tr("Play") });
  if (!r?.url) return;
  if (!safeURL(r.url)) { toast(tr("Enter a full http(s):// address."), { err: true }); return; }
  if (isInsecure(r.url)) toast(tr("This source uses insecure http and may be blocked by your browser."), { err: true, ms: 4500 });
  playStream({ id: "adhoc", name: new URL(r.url).hostname, urls: [r.url] });
});

export function openSources() {
  push({
    title: tr("Sources"), build(content) {
      const render = () => {
        const srcs = L.live.sources.filter(s => !s.adult);
        const box = h(`<div><div class="btn-row"><button class="btn blue">${icon("plus")}${tr("Add Source")}</button></div></div>`);
        box.querySelector("button").onclick = () => addSourceSheet();
        if (!srcs.length) box.append(h(`<div class="empty" style="margin-top:14px">${tr("No sources yet.")}</div>`));
        else {
          const l = h(`<div class="list glass" style="margin-top:14px"></div>`);
          for (const s of srcs) {
            const kind = tr({ m3u: "M3U file", "m3u-url": "M3U URL", direct: "Direct streams", directory: "Public directory", xmltv: "XMLTV file", "xmltv-url": "XMLTV URL" }[s.type] || s.type);
            const r = h(`<button class="row tall"><span class="ic">${icon(s.guide ? "guide" : "live")}</span><span class="label">${esc(s.name)}<span class="sub">${esc(kind)} · ${(s.count || 0).toLocaleString(locale())} ${s.guide ? "programmes" : "channels"}${s.updated ? ` · updated ${new Date(s.updated).toLocaleDateString(locale())}` : ""}</span></span><span class="chev">${icon("more")}</span></button>`);
            r.onclick = () => sheet({ title: s.name, groups: [
              [["m3u-url", "directory", "xmltv-url"].includes(s.type) && { icon: "restart", label: tr("Refresh Now"), run: async () => { toast(tr("Refreshing…"), { ms: 60000 }); try { await L.refreshSource(s.id); toast(tr("Updated")); } catch (e) { toast(e.message, { err: true, ms: 5000 }); } } },
                { icon: "pencil", label: tr("Rename"), run: async () => { const n = await ask({ title: tr("Rename source"), value: s.name }); if (n) L.renameSource(s.id, n); } }],
              [{ icon: "trash", label: tr("Remove Source"), danger: true, run: async () => { if (await confirmBox({ title: tr("Remove “{p0}”?", { p0: s.name }), message: tr("Its channels and guide data are removed from LunaTV."), ok: tr("Remove"), danger: true })) L.removeSource(s.id); } }],
            ] });
            l.append(r);
          }
          box.append(l);
        }
        const hidden = L.channels({ includeHidden: true }).filter(c => c.hidden);
        if (hidden.length) {
          const b = h(`<button class="row" style="margin-top:14px"><span class="ic">${icon("eyeOff")}</span><span class="label">${tr("Hidden Channels")}</span><span class="count">${hidden.length}</span><span class="chev">${icon("chevR")}</span></button>`);
          const wrap = h(`<div class="list glass" style="margin-top:14px"></div>`); wrap.append(b); box.append(wrap);
          b.onclick = openHidden;
        }
        content.replaceChildren(box);
      };
      render();
      const off = on("live-changed", render);
      return { destroy: off };
    },
  });
}
function openHidden() {
  push({
    title: tr("Hidden Channels"), build(content) {
      const render = () => {
        const hidden = L.channels({ includeHidden: true }).filter(c => c.hidden);
        if (!hidden.length) { content.replaceChildren(h(`<div class="empty">${tr("No hidden channels.")}</div>`)); return; }
        const l = h(`<div class="list glass"></div>`);
        hidden.forEach(c => { const r = h(`<div class="row"><span class="label">${esc(c.name)}</span><button class="btn sm">${tr("Show")}</button></div>`); r.querySelector("button").onclick = () => L.editChannel(c.id, { hidden: undefined }); l.append(r); });
        content.replaceChildren(l);
      };
      render();
      const off = on("live-changed", render);
      return { destroy: off };
    },
  });
}
