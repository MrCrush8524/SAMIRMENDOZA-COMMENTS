// Home: cinematic hero + discovery rails, and the unified Favorites / History
// screens. Adult items never appear here unless the user explicitly allows it.
import { h, esc, icon, on, fmtLeft, fmtDur, safeURL } from "./util.js";
import * as db from "./database.js";
import * as media from "./media-store.js";
import * as L from "./channels.js";
import * as C from "./collections.js";
import { lookupMovie } from "./metadata.js";
import { setRoot, push, switchTab, toast, confirmBox, sheet, switchEl, segmented } from "./ui.js";
import { mediaCard, seriesCard, shelf, pickFiles, openDetail } from "./library.js";
import { programCard, channelTile, playChannel, openProgram } from "./live.js";
import { playLocal, playStream } from "./player.js";
import { openYouTube, ytCard, thumb as ytThumb } from "./youtube.js";
import { openPlaylist } from "./playlists.js";

const tfmt = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const minsLeft = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} HR ${m % 60} MIN REMAINING` : `${m} MIN REMAINING`; };
const reduceMotion = () => db.setting("appearance.reduceMotion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------ hero
async function heroCandidates(all) {
  const out = [];
  for (const x of L.moviesOnNow().slice(0, 3)) out.push({ kind: "live", ...x });
  const recentCh = (await C.history({ type: "channel" }))[0];
  const rc = recentCh && L.channelById(recentCh.ref);
  if (rc) { const nn = L.nowNext(rc); if (nn.now && !out.some(o => o.channel?.id === rc.id)) out.push({ kind: "live", channel: rc, program: nn.now, label: "Your channel" }); }
  const cont = all.filter(media.inProgress).sort((a, b) => b.watchedAt - a.watchedAt)[0];
  if (cont) out.push({ kind: "media", media: cont, label: "Continue Watching" });
  const favMovie = all.find(m => C.isFavorite("media", m.id) && m.category === "movie" && m.id !== cont?.id);
  if (favMovie) out.push({ kind: "media", media: favMovie, label: "From Your Favorites" });
  const recent = all.find(m => m.category === "movie" && !out.some(o => o.media?.id === m.id));
  if (recent) out.push({ kind: "media", media: recent, label: "Recently Added" });
  return out.slice(0, 5);
}
function hero(cands) {
  if (!cands.length) return null;
  let i = 0, timer = null, stopped = false;
  const el = h(`<section class="hero-card" aria-roledescription="carousel" aria-label="Featured"><div class="hero-bg"></div><div class="hero-shade"></div><div class="hero-body"></div>${cands.length > 1 ? `<div class="hero-dots">${cands.map((_, k) => `<button aria-label="Featured item ${k + 1}"></button>`).join("")}</div>` : ""}</section>`);
  const bg = el.querySelector(".hero-bg"), body = el.querySelector(".hero-body");
  const stop = () => { stopped = true; clearInterval(timer); };
  const show = async k => {
    i = (k + cands.length) % cands.length;
    const c = cands[i];
    el.querySelectorAll(".hero-dots button").forEach((b, j) => b.classList.toggle("on", j === i));
    let art = "", html = "";
    if (c.kind === "live") {
      const p = L.progressOf(c.program), ch = c.channel;
      const meta = await lookupMovie(p.t, p.y);
      art = safeURL(p.img || meta?.backdrop || meta?.poster) || "";
      const genre = (p.cat || []).filter(x => !/movie|film/i.test(x))[0] || (L.isMovie(p, ch) ? "Movie" : "");
      html = `<span class="live-pill">LIVE</span><h2>${esc(p.t)}</h2>
        <div class="hero-meta">${[p.y || meta?.year, genre, p.r].filter(Boolean).map(x => esc(String(x).toUpperCase())).join(" • ")}</div>
        <p class="hero-sub">Playing on ${esc(ch.name)}</p><p class="hero-sub dim">${tfmt(p.s)} — ${tfmt(p.e)}</p>
        <div class="pbar hero-bar" data-s="${p.s}" data-e="${p.e}"><i style="width:${p.progress * 100}%"></i><span class="rem">${minsLeft(p.remaining)}</span></div>
        <div class="btn-row"><button class="btn primary" data-a="watch">${icon("play")}Watch Live</button><button class="btn" data-a="details">${icon("info")}Details</button><button class="btn" data-a="fav">${icon(C.isFavorite("program", L.progKey(ch, c.program)) ? "check" : "plus")}My List</button></div>`;
    } else {
      const m = c.media; art = await media.poster(m.id) || "";
      const prog = media.inProgress(m);
      html = `<span class="soon-pill">${esc(c.label)}</span><h2>${esc(m.title)}</h2>
        <div class="hero-meta">${[media.categoryName(m.category), fmtDur(m.duration)].filter(Boolean).map(x => esc(x.toUpperCase())).join(" • ")}</div>
        ${prog ? `<div class="pbar hero-bar"><i style="width:${m.position / m.duration * 100}%"></i><span class="rem">${esc(fmtLeft(media.remaining(m)).toUpperCase())}</span></div>` : ""}
        <div class="btn-row"><button class="btn primary" data-a="play">${icon("play")}${prog ? "Resume" : "Play"}</button><button class="btn" data-a="details">${icon("info")}Details</button><button class="btn" data-a="fav">${icon(C.isFavorite("media", m.id) ? "check" : "plus")}My List</button></div>`;
    }
    bg.innerHTML = art ? `<img alt="" referrerpolicy="no-referrer" src="${esc(art)}">` : `<div class="lunafall hero-fall"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""></div>`;
    bg.querySelector("img:not(.lf-mark)")?.addEventListener("error", e => e.target.remove());
    body.innerHTML = html;
    body.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
      stop();
      const a = b.dataset.a;
      if (c.kind === "live") {
        if (a === "watch") playChannel(c.channel);
        if (a === "details") openProgram(c.channel, c.program);
        if (a === "fav") { const on2 = await C.toggleFavorite({ type: "program", ref: L.progKey(c.channel, c.program), title: c.program.t, snapshot: { channelId: c.channel.id, channel: c.channel.name, title: c.program.t, s: c.program.s, e: c.program.e, img: c.program.img } }); toast(on2 ? "Added to My List" : "Removed from My List"); show(i); }
      } else {
        if (a === "play") playLocal([c.media]);
        if (a === "details") openDetail(c.media);
        if (a === "fav") { const on2 = await C.toggleFavorite({ type: "media", ref: c.media.id, title: c.media.title, snapshot: { id: c.media.id, title: c.media.title } }); toast(on2 ? "Added to My List" : "Removed from My List"); show(i); }
      }
    });
  };
  el.querySelectorAll(".hero-dots button").forEach((b, j) => b.onclick = () => { stop(); show(j); });
  let sx = null;
  el.addEventListener("pointerdown", e => { sx = e.clientX; });
  el.addEventListener("pointerup", e => { if (sx != null && Math.abs(e.clientX - sx) > 50) { stop(); show(i + (e.clientX < sx ? 1 : -1)); } sx = null; });
  el.addEventListener("focusin", stop);
  show(0);
  // restrained rotation: 10 s per item, stops for good on any interaction
  if (cands.length > 1 && !reduceMotion()) timer = setInterval(() => { if (!stopped && !document.hidden && el.isConnected) show(i + 1); }, 10000);
  el._stop = stop;
  return el;
}

// ------------------------------------------------------------------ Home
export function initHome() {
  setRoot("home", {
    build(content) {
      const body = h(`<div></div>`);
      content.append(body);
      let token = 0, heroEl = null;
      const render = async () => {
        const my = ++token;
        const all = await media.allMedia();
        const [hist, favs, pls, cands] = await Promise.all([C.history(), C.favorites({ includeAdult: true }), C.playlists(), heroCandidates(all)]);
        if (my !== token) return;
        heroEl?._stop?.();
        const out = [];
        heroEl = hero(cands); if (heroEl) out.push(heroEl);
        if (!all.length && !L.channels().length && !hist.length) {
          const w = h(`<div class="welcome glass"><img src="assets/branding/lunatv-crescent.webp" alt="" class="empty-mark"><b>Welcome to LunaTV</b><p class="note">Open a video from this device, add a live TV source, or paste a YouTube link.</p><div class="btn-row" style="justify-content:center"><button class="btn blue">${icon("plus")}Open Video</button><button class="btn">${icon("live")}Add Live Source</button></div></div>`);
          const [a, b] = w.querySelectorAll("button"); a.onclick = pickFiles; b.onclick = () => { switchTab("live"); };
          out.push(w);
        }
        const nowPlaying = L.liveNow().filter(x => C.isFavorite("channel", x.channel.id));
        out.push(shelf("Now Playing", nowPlaying, x => programCard(x)));
        out.push(shelf("Continue Watching", all.filter(media.inProgress).sort((a, b) => b.watchedAt - a.watchedAt), m => mediaCard(m, { variant: "continue" })));
        out.push(shelf("Movies On Now", L.moviesOnNow().slice(0, 20), x => programCard(x), { onMore: () => switchTab("live") }));
        out.push(shelf("Live Now", L.liveNow().filter(x => !C.isFavorite("channel", x.channel.id)).slice(0, 20), x => programCard(x), { onMore: () => switchTab("live") }));
        out.push(shelf("Coming Up", L.comingUp({ limit: 20 }), x => programCard(x, { upcoming: true })));
        out.push(shelf("Recently Added", all.slice(0, 20), m => mediaCard(m), { onMore: () => switchTab("library") }));
        const recentlyWatched = hist.filter(x => x.type === "media" || x.type === "channel").slice(0, 20);
        out.push(shelf("Recently Watched", recentlyWatched, x => itemTile(x, all)));
        out.push(shelf("Favorites", favs.slice(0, 20), x => itemTile(x, all), { onMore: openFavorites }));
        const nonEmpty = pls.filter(p => p.items.length);
        out.push(shelf("My Playlists", nonEmpty, p => { const b = h(`<button class="pl-tile glass">${icon("playlist")}<b>${esc(p.name)}</b><small>${p.items.length} item${p.items.length === 1 ? "" : "s"}</small></button>`); b.onclick = () => { switchTab("playlists"); openPlaylist(p.id); }; return b; }, { onMore: () => switchTab("playlists") }));
        out.push(shelf("YouTube Recent", hist.filter(x => x.type === "youtube").slice(0, 16), x => { const c = ytCard(x.snapshot || { id: x.ref, title: x.title }); c.classList.add("rail-yt"); return c; }));
        const series = media.seriesOf(all);
        out.push(shelf("TV Shows", series.slice(0, 12), seriesCard));
        body.replaceChildren(...out.filter(Boolean));
      };
      render();
      for (const ev of ["library-changed", "live-changed", "favorites-changed", "history-changed"]) on(ev, () => render());
      setInterval(() => { if (!document.hidden && document.body.dataset.area === "home") render(); }, 5 * 60000);   // hero/rails follow the schedule
      return { refresh: render, hidden: () => heroEl?._stop?.() };
    },
  });
}

// ------------------------------------------------------------------ unified item tiles & actions
export function itemTile(x, all = []) {
  const s = x.snapshot || {};
  if (x.type === "media") { const m = all.find(y => y.id === x.ref); if (m) return mediaCard(m); }
  if (x.type === "channel") { const c = L.channelById(x.ref); if (c) return channelTile(c); }
  const t = x.type === "youtube" ? ytThumb(s.id || x.ref) : safeURL(s.thumbnail || s.img || s.logo);
  const el = h(`<button class="card item-tile"><div class="art">${t ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(t)}">` : `<div class="ph lunafall"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""></div>`}</div><span class="t">${esc(x.title || s.title || s.name || "Item")}</span><span class="s">${esc(typeLabel(x))}</span></button>`);
  el.querySelector(".art img:not(.lf-mark)")?.addEventListener("error", e => e.target.remove());
  el.onclick = () => openItem(x, all);
  return el;
}
const typeLabel = x => ({ media: "Video", channel: "Channel", program: "Programme", youtube: "YouTube", feed: x.snapshot?.provider === "local" ? "Discover" : "Discover", playlist: "Playlist" }[x.type] || "");
export function openItem(x, all = []) {
  const s = x.snapshot || {};
  if (x.type === "media") { const m = all.find(y => y.id === x.ref); if (m) openDetail(m); else toast("This video is no longer in LunaTV.", { err: true }); }
  else if (x.type === "channel") { const c = L.channelById(x.ref); if (c) playChannel(c); else if (s.url) playStream({ id: x.ref, name: s.name || x.title, urls: s.urls || [s.url] }); }
  else if (x.type === "program") { const c = L.channelById(s.channelId), p = c && L.programmesFor(c).find(p => p.s === s.s); if (c && p) openProgram(c, p); else if (c) playChannel(c); else toast("That programme is no longer in the guide.", { err: true }); }
  else if (x.type === "youtube") openYouTube({ id: s.id || x.ref, playlist: s.playlist, title: x.title });
  else if (x.type === "playlist") { switchTab("playlists"); openPlaylist(x.ref); }
  else if (x.type === "feed") { if (s.provider === "youtube" && s.ytId) openYouTube({ id: s.ytId, title: s.title }); else if (s.provider === "local" && s.localId) { const m = all.find(y => y.id === s.localId); if (m) playLocal([m]); } else if (s.sourceUrl) window.open(s.sourceUrl, "_blank", "noopener,noreferrer"); }
}

export function openFavorites() {
  push({
    title: "Favorites", build(content) {
      let type = "all";
      const box = h(`<div></div>`);
      content.append(h(`<div class="big-title">Favorites</div>`), segmented([["all", "All"], ["media", "Videos"], ["channel", "Channels"], ["program", "Programmes"], ["youtube", "YouTube"], ["feed", "Discover"], ["playlist", "Playlists"]], type, v => { type = v; render(); }), box);
      const render = async () => {
        const all = await media.allMedia();
        const favs = (await C.favorites({ includeAdult: true })).filter(f => type === "all" || f.type === type);
        if (!favs.length) { box.replaceChildren(h(`<div class="empty big-empty"><b>No favorites</b><span>Items you favorite will appear here.</span></div>`)); return; }
        const g = h(`<div class="grid"></div>`); favs.forEach(f => g.append(itemTile(f, all))); box.replaceChildren(g);
      };
      render();
      const off = on("favorites-changed", render);
      return { refresh: render, destroy: off };
    },
  });
}
export function openHistory() {
  push({
    title: "History", build(content) {
      const box = h(`<div></div>`);
      const render = async () => {
        const all = await media.allMedia(), list = await C.history();
        const ctl = h(`<div class="list glass"><div class="row static"><span class="ic">${icon("history")}</span><span class="label">Save Watch History<span class="sub">${db.session.private ? "Private Session is on — nothing new is saved." : "Stored only on this device."}</span></span><span class="sw"></span></div><div class="row static"><span class="ic">${icon("eyeOff")}</span><span class="label">Private Session<span class="sub">Until you close this tab: no new history.</span></span><span class="sw2"></span></div></div>`);
        ctl.querySelector(".sw").replaceWith(switchEl(db.setting("library.history"), v => { db.setSetting("library.history", v); render(); }));
        ctl.querySelector(".sw2").replaceWith(switchEl(db.session.private, v => { db.session.private = v; document.body.classList.toggle("private", v); render(); }));
        const out = [ctl];
        if (!list.length) out.push(h(`<div class="empty" style="margin-top:14px">No history yet.</div>`));
        else {
          const clr = h(`<div class="btn-row" style="margin:14px 0"><button class="btn danger">${icon("trash")}Clear History</button></div>`);
          clr.querySelector("button").onclick = async () => { if (await confirmBox({ title: "Clear all history?", message: "Watch positions for Continue Watching are kept.", ok: "Clear", danger: true })) { await C.clearHistory(); render(); } };
          const l = h(`<div class="list glass"></div>`);
          for (const x of list.slice(0, 200)) {
            const r = h(`<div class="row tall"><button class="label" style="text-align:left">${esc(x.title || "Item")}<span class="sub">${esc(typeLabel(x))} · ${new Date(x.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span></button><button class="icon-btn plain" aria-label="Remove ${esc(x.title || "item")} from history">${icon("close")}</button></div>`);
            r.querySelector(".label").onclick = () => openItem(x, all);
            r.querySelector(".icon-btn").onclick = async () => { await C.removeHistory(x.id); render(); };
            l.append(r);
          }
          out.push(clr, l);
        }
        box.replaceChildren(...out);
      };
      content.append(h(`<div class="big-title">History</div>`), box);
      render();
      return { refresh: render };
    },
  });
}
on("open-favorites", openFavorites);
on("open-history", openHistory);
