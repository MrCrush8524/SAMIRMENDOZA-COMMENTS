// Library: the Style B compact list, shelves, destinations, detail screens,
// options sheet, playlists and collections.
import { h, esc, icon, fmtLeft, fmtDur, fmtBytes, resLabel, emit } from "./util.js";
import * as store from "./store.js";
import * as db from "./db.js";
import { epLabel } from "./media-meta.js";
import { setRoot, push, back, sheet, toast, ask, confirmBox, form, searchField, segmented } from "./ui.js";
import { playLocal } from "./player.js";

// ------------------------------------------------------------------ import
let fileInput;
export function pickFiles() {
  if (!fileInput) {
    fileInput = h(`<input type="file" accept="video/*,.mkv,.m4v,.mov,.webm,.avi,.ts,.m2ts" multiple hidden>`);
    document.body.append(fileInput);
    fileInput.onchange = async () => {
      const files = [...fileInput.files]; fileInput.value = "";
      if (!files.length) return;
      toast(`Importing ${files.length} file${files.length === 1 ? "" : "s"}…`, { ms: 60000 });
      const r = await store.importFiles(files);
      const parts = [];
      if (r.added) parts.push(`Added ${r.added} video${r.added === 1 ? "" : "s"}`);
      if (r.skipped) parts.push(`${r.skipped} already in VIDeX`);
      if (r.rejected) parts.push(`${r.rejected} not a video`);
      toast(parts.join(" · ") || "Nothing imported", { err: !r.added });
    };
  }
  fileInput.click();
}

// ------------------------------------------------------------------ cards
function artHTML(m) {
  const u = store.posterCached(m.id);
  return u ? `<img alt="" src="${u}">` : `<div class="ph">${icon(m.kind === "episode" ? "tv" : "film")}<small>${esc(m.filename || "")}</small></div>`;
}
const posterIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  posterIO.unobserve(e.target);
  store.poster(e.target.dataset.id).then(u => {
    if (!u) return;
    for (const ph of document.querySelectorAll(`[data-id="${CSS.escape(e.target.dataset.id)}"] > .ph`)) ph.replaceWith(Object.assign(new Image(), { src: u, alt: "" }));
  });
}), { rootMargin: "300px" });
function lazyArt(el, m) { const a = el.querySelector("[data-id]") || el; if (!store.posterCached(m.id)) posterIO.observe(a); }

function subline(m, variant) {
  const ep = epLabel(m);
  if (variant === "continue") return [ep, fmtLeft(store.remaining(m))].filter(Boolean).join(" · ") || "In progress";
  return ep || fmtDur(m.duration) || (m.kind === "episode" ? "Episode" : "Movie");
}
/** Media card. variant "continue" plays on tap; others open the detail screen. */
export function mediaCard(m, { variant = "", list = null, group = null } = {}) {
  const pct = m.duration ? Math.min(100, (m.position / m.duration) * 100) : 0;
  const title = m.kind === "episode" && m.series ? m.series : m.title;
  const el = h(`<div class="card${variant === "continue" ? " wide" : ""}">
    <div class="art" data-id="${esc(m.id)}">${artHTML(m)}${pct > 0.5 && store.inProgress(m) ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}</div>
    <button class="open" aria-label="${variant === "continue" ? "Resume" : "Open"} ${esc(m.title)}"></button>
    <button class="more" aria-label="Options for ${esc(m.title)}">${icon("more")}</button>
    <span class="t">${esc(title)}</span><span class="s">${esc(subline(m, variant))}</span></div>`);
  el.querySelector(".open").onclick = () => variant === "continue" ? playLocal([m]) : openDetail(m, { list, group });
  el.querySelector(".more").onclick = e => { e.stopPropagation(); mediaMenu(m, { group }); };
  lazyArt(el, m);
  return el;
}
function seriesCard(s) {
  const m = store.nextUp(s);
  const el = h(`<div class="card"><div class="art" data-id="${esc(m.id)}">${artHTML(m)}</div><button class="open" aria-label="Open ${esc(s.series)}"></button>
    <span class="t">${esc(s.series)}</span><span class="s">${s.seasons.size > 1 ? `${s.seasons.size} Seasons` : `${s.episodes.length} Episode${s.episodes.length === 1 ? "" : "s"}`}</span></div>`);
  el.querySelector(".open").onclick = () => openSeries(s.series);
  lazyArt(el, m);
  return el;
}
function addCard() {
  const el = h(`<div class="card add"><div class="art">${icon("plus")}</div><button class="open" aria-label="Import videos"></button><span class="t">Add Videos</span><span class="s">From this device</span></div>`);
  el.querySelector(".open").onclick = pickFiles;
  return el;
}
function mediaRow(m, { onPlay, group, trail = "", inSeries = false } = {}) {
  // Inside a series screen the series name is redundant: "Episode 4", or the custom title.
  const label = inSeries ? (m.title === `${m.series} S${m.season} E${m.episode}` ? `Episode ${m.episode}` : m.title) : m.title;
  const sub = inSeries ? (store.inProgress(m) ? fmtLeft(store.remaining(m)) : fmtDur(m.duration) || m.filename)
    : [epLabel(m) && m.series ? m.series : "", store.inProgress(m) ? fmtLeft(store.remaining(m)) : fmtDur(m.duration)].filter(Boolean).join(" · ") || m.filename;
  const el = h(`<div class="row tall" style="padding-right:4px">
    <button class="thumb-sm" data-id="${esc(m.id)}" aria-label="Play ${esc(m.title)}">${store.posterCached(m.id) ? `<img alt="" src="${store.posterCached(m.id)}">` : `<span class="ph">${icon(m.kind === "episode" ? "tv" : "film")}</span>`}</button>
    <button class="label" style="text-align:left">${esc(label)}<span class="sub">${esc(sub)}</span></button>
    ${trail}<button class="icon-btn plain" aria-label="Options for ${esc(m.title)}">${icon("more")}</button></div>`);
  const play = onPlay || (() => playLocal([m]));
  el.querySelector(".thumb-sm").onclick = play; el.querySelector(".label").onclick = play;
  el.querySelector(".icon-btn:last-child").onclick = () => mediaMenu(m, { group });
  if (!store.posterCached(m.id)) store.poster(m.id).then(u => { const t = el.querySelector(".thumb-sm .ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
  return el;
}

function shelf(title, items, render, { onMore, empty, lead } = {}) {
  const s = h(`<section class="shelf"><button class="shelf-h"${onMore ? "" : " disabled style=\"opacity:1;cursor:default\""}>${esc(title)}${onMore ? icon("chevR") : ""}</button><div class="rail"></div></section>`);
  if (onMore) s.firstElementChild.onclick = onMore;
  const r = s.lastElementChild;
  if (lead) r.append(lead);
  if (!items.length && empty) r.replaceWith(h(`<div class="empty">${empty}</div>`));
  items.forEach(i => r.append(render(i)));
  return s;
}

// ------------------------------------------------------------------ Library root
const ROWS = [
  ["film", "Movies", () => openMovies()],
  ["tv", "TV Shows", () => openShows()],
  ["playlist", "Playlists", () => openGroups("playlist")],
  ["heart", "Favorites", () => openFavorites()],
  ["download", "Local Files", () => openLocalFiles()],
  ["folder", "Collections", () => openGroups("collection")],
];
export function initLibrary() {
  setRoot("library", {
    build(content) {
      const list = h(`<nav class="list glass list-wrap" aria-label="Library sections"></nav>`);
      for (const [ic, label, fn] of ROWS) {
        const b = h(`<button class="row"><span class="ic">${icon(ic)}</span><span class="label">${label}</span><span class="chev">${icon("chevR")}</span></button>`);
        b.onclick = fn; list.append(b);
      }
      const shelves = h(`<div></div>`);
      content.append(h(`<h1 class="page-title">Library</h1>`), list, shelves);
      let token = 0;
      const render = async () => {
        const my = ++token;
        const [media, gs] = await Promise.all([store.allMedia(), store.groups()]);
        if (my !== token) return;
        shelves.replaceChildren(...libraryShelves(media, gs));
      };
      render();
      return { refresh: render };
    },
  });
}

function libraryShelves(media, gs) {
  const out = [];
  const cont = media.filter(store.inProgress).sort((a, b) => b.watchedAt - a.watchedAt);
  out.push(shelf("Continue Watching", cont, m => mediaCard(m, { variant: "continue" }), { empty: "Videos you start watching will appear here.", onMore: cont.length ? openContinue : null }));
  out.push(shelf("Recently Added", media.slice(0, 20), m => mediaCard(m), {
    onMore: media.length ? () => openLocalFiles() : null, lead: addCard(),
  }));
  const movies = media.filter(m => m.kind === "movie");
  if (movies.length) out.push(shelf("Movies", movies.slice(0, 20), m => mediaCard(m), { onMore: () => openMovies() }));
  const series = store.seriesOf(media);
  if (series.length) out.push(shelf("TV Shows", series, seriesCard, { onMore: () => openShows() }));
  const favs = media.filter(m => m.favorite);
  if (favs.length) out.push(shelf("Favorites", favs, m => mediaCard(m), { onMore: () => openFavorites() }));
  const byId = new Map(media.map(m => [m.id, m]));
  for (const g of gs) {
    const items = g.media.map(id => byId.get(id)).filter(Boolean);
    if (items.length) out.push(shelf(g.name, items, m => mediaCard(m, { list: items, group: g }), { onMore: () => openGroup(g.id) }));
  }
  return out;
}

// ------------------------------------------------------------------ destinations
/** Generic grid destination with search + sort. */
function gridView({ title, source, emptyHTML, headerExtra, cardOpts = () => ({}) }) {
  push({
    title, build(content) {
      let q = "", sort = "recent";
      const grid = h(`<div class="grid"></div>`);
      const render = async () => {
        let items = await source();
        if (q) items = items.filter(m => [m.title, m.filename, m.series].some(s => s?.toLowerCase().includes(q)));
        if (sort === "title") items = [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        grid.replaceChildren();
        if (!items.length) grid.append(h(`<div class="empty" style="grid-column:1/-1">${q ? "No matches." : emptyHTML}</div>`));
        items.forEach(m => grid.append(mediaCard(m, { list: items, ...cardOpts(m) })));
        grid.querySelector(".empty .btn")?.addEventListener("click", pickFiles);
      };
      content.append(h(`<div class="big-title">${esc(title)}</div>`));
      if (headerExtra) content.append(headerExtra());
      content.append(searchField(`Search ${title}`, v => { q = v.toLowerCase(); render(); }),
        segmented([["recent", "Recently Added"], ["title", "Title"]], sort, v => { sort = v; render(); }), grid);
      render();
      return { refresh: render };
    },
  });
}
const importBtn = `<button class="btn blue">${icon("plus")}Import Videos</button>`;
function openMovies() {
  gridView({ title: "Movies", source: async () => (await store.allMedia()).filter(m => m.kind === "movie"), emptyHTML: `No movies yet. Videos that aren’t named like TV episodes show up here.<br>${importBtn}` });
}
function openContinue() {
  gridView({ title: "Continue Watching", source: async () => (await store.allMedia()).filter(store.inProgress).sort((a, b) => b.watchedAt - a.watchedAt), emptyHTML: "Nothing in progress." });
}
function openFavorites() {
  gridView({ title: "Favorites", source: async () => (await store.allMedia()).filter(m => m.favorite), emptyHTML: "Tap ♡ on any video, or use ••• › Add to Favorites." });
}
function openLocalFiles() {
  gridView({
    title: "Local Files", source: store.allMedia, emptyHTML: `No videos yet.<br>${importBtn}`,
    headerExtra: () => {
      const wrap = h(`<div><div class="btn-row"><button class="btn blue">${icon("plus")}Import Videos</button></div><p class="note storage-note"></p></div>`);
      wrap.querySelector("button").onclick = pickFiles;
      (async () => {
        const [est, persisted] = await Promise.all([db.estimate(), db.isPersisted()]);
        const n = wrap.querySelector(".storage-note");
        n.textContent = (!db.persistent ? "Browser storage is unavailable (private browsing?), so imported videos last only until this tab closes. "
          : "Videos are copied into this browser’s storage and never uploaded. " + (persisted ? "Storage is marked persistent. " : "The browser may clear them if the device runs low on space, so keep your originals. "))
          + (est?.quota ? `Using ${fmtBytes(est.usage)} of ${fmtBytes(est.quota)} available.` : "");
      })();
      return wrap;
    },
  });
}

function openShows() {
  push({
    title: "TV Shows", build(content) {
      let q = "";
      const list = h(`<div></div>`);
      const render = async () => {
        const series = store.seriesOf(await store.allMedia()).filter(s => !q || s.series.toLowerCase().includes(q));
        if (!series.length) { list.replaceChildren(h(`<div class="empty">${q ? "No matches." : "No TV episodes yet. Files named like <b>Show.Name.S01E02.mp4</b> are grouped here automatically, or use ••• › Mark as TV Episode on any video."}</div>`)); return; }
        const g = h(`<div class="list glass"></div>`);
        for (const s of series) {
          const m = store.nextUp(s);
          const r = h(`<button class="row tall"><span class="thumb-sm" data-id="${esc(m.id)}">${store.posterCached(m.id) ? `<img alt="" src="${store.posterCached(m.id)}">` : `<span class="ph">${icon("tv")}</span>`}</span><span class="label">${esc(s.series)}<span class="sub">${s.seasons.size} season${s.seasons.size === 1 ? "" : "s"} · ${s.episodes.length} episode${s.episodes.length === 1 ? "" : "s"}</span></span><span class="chev">${icon("chevR")}</span></button>`);
          r.onclick = () => openSeries(s.series);
          if (!store.posterCached(m.id)) store.poster(m.id).then(u => { const t = r.querySelector(".ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
          g.append(r);
        }
        list.replaceChildren(g);
      };
      content.append(h(`<div class="big-title">TV Shows</div>`), searchField("Search shows", v => { q = v.toLowerCase(); render(); }), h(`<div style="height:12px"></div>`), list);
      render();
      return { refresh: render };
    },
  });
}

// ------------------------------------------------------------------ detail screens
export function openDetail(m, { list, group } = {}) {
  if (m.kind === "episode" && m.series) return openSeries(m.series, m.id);
  push({
    bare: true, build(content, view) {
      const render = async () => {
        const cur = await store.getMedia(m.id);
        if (!cur) { content.replaceChildren(h(`<div class="empty" style="margin-top:80px">This video was removed from VIDeX.</div>`)); return; }
        const prog = store.inProgress(cur);
        const u = store.posterCached(cur.id);
        const el = h(`<div>
          <div class="detail-hero">${u ? `<img alt="" src="${u}">` : `<div class="ph">${icon("film")}</div>`}
            <div class="detail-top"><button class="round" data-a="back" aria-label="Back">${icon("chevL")}</button><button class="round" data-a="more" aria-label="Options">${icon("more")}</button></div></div>
          <div class="detail-body">
            <h2>${esc(cur.title)}</h2>
            <div class="btn-row">
              <button class="btn primary" data-a="play">${icon("play")}${prog ? "Resume" : "Play"}</button>
              ${prog ? `<button class="round" data-a="restart" aria-label="Start over">${icon("restart")}</button>` : ""}
              <button class="round${cur.favorite ? " on" : ""}" data-a="fav" aria-label="${cur.favorite ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${cur.favorite}">${icon(cur.favorite ? "heartFill" : "heart")}</button>
              <button class="round" data-a="add" aria-label="Add to playlist">${icon("plus")}</button>
            </div>
            <div class="meta">${[fmtDur(cur.duration), resLabel(cur.height) && `<span class="tag">${resLabel(cur.height)}</span>`, (cur.filename.split(".").pop() || "").toUpperCase(), fmtBytes(cur.size), "Added " + new Date(cur.added).toLocaleDateString()].filter(Boolean).join(" · ")}</div>
            ${prog ? `<p class="desc">${esc(fmtLeft(store.remaining(cur)))} · stopped at ${Math.round(cur.position / 60)}m</p>` : ""}
            <p class="note">${esc(cur.filename)}</p>
          </div></div>`);
        const q = list?.length ? list : [cur], i = Math.max(0, q.findIndex(x => x.id === cur.id));
        const acts = {
          back: () => back(), more: () => mediaMenu(cur, { group }),
          play: () => playLocal(q, i, { group }), restart: () => playLocal(q, i, { group, restart: true }),
          fav: async () => { await store.updateMedia(cur.id, { favorite: !cur.favorite }); toast(cur.favorite ? "Removed from Favorites" : "Added to Favorites"); },
          add: () => groupPicker(cur, "playlist"),
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        if (!u) store.poster(cur.id).then(x => { const ph = el.querySelector(".detail-hero .ph"); if (x && ph) ph.replaceWith(Object.assign(new Image(), { src: x, alt: "" })); });
      };
      render();
      return { refresh: render };
    },
  });
}

function openSeries(name, focusId) {
  push({
    bare: true, build(content) {
      let season = null;
      const render = async () => {
        const s = store.seriesOf(await store.allMedia()).find(x => x.series === name);
        if (!s) { content.replaceChildren(h(`<div><div class="detail-top" style="position:static"><button class="round" aria-label="Back">${icon("chevL")}</button></div><div class="empty" style="margin-top:40px">No episodes left in this series.</div></div>`)); content.querySelector("button").onclick = back; return; }
        const up = store.nextUp(s), u = store.posterCached(up.id);
        const focus = focusId && s.episodes.find(e => e.id === focusId);
        if (season == null) season = (focus || up).season;
        if (!s.seasons.has(season)) season = [...s.seasons.keys()][0];
        const allFav = s.episodes.every(e => e.favorite);
        const el = h(`<div>
          <div class="detail-hero">${u ? `<img alt="" src="${u}">` : `<div class="ph">${icon("tv")}</div>`}
            <div class="detail-top"><button class="round" data-a="back" aria-label="Back">${icon("chevL")}</button><button class="round" data-a="more" aria-label="Series options">${icon("more")}</button></div></div>
          <div class="detail-body">
            <h2>${esc(s.series)}</h2>
            <div class="btn-row">
              <button class="btn primary" data-a="play">${icon("play")}${store.inProgress(up) ? "Resume" : "Play"} ${esc(epLabel(up))}</button>
              <button class="round" data-a="add" aria-label="Add series to playlist">${icon("plus")}</button>
              <button class="round${allFav ? " on" : ""}" data-a="fav" aria-label="${allFav ? "Remove series from favorites" : "Add series to favorites"}" aria-pressed="${allFav}">${icon(allFav ? "heartFill" : "heart")}</button>
            </div>
            <div class="meta">${s.seasons.size} Season${s.seasons.size === 1 ? "" : "s"} · ${s.episodes.length} Episode${s.episodes.length === 1 ? "" : "s"}${resLabel(up.height) ? ` · <span class="tag">${resLabel(up.height)}</span>` : ""}</div>
          </div></div>`);
        const body = el.querySelector(".detail-body");
        if (s.seasons.size > 1) body.append(segmented([...s.seasons.keys()].map(k => [String(k), k ? `Season ${k}` : "Specials"]), String(season), v => { season = +v; render(); }));
        const eps = s.seasons.get(season) || [];
        const list = h(`<div class="list glass" style="margin-top:12px"></div>`);
        eps.forEach(e => {
          const idx = s.episodes.indexOf(e);
          list.append(mediaRow(e, { onPlay: () => playLocal(s.episodes, idx), inSeries: true }));
        });
        body.append(list);
        const acts = {
          back: () => back(),
          more: () => sheet({ title: s.series, groups: [[
            { icon: "restart", label: "Play from first episode", run: () => playLocal(s.episodes, 0, { restart: true }) },
            { icon: "pencil", label: "Rename series", run: async () => { const n = await ask({ title: "Rename series", value: s.series }); if (n && n !== s.series) { for (const e of s.episodes) await db.put("media", { ...(await db.get("media", e.id)), series: n }); name = n; emit("library-changed"); } } },
          ]] }),
          play: () => playLocal(s.episodes, s.episodes.indexOf(up)),
          add: async () => {
            const pls = await store.groups("playlist");
            sheet({ title: `Add ${s.series} to…`, groups: [pls.map(p => ({ icon: "playlist", label: p.name, run: async () => { await store.addManyToGroup(p.id, s.episodes.map(e => e.id)); toast(`Added ${s.episodes.length} episodes to ${p.name}`); } })),
              [{ icon: "plus", label: "New Playlist…", run: async () => { const n = await ask({ title: "New Playlist", placeholder: "Playlist name", ok: "Create" }); if (n) { const g = await store.createGroup("playlist", n); await store.addManyToGroup(g.id, s.episodes.map(e => e.id)); toast(`Created ${n}`); } } }]] });
          },
          fav: async () => { for (const e of s.episodes) await db.put("media", { ...(await db.get("media", e.id)), favorite: !allFav }); emit("library-changed"); toast(allFav ? "Removed from Favorites" : "Added to Favorites"); },
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        if (!u) store.poster(up.id).then(x => { const ph = el.querySelector(".detail-hero .ph"); if (x && ph) ph.replaceWith(Object.assign(new Image(), { src: x, alt: "" })); });
      };
      render();
      return { refresh: render };
    },
  });
}

// ------------------------------------------------------------------ options sheet
export function mediaMenu(m, { group } = {}) {
  const prog = store.inProgress(m);
  sheet({
    title: m.title, subtitle: [epLabel(m), fmtDur(m.duration)].filter(Boolean).join(" · "),
    groups: [
      [
        { icon: "play", label: prog ? `Resume · ${fmtLeft(store.remaining(m))}` : "Play", run: () => playLocal([m]) },
        prog && { icon: "restart", label: "Start Over", run: () => playLocal([m], 0, { restart: true }) },
      ],
      [
        { icon: m.favorite ? "heartFill" : "heart", label: m.favorite ? "Remove from Favorites" : "Add to Favorites", run: async () => { await store.updateMedia(m.id, { favorite: !m.favorite }); toast(m.favorite ? "Removed from Favorites" : "Added to Favorites"); } },
        { icon: "playlist", label: "Add to Playlist", run: () => groupPicker(m, "playlist") },
        { icon: "folder", label: "Add to Collection", run: () => groupPicker(m, "collection") },
      ],
      [
        { icon: "pencil", label: "Rename", run: async () => { const t = await ask({ title: "Rename", value: m.title }); if (t) { await store.updateMedia(m.id, { title: t }); toast("Renamed"); } } },
        m.kind === "episode"
          ? { icon: "film", label: "Mark as Movie", run: async () => { await store.updateMedia(m.id, { kind: "movie" }); toast("Moved to Movies"); } }
          : { icon: "tv", label: "Mark as TV Episode", run: () => editSeries(m) },
        m.kind === "episode" && { icon: "tv", label: "Edit Series Info", run: () => editSeries(m) },
        { icon: "info", label: "File Info", run: () => fileInfo(m) },
      ],
      group && [{ icon: "close", label: `Remove from “${group.name}”`, run: async () => { await store.toggleInGroup(group.id, m.id); toast(`Removed from ${group.name}`); } }],
      [{ icon: "trash", label: "Remove from VIDeX", danger: true, run: async () => {
        if (await confirmBox({ title: `Remove “${m.title}”?`, message: "This removes it from VIDeX and frees the space it uses. The original file on your device isn’t touched.", ok: "Remove", danger: true })) { await store.removeMedia(m.id); toast("Removed from VIDeX"); }
      } }],
    ],
  });
}

async function editSeries(m) {
  const r = await form({
    title: "Series Info", ok: "Save", fields: [
      { name: "series", label: "Series name", value: m.series || m.title },
      { name: "season", label: "Season", type: "number", min: 0, value: m.season || 1 },
      { name: "episode", label: "Episode", type: "number", min: 0, value: m.episode || 1 },
    ],
  });
  if (!r) return;
  const season = Math.max(0, parseInt(r.season, 10) || 0), episode = Math.max(0, parseInt(r.episode, 10) || 0);
  await store.updateMedia(m.id, { kind: "episode", series: r.series || "Unknown Series", season, episode });
  toast("Saved");
}

function fileInfo(m) {
  const rows = [
    ["File", m.filename], ["Size", fmtBytes(m.size)], ["Type", m.mime || (m.filename.split(".").pop() || "").toUpperCase()],
    ["Resolution", m.width ? `${m.width} × ${m.height}` : "Not read yet"], ["Duration", fmtDur(m.duration) || "Unknown"],
    ["Added", new Date(m.added).toLocaleString()],
  ];
  sheet({ title: "File Info", groups: [rows.map(([k, v]) => ({ label: v, sub: k, disabled: true }))] });
}

/** Toggle membership in playlists/collections; offers "New …". */
async function groupPicker(m, type) {
  const gs = await store.groups(type), noun = type === "playlist" ? "Playlist" : "Collection";
  sheet({
    title: `Add to ${noun}`, subtitle: m.title,
    groups: [
      gs.map(g => ({ icon: type === "playlist" ? "playlist" : "folderLine", label: g.name, sub: `${g.media.length} video${g.media.length === 1 ? "" : "s"}`, check: g.media.includes(m.id),
        run: async () => { const added = await store.toggleInGroup(g.id, m.id); toast(added ? `Added to ${g.name}` : `Removed from ${g.name}`); } })),
      [{ icon: "plus", label: `New ${noun}…`, run: async () => { const n = await ask({ title: `New ${noun}`, placeholder: `${noun} name`, ok: "Create" }); if (n) { const g = await store.createGroup(type, n); await store.toggleInGroup(g.id, m.id); toast(`Added to ${n}`); } } }],
    ],
  });
}

// ------------------------------------------------------------------ playlists & collections
function openGroups(type) {
  const noun = type === "playlist" ? "Playlist" : "Collection";
  const create = async () => { const n = await ask({ title: `New ${noun}`, placeholder: `${noun} name`, ok: "Create" }); if (n) { const g = await store.createGroup(type, n); openGroup(g.id); } };
  const addBtn = h(`<button class="icon-btn" aria-label="New ${noun}">${icon("plus")}</button>`);
  addBtn.onclick = create;
  push({
    title: `${noun}s`, actions: addBtn, build(content) {
      const list = h(`<div></div>`);
      const render = async () => {
        const [gs, media] = await Promise.all([store.groups(type), store.allMedia()]);
        const byId = new Map(media.map(m => [m.id, m]));
        if (!gs.length) {
          const e = h(`<div class="empty">No ${noun.toLowerCase()}s yet.<br><button class="btn blue">${icon("plus")}New ${noun}</button></div>`);
          e.querySelector("button").onclick = create; list.replaceChildren(e); return;
        }
        const g = h(`<div class="list glass"></div>`);
        for (const x of gs) {
          const items = x.media.map(id => byId.get(id)).filter(Boolean), first = items[0];
          const r = h(`<button class="row tall"><span class="thumb-sm"${first ? ` data-id="${esc(first.id)}"` : ""}>${first && store.posterCached(first.id) ? `<img alt="" src="${store.posterCached(first.id)}">` : `<span class="ph">${icon(type === "playlist" ? "playlist" : "folderLine")}</span>`}</span><span class="label">${esc(x.name)}<span class="sub">${items.length} video${items.length === 1 ? "" : "s"}</span></span><span class="chev">${icon("chevR")}</span></button>`);
          r.onclick = () => openGroup(x.id);
          if (first && !store.posterCached(first.id)) store.poster(first.id).then(u => { const t = r.querySelector(".ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
          g.append(r);
        }
        list.replaceChildren(g);
      };
      content.append(h(`<div class="big-title">${noun}s</div>`), list);
      render();
      return { refresh: render };
    },
  });
}

const REPEAT = { off: ["repeat", "Repeat off"], all: ["repeat", "Repeat all"], one: ["repeat", "Repeat one"] };
function openGroup(id) {
  let editing = false;
  const editBtn = h(`<button class="icon-btn" style="width:auto;padding:0 8px;font-size:16px" aria-label="Edit order">Edit</button>`);
  const moreBtn = h(`<button class="icon-btn" aria-label="Options">${icon("more")}</button>`);
  push({
    title: "", actions: [editBtn, moreBtn], build(content, view) {
      const render = async () => {
        const [g, media] = await Promise.all([store.getGroup(id), store.allMedia()]);
        if (!g) { content.replaceChildren(h(`<div class="empty">This was deleted.</div>`)); editBtn.hidden = moreBtn.hidden = true; return; }
        const isPl = g.type === "playlist", noun = isPl ? "Playlist" : "Collection";
        view.querySelector(".navbar h1").textContent = g.name;
        const byId = new Map(media.map(m => [m.id, m]));
        const items = g.media.map(x => byId.get(x)).filter(Boolean);
        editBtn.hidden = !isPl || items.length < 2;
        editBtn.textContent = editing ? "Done" : "Edit";
        const total = items.reduce((a, m) => a + (m.duration || 0), 0);
        const el = h(`<div><div class="big-title">${esc(g.name)}</div><p class="note">${items.length} video${items.length === 1 ? "" : "s"}${total ? " · " + fmtDur(total) : ""}</p>
          <div class="btn-row">
            <button class="btn primary" data-a="play"${items.length ? "" : " disabled"}>${icon("play")}Play${isPl ? " All" : ""}</button>
            <button class="round" data-a="shuffle" aria-label="Shuffle"${items.length > 1 ? "" : " disabled"}>${icon("shuffle")}</button>
            ${isPl ? `<button class="round${g.repeat !== "off" ? " on" : ""}" data-a="repeat" aria-label="${REPEAT[g.repeat || "off"][1]}" title="${REPEAT[g.repeat || "off"][1]}" style="position:relative">${icon("repeat")}${g.repeat === "one" ? `<b style="position:absolute;font-size:9px;bottom:9px;right:10px">1</b>` : ""}</button>` : ""}
            <button class="round" data-a="add" aria-label="Add videos">${icon("plus")}</button>
          </div><div class="items" style="margin-top:14px"></div></div>`);
        const box = el.querySelector(".items");
        if (!items.length) box.append(h(`<div class="empty">This ${noun.toLowerCase()} is empty. Tap + to add videos.</div>`));
        else if (isPl) {
          const list = h(`<div class="list glass"></div>`);
          items.forEach((m, i) => {
            const trail = editing ? `<button class="icon-btn plain" data-mv="-1" aria-label="Move up"${i ? "" : " disabled"}>${icon("up")}</button><button class="icon-btn plain" data-mv="1" aria-label="Move down"${i < items.length - 1 ? "" : " disabled"}>${icon("down")}</button>` : "";
            const r = mediaRow(m, { group: g, onPlay: () => playLocal(items, i, { group: g }), trail });
            r.querySelectorAll("[data-mv]").forEach(b => b.onclick = async () => {
              const j = i + +b.dataset.mv, arr = items.map(x => x.id);
              [arr[i], arr[j]] = [arr[j], arr[i]];
              await store.saveGroup({ ...g, media: arr });
            });
            list.append(r);
          });
          box.append(list);
        } else {
          const grid = h(`<div class="grid"></div>`);
          items.forEach(m => grid.append(mediaCard(m, { list: items, group: g })));
          box.append(grid);
        }
        const acts = {
          play: () => playLocal(items, 0, { group: g }),
          shuffle: () => playLocal(items, 0, { group: g, shuffle: true }),
          repeat: async () => { const nx = { off: "all", all: "one", one: "off" }[g.repeat || "off"]; await store.saveGroup({ ...g, repeat: nx }); toast(REPEAT[nx][1]); },
          add: () => pickInto(g),
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        moreBtn.onclick = () => sheet({ title: g.name, groups: [
          [{ icon: "plus", label: "Add Videos", run: () => pickInto(g) }, { icon: "pencil", label: `Rename ${noun}`, run: async () => { const n = await ask({ title: `Rename ${noun}`, value: g.name }); if (n) await store.saveGroup({ ...g, name: n }); } }],
          [{ icon: "trash", label: `Delete ${noun}`, danger: true, run: async () => { if (await confirmBox({ title: `Delete “${g.name}”?`, message: "The videos stay in your library.", ok: "Delete", danger: true })) { await store.deleteGroup(g.id); back(); } } }],
        ] });
      };
      editBtn.onclick = () => { editing = !editing; render(); };
      render();
      return { refresh: render };
    },
  });
}

/** Multi-select picker to add library videos into a playlist/collection. */
function pickInto(g) {
  const chosen = new Set();
  const addBtn = h(`<button class="icon-btn" style="width:auto;padding:0 8px;font-size:16px;font-weight:650" disabled>Add</button>`);
  push({
    title: "Add Videos", actions: addBtn, async build(content) {
      const media = (await store.allMedia()).filter(m => !g.media.includes(m.id));
      if (!media.length) {
        const e = h(`<div class="empty">Everything in your library is already here.<br><button class="btn blue">${icon("plus")}Import Videos</button></div>`);
        e.querySelector("button").onclick = pickFiles; content.append(e); return;
      }
      const list = h(`<div class="list glass"></div>`);
      for (const m of media) {
        const r = h(`<button class="row tall" role="checkbox" aria-checked="false"><span class="thumb-sm"><span class="ph">${icon(m.kind === "episode" ? "tv" : "film")}</span></span><span class="label">${esc(m.title)}<span class="sub">${esc(epLabel(m) || fmtDur(m.duration) || m.filename)}</span></span><span class="ic" style="opacity:0">${icon("check")}</span></button>`);
        store.poster(m.id).then(u => { const t = r.querySelector(".ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
        r.onclick = () => {
          const on = !chosen.has(m.id); on ? chosen.add(m.id) : chosen.delete(m.id);
          r.setAttribute("aria-checked", on); r.querySelector(".ic").style.opacity = on ? 1 : 0;
          addBtn.disabled = !chosen.size; addBtn.textContent = chosen.size ? `Add (${chosen.size})` : "Add";
        };
        list.append(r);
      }
      content.append(h(`<p class="note">Choose videos to add to “${esc(g.name)}”.</p>`), list);
    },
  });
  addBtn.onclick = async () => { await store.addManyToGroup(g.id, [...chosen]); toast(`Added ${chosen.size} to ${g.name}`); back(); };
}

// ------------------------------------------------------------------ for Home & Search
export async function searchLibrary(q) {
  q = q.toLowerCase();
  const [media, gs] = await Promise.all([store.allMedia(), store.groups()]);
  if (!q) return { media: [], series: [], groups: [] };
  return {
    media: media.filter(m => [m.title, m.filename, m.series].some(s => s?.toLowerCase().includes(q))),
    series: store.seriesOf(media).filter(s => s.series.toLowerCase().includes(q)),
    groups: gs.filter(g => g.name.toLowerCase().includes(q)),
  };
}
export { openGroup, openSeries, openLocalFiles, openContinue, seriesCard, shelf, mediaRow };
