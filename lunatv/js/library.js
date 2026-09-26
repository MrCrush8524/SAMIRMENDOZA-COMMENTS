// Library: categories, poster/grid/list views, detail screens, options sheet,
// reconnecting files. Local video stays on this device.
import { tr, trn, locale } from "./i18n.js";
import { h, esc, icon, fmtLeft, fmtDur, fmtBytes, resLabel, emit, on, fuzzy } from "./util.js";
import * as media from "./media-store.js";
import * as db from "./database.js";
import { isFavorite, toggleFavorite, favorites } from "./collections.js";
import { epLabel } from "./media-meta.js";
import { setRoot, push, back, sheet, toast, ask, confirmBox, form, searchField, segmented } from "./ui.js";
import { playLocal } from "./player.js";
import { addToPlaylistSheet } from "./playlists.js";

// ------------------------------------------------------------------ opening files
let fileInput, folderInput;
function ensureInputs() {
  if (fileInput) return;
  fileInput = h(`<input type="file" accept="video/*,.mkv,.m4v,.mov,.webm,.avi,.ts,.m2ts" multiple hidden>`);
  folderInput = h(`<input type="file" webkitdirectory multiple hidden>`);
  document.body.append(fileInput, folderInput);
  fileInput.onchange = () => { const f = [...fileInput.files]; fileInput.value = ""; if (f.length) importReport(f); };
  folderInput.onchange = () => { const f = [...folderInput.files]; folderInput.value = ""; if (f.length) importReport(f, f[0].webkitRelativePath?.split("/")[0] || ""); };
}
async function importReport(files, folder = "") {
  toast(tr("Adding {p0}…", { p0: trn("{n} file", "{n} files", files.length) }), { ms: 60000 });
  const r = await media.importFiles(files, { folder });
  const parts = [];
  if (r.added) parts.push(trn("Added {n} video", "Added {n} videos", r.added));
  if (r.skipped) parts.push(tr("{n} already in LunaTV", { n: r.skipped }));
  if (r.rejected) parts.push(tr("{n} not video", { n: r.rejected }));
  toast(parts.join(" · ") || tr("Nothing added"), { err: !r.added });
}
export function pickFiles() { ensureInputs(); fileInput.click(); }
export const folderSupported = () => "showDirectoryPicker" in window || "webkitdirectory" in document.createElement("input");
export async function pickFolder() {
  if ("showDirectoryPicker" in window) {
    try {
      const dir = await window.showDirectoryPicker({ mode: "read" }), files = [];
      const walk = async (d, depth) => { for await (const e of d.values()) { if (e.kind === "file") files.push(await e.getFile()); else if (depth < 3) await walk(e, depth + 1); } };
      await walk(dir, 0);
      if (files.length) importReport(files, dir.name); else toast(tr("That folder has no files."));
    } catch (e) { if (e.name !== "AbortError") toast(tr("LunaTV couldn’t read that folder."), { err: true }); }
    return;
  }
  ensureInputs(); folderInput.click();
}

// ------------------------------------------------------------------ cards
const fallbackArt = (m, cls = "ph") => `<div class="${cls} lunafall"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""><span>${esc(m.title || "")}</span></div>`;
function artHTML(m) { const u = media.posterCached(m.id); return u ? `<img alt="" src="${u}">` : fallbackArt(m); }
const posterIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  posterIO.unobserve(e.target);
  const id = e.target.dataset.id;
  media.poster(id).then(u => { if (u) for (const ph of document.querySelectorAll(`[data-id="${CSS.escape(id)}"] > .ph`)) ph.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
}), { rootMargin: "300px" });
function lazyArt(el, m) { const a = el.matches("[data-id]") ? el : el.querySelector("[data-id]"); if (a && !media.posterCached(m.id)) posterIO.observe(a); }

function subline(m, variant) {
  const ep = epLabel(m);
  if (variant === "continue") return [ep, fmtLeft(media.remaining(m))].filter(Boolean).join(" · ") || tr("In progress");
  return ep || fmtDur(m.duration) || media.categoryName(m.category);
}
/** Media card. "continue" resumes on tap; others open details. */
export function mediaCard(m, { variant = "", list = null } = {}) {
  const pct = m.duration ? Math.min(100, (m.position / m.duration) * 100) : 0;
  const title = m.category === "tv" && m.series ? m.series : m.title;
  const el = h(`<div class="card${variant === "continue" ? " wide" : ""}">
    <div class="art" data-id="${esc(m.id)}">${artHTML(m)}${pct > 0.5 && media.inProgress(m) ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}</div>
    <button class="open" aria-label="${variant === "continue" ? tr("Resume") : tr("Open")} ${esc(m.title)}"></button>
    <button class="more" aria-label="${tr("Options for")} ${esc(m.title)}">${icon("more")}</button>
    <span class="t">${esc(title)}</span><span class="s">${esc(subline(m, variant))}</span></div>`);
  el.querySelector(".open").onclick = () => variant === "continue" ? playLocal([m]) : openDetail(m, { list });
  el.querySelector(".more").onclick = e => { e.stopPropagation(); mediaMenu(m); };
  lazyArt(el, m);
  return el;
}
export function seriesCard(s) {
  const m = media.nextUp(s);
  const el = h(`<div class="card"><div class="art" data-id="${esc(m.id)}">${artHTML({ ...m, title: s.series })}</div><button class="open" aria-label="${tr("Open")} ${esc(s.series)}"></button>
    <span class="t">${esc(s.series)}</span><span class="s">${s.seasons.size > 1 ? tr("{n} Seasons", { n: s.seasons.size }) : `${trn("{n} Episode", "{n} Episodes", s.episodes.length)}`}</span></div>`);
  el.querySelector(".open").onclick = () => openSeries(s.series);
  lazyArt(el, m);
  return el;
}
export function mediaRow(m, { onPlay, trail = "", inSeries = false, extraMenu } = {}) {
  const label = inSeries ? (m.title === `${m.series} S${m.season} E${m.episode}` ? tr("Episode {p0}", { p0: m.episode }) : m.title) : m.title;
  const sub = inSeries ? (media.inProgress(m) ? fmtLeft(media.remaining(m)) : fmtDur(m.duration) || m.filename)
    : [epLabel(m) && m.series ? m.series : media.categoryName(m.category), media.inProgress(m) ? fmtLeft(media.remaining(m)) : fmtDur(m.duration)].filter(Boolean).join(" · ");
  const el = h(`<div class="row tall" style="padding-right:4px">
    <button class="thumb-sm" data-id="${esc(m.id)}" aria-label="${tr("Play")} ${esc(m.title)}">${media.posterCached(m.id) ? `<img alt="" src="${media.posterCached(m.id)}">` : `<span class="ph">${icon(m.category === "tv" ? "tv" : "film")}</span>`}</button>
    <button class="label" style="text-align:left">${esc(label)}<span class="sub">${esc(sub)}</span></button>
    ${trail}<button class="icon-btn plain" data-menu aria-label="${tr("Options for")} ${esc(m.title)}">${icon("more")}</button></div>`);
  const play = onPlay || (() => playLocal([m]));
  el.querySelector(".thumb-sm").onclick = play; el.querySelector(".label").onclick = play;
  el.querySelector("[data-menu]").onclick = () => mediaMenu(m, { extra: extraMenu });
  if (!media.posterCached(m.id)) media.poster(m.id).then(u => { const t = el.querySelector(".thumb-sm .ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
  return el;
}
export function shelf(title, items, render, { onMore, empty, lead } = {}) {
  if (!items.length && !empty && !lead) return null;          // no meaningless empty rails
  const s = h(`<section class="shelf"><${onMore ? "button" : "h2"} class="shelf-h">${esc(title)}${onMore ? icon("chevR") : ""}</${onMore ? "button" : "h2"}><div class="rail"></div></section>`);
  if (onMore) s.firstElementChild.onclick = onMore;
  const r = s.lastElementChild;
  if (lead) r.append(lead);
  if (!items.length && empty) r.replaceWith(h(`<div class="empty">${empty}</div>`));
  items.forEach(i => r.append(render(i)));
  return s;
}
function renderItems(container, items, view) {
  if (view === "list") { const l = h(`<div class="list glass"></div>`); items.forEach(m => l.append(mediaRow(m))); container.append(l); return; }
  const g = h(`<div class="grid ${view === "grid" ? "grid-dense" : ""}"></div>`);
  items.forEach(m => g.append(mediaCard(m, { list: items })));
  container.append(g);
}

// ------------------------------------------------------------------ Library root
export function openMediaSheet() {
  sheet({ title: tr("Open Media"), groups: [
    [
      { icon: "film", label: tr("Open Video"), run: pickFiles },
      { icon: "grid", label: tr("Open Multiple Videos"), run: pickFiles },
      folderSupported() && { icon: "folderOpen", label: tr("Open Folder"), run: pickFolder },
    ],
    [
      { icon: "youtube", label: tr("YouTube Link"), sub: tr("watch, youtu.be, Shorts or playlist"), run: () => emit("open-youtube-link") },
      { icon: "link", label: tr("Direct Stream or Video URL"), sub: tr("HLS (.m3u8), MP4, WebM"), run: () => emit("open-direct-url") },
      { icon: "live", label: tr("Add Live TV Source"), sub: tr("M3U, XMLTV, backup"), run: () => emit("add-source") },
    ],
  ] });
}

export function initLibrary() {
  setRoot("library", {
    build(content) {
      let cat = "all", q = "", view = db.setting("library.view");
      const head = h(`<div><h1 class="page-title">${tr("Library")}</h1><div class="btn-row"><button class="btn blue">${icon("plus")}${tr("Open Video")}</button>${folderSupported() ? `<button class="btn">${icon("folderOpen")}${tr("Open Folder")}</button>` : ""}</div><div class="btn-row lib-links"><button class="btn sm">${icon("heart")}${tr("Favorites")}</button><button class="btn sm">${icon("history")}${tr("History")}</button><button class="btn sm only-mobile">${icon("playlist")}${tr("Playlists")}</button></div></div>`);
      const [openB, ...rest] = head.querySelectorAll(".btn");
      openB.onclick = pickFiles;
      if (folderSupported()) rest.shift().onclick = pickFolder;
      rest[0].onclick = () => emit("open-favorites"); rest[1].onclick = () => emit("open-history"); rest[2].onclick = () => { location.hash = "#/playlists"; };
      const chips = h(`<div class="chips" role="tablist" aria-label="${tr("Categories")}"></div>`);
      const tools = h(`<div class="lib-tools"></div>`);
      tools.append(searchField(tr("Search your library"), v => { q = v; render(); }), segmented([["poster", tr("Poster")], ["grid", tr("Grid")], ["list", tr("List")]], view, v => { view = v; db.setSetting("library.view", v); render(); }));
      const body = h(`<div></div>`);
      content.append(head, tools, chips, body);
      let token = 0;
      async function render() {
        const my = ++token;
        const all = await media.allMedia();
        if (my !== token) return;
        const counts = Object.fromEntries(media.CATEGORIES.map(([k]) => [k, all.filter(m => m.category === k).length]));
        chips.replaceChildren(...[["all", tr("All"), all.length], ...media.CATEGORIES.map(([k, l]) => [k, l, counts[k]])].filter(([k, , n]) => k === "all" || n).map(([k, l, n]) => {
          const b = h(`<button class="chip${k === cat ? " on" : ""}" role="tab" aria-selected="${k === cat}">${esc(l)} <small>${n}</small></button>`);
          b.onclick = () => { cat = k; render(); };
          return b;
        }));
        const out = [];
        if (!all.length) {
          const e = h(`<div class="empty big-empty"><img src="assets/branding/lunatv-crescent.webp" alt="" class="empty-mark"><b>${tr("No videos yet")}</b><span>${tr("Open a video to begin building your LunaTV library.")}</span><button class="btn blue">${icon("plus")}${tr("Open Video")}</button></div>`);
          e.querySelector("button").onclick = pickFiles;
          body.replaceChildren(e); return;
        }
        const match = fuzzy(q);
        let items = all.filter(m => (cat === "all" || m.category === cat) && (!q || match(m.title, m.filename, m.series)));
        if (!q && cat === "all") {
          const cont = all.filter(media.inProgress).sort((a, b) => b.watchedAt - a.watchedAt);
          const s = shelf(tr("Continue Watching"), cont, m => mediaCard(m, { variant: "continue" }));
          if (s) out.push(s);
        }
        if (cat === "tv" && !q) {
          const series = media.seriesOf(items);
          const g = h(`<div class="grid"></div>`); series.forEach(s => g.append(seriesCard(s)));
          out.push(h(`<div class="section-label">${trn("{n} series", "{n} series", series.length)}</div>`), g);
        } else {
          out.push(h(`<div class="section-label">${trn("{n} video", "{n} videos", items.length)}</div>`));
          const box = h(`<div></div>`);
          if (items.length) renderItems(box, items, view); else box.append(h(`<div class="empty">${tr("No matches.")}</div>`));
          out.push(box);
        }
        body.replaceChildren(...out);
      }
      render();
      return { refresh: render };
    },
  });
}

// ------------------------------------------------------------------ detail screens
export function openDetail(m, { list } = {}) {
  if (m.category === "tv" && m.series) return openSeries(m.series, m.id);
  push({
    bare: true, build(content) {
      const render = async () => {
        const cur = await media.getMedia(m.id);
        if (!cur) { content.replaceChildren(h(`<div class="empty" style="margin-top:80px">${tr("This video was removed from LunaTV.")}</div>`)); return; }
        const prog = media.inProgress(cur), fav = isFavorite("media", cur.id), u = media.posterCached(cur.id), has = await media.hasFile(cur.id);
        const el = h(`<div>
          <div class="detail-hero">${u ? `<img alt="" src="${u}">` : fallbackArt(cur)}
            <div class="detail-top"><button class="round" data-a="back" aria-label="${tr("Back")}">${icon("chevL")}</button><button class="round" data-a="more" aria-label="${tr("Options")}">${icon("more")}</button></div></div>
          <div class="detail-body">
            <h2>${esc(cur.title)}</h2>
            ${prog ? `<p class="resume-line">${tr("Resume from")} ${fmtTime2(cur.position)}</p>` : ""}
            <div class="btn-row">
              ${has ? `<button class="btn primary" data-a="play">${icon("play")}${prog ? tr("Resume") : tr("Play")}</button>${prog ? `<button class="btn" data-a="restart">${icon("restart")}${tr("Start Over")}</button>` : ""}`
                : `<button class="btn primary" data-a="relink">${icon("folderOpen")}${tr("Locate File")}</button>`}
              <button class="round${fav ? " on" : ""}" data-a="fav" aria-label="${fav ? tr("Remove from favorites") : tr("Add to favorites")}" aria-pressed="${fav}">${icon(fav ? "heartFill" : "heart")}</button>
              <button class="round" data-a="add" aria-label="${tr("Add to playlist")}">${icon("plus")}</button>
            </div>
            ${has ? "" : `<p class="note warn">${tr("File needs to be reconnected: this browser no longer holds the video. Title, poster and your place are kept.")}</p>`}
            <div class="meta">${[media.categoryName(cur.category), fmtDur(cur.duration), resLabel(cur.height) && `<span class="tag">${resLabel(cur.height)}</span>`, (cur.filename.split(".").pop() || "").toUpperCase(), cur.size ? fmtBytes(cur.size) : "", tr("Added {date}", { date: new Date(cur.added).toLocaleDateString(locale()) })].filter(Boolean).join(" · ")}</div>
            <p class="note">${esc(cur.filename)}</p>
          </div></div>`);
        const q = list?.length ? list : [cur], i = Math.max(0, q.findIndex(x => x.id === cur.id));
        const acts = {
          back: () => back(), more: () => mediaMenu(cur),
          play: () => playLocal(q, i), restart: () => playLocal(q, i, { restart: true }),
          relink: () => relinkPicker(cur),
          fav: async () => { const on = await toggleFavorite({ type: "media", ref: cur.id, title: cur.title, snapshot: { id: cur.id, title: cur.title } }); toast(on ? tr("Added to Favorites") : tr("Removed from Favorites")); render(); },
          add: () => addToPlaylistSheet({ type: "media", ref: cur.id, title: cur.title }),
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        if (!u) media.poster(cur.id).then(x => { const ph = el.querySelector(".detail-hero .ph"); if (x && ph) ph.replaceWith(Object.assign(new Image(), { src: x, alt: "" })); });
      };
      render();
      const off = on("favorites-changed", render);
      return { refresh: render, destroy: off };
    },
  });
}
const fmtTime2 = s => { s = Math.floor(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`; };

export function openSeries(name, focusId) {
  push({
    bare: true, build(content) {
      let season = null;
      const render = async () => {
        const s = media.seriesOf(await media.allMedia()).find(x => x.series === name);
        if (!s) { content.replaceChildren(h(`<div><div class="detail-top" style="position:static"><button class="round" aria-label="${tr("Back")}">${icon("chevL")}</button></div><div class="empty" style="margin-top:40px">${tr("No episodes left in this series.")}</div></div>`)); content.querySelector("button").onclick = back; return; }
        const up = media.nextUp(s), u = media.posterCached(up.id);
        const focus = focusId && s.episodes.find(e => e.id === focusId);
        if (season == null) season = (focus || up).season;
        if (!s.seasons.has(season)) season = [...s.seasons.keys()][0];
        const el = h(`<div>
          <div class="detail-hero">${u ? `<img alt="" src="${u}">` : fallbackArt({ title: s.series })}
            <div class="detail-top"><button class="round" data-a="back" aria-label="${tr("Back")}">${icon("chevL")}</button><button class="round" data-a="more" aria-label="${tr("Series options")}">${icon("more")}</button></div></div>
          <div class="detail-body">
            <h2>${esc(s.series)}</h2>
            <div class="btn-row">
              <button class="btn primary" data-a="play">${icon("play")}${media.inProgress(up) ? tr("Resume") : tr("Play")} ${esc(epLabel(up))}</button>
              <button class="round" data-a="add" aria-label="${tr("Add series to playlist")}">${icon("plus")}</button>
            </div>
            <div class="meta">${trn("{n} Season", "{n} Seasons", s.seasons.size)} · ${trn("{n} Episode", "{n} Episodes", s.episodes.length)}${resLabel(up.height) ? ` · <span class="tag">${resLabel(up.height)}</span>` : ""}</div>
          </div></div>`);
        const body = el.querySelector(".detail-body");
        if (s.seasons.size > 1) body.append(segmented([...s.seasons.keys()].map(k => [String(k), k ? tr("Season {n}", { n: k }) : tr("Specials")]), String(season), v => { season = +v; render(); }));
        const list = h(`<div class="list glass" style="margin-top:12px"></div>`);
        (s.seasons.get(season) || []).forEach(e => { const idx = s.episodes.indexOf(e); list.append(mediaRow(e, { onPlay: () => playLocal(s.episodes, idx), inSeries: true })); });
        body.append(list);
        const acts = {
          back: () => back(),
          more: () => sheet({ title: s.series, groups: [[
            { icon: "restart", label: tr("Play from First Episode"), run: () => playLocal(s.episodes, 0, { restart: true }) },
            { icon: "pencil", label: tr("Rename Series"), run: async () => { const n = await ask({ title: tr("Rename series"), value: s.series }); if (n && n !== s.series) { for (const e of s.episodes) await db.put("library", { ...(await db.get("library", e.id)), series: n }); name = n; emit("library-changed"); } } },
          ]] }),
          play: () => playLocal(s.episodes, s.episodes.indexOf(up)),
          add: () => addToPlaylistSheet(s.episodes.map(e => ({ type: "media", ref: e.id, title: e.title })), `${s.series} (${s.episodes.length} episodes)`),
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        if (!u) media.poster(up.id).then(x => { const ph = el.querySelector(".detail-hero .ph"); if (x && ph) ph.replaceWith(Object.assign(new Image(), { src: x, alt: "" })); });
      };
      render();
      return { refresh: render };
    },
  });
}

// ------------------------------------------------------------------ options sheet
export async function mediaMenu(m, { extra } = {}) {
  const prog = media.inProgress(m), fav = isFavorite("media", m.id), has = await media.hasFile(m.id);
  sheet({
    title: m.title, subtitle: [epLabel(m), fmtDur(m.duration)].filter(Boolean).join(" · "),
    groups: [
      has ? [
        { icon: "play", label: prog ? tr("Resume · {p0}", { p0: fmtLeft(media.remaining(m)) }) : tr("Play"), run: () => playLocal([m]) },
        prog && { icon: "restart", label: tr("Start Over"), run: () => playLocal([m], 0, { restart: true }) },
      ] : [{ icon: "folderOpen", label: tr("Locate File"), sub: tr("File needs to be reconnected"), run: () => relinkPicker(m) }],
      [
        { icon: fav ? "heartFill" : "heart", label: fav ? tr("Remove from Favorites") : tr("Add to Favorites"), run: async () => { const on = await toggleFavorite({ type: "media", ref: m.id, title: m.title, snapshot: { id: m.id, title: m.title } }); toast(on ? tr("Added to Favorites") : tr("Removed from Favorites")); } },
        { icon: "playlist", label: tr("Add to Playlist"), run: () => addToPlaylistSheet({ type: "media", ref: m.id, title: m.title }) },
      ],
      [
        { icon: "pencil", label: tr("Rename"), run: async () => { const t = await ask({ title: tr("Rename"), value: m.title }); if (t) { await media.updateMedia(m.id, { title: t }); toast(tr("Renamed")); } } },
        { icon: "grid", label: tr("Category"), sub: media.categoryName(m.category), run: () => categorySheet(m) },
        m.category === "tv" && { icon: "tv", label: tr("Edit Series Info"), run: () => editSeries(m) },
        { icon: "info", label: tr("File Info"), run: () => fileInfo(m) },
      ],
      extra || [],
      [{ icon: "trash", label: tr("Remove from LunaTV"), danger: true, run: async () => {
        if (await confirmBox({ title: tr("Remove “{p0}”?", { p0: m.title }), message: tr("This removes it from LunaTV and frees the space it uses. The original file on your device isn’t touched."), ok: tr("Remove"), danger: true })) { await media.removeMedia(m.id); toast(tr("Removed from LunaTV")); }
      } }],
    ],
  });
}
function categorySheet(m) {
  sheet({ title: tr("Category"), subtitle: m.title, groups: [media.CATEGORIES.map(([k, l]) => ({ label: l, check: m.category === k, run: async () => {
    if (k === "tv" && m.category !== "tv") return editSeries(m);
    await media.updateMedia(m.id, { category: k, categoryAuto: false }); toast(tr("Moved to {p0}", { p0: l }));
  } }))] });
}
async function editSeries(m) {
  const r = await form({ title: tr("Series Info"), ok: tr("Save"), fields: [
    { name: "series", label: tr("Series name"), value: m.series || m.title },
    { name: "season", label: tr("Season"), type: "number", min: 0, value: m.season || 1 },
    { name: "episode", label: tr("Episode"), type: "number", min: 0, value: m.episode || 1 },
  ] });
  if (!r) return;
  await media.updateMedia(m.id, { category: "tv", categoryAuto: false, series: r.series || "Unknown Series", season: Math.max(0, parseInt(r.season, 10) || 0), episode: Math.max(0, parseInt(r.episode, 10) || 0) });
  toast(tr("Saved"));
}
function fileInfo(m) {
  const rows = [[tr("File"), m.filename], [tr("Size"), m.size ? fmtBytes(m.size) : ""], [tr("Type"), m.mime], [tr("Resolution"), m.width ? `${m.width} × ${m.height}` : ""], [tr("Duration"), fmtDur(m.duration)], [tr("Category"), media.categoryName(m.category)], [tr("Added"), new Date(m.added).toLocaleString(locale())]].filter(r => r[1]);
  sheet({ title: tr("File Info"), groups: [rows.map(([k, v]) => ({ label: v, sub: k, disabled: true }))] });
}
let relinkInput;
function relinkPicker(m) {
  relinkInput ||= document.body.appendChild(h(`<input type="file" accept="video/*,.mkv,.m4v,.mov,.webm" hidden>`));
  relinkInput.onchange = async () => {
    const f = relinkInput.files[0]; relinkInput.value = "";
    if (!f) return;
    const r = await media.relink(m.id, f);
    toast(r.ok ? (r.warn || tr("File reconnected")) : r.reason, { err: !r.ok, ms: 3500 });
  };
  relinkInput.click();
}

// ------------------------------------------------------------------ for Home & Search
export async function searchLibrary(q) {
  const match = fuzzy(q), all = await media.allMedia();
  if (!q) return { media: [], series: [] };
  return { media: all.filter(m => match(m.title, m.filename, m.series)), series: media.seriesOf(all).filter(s => match(s.series)) };
}
export { fallbackArt };
