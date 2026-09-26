// Discover — the Luna Feed. One item per screen, swipe up/down. Only the
// active card (plus its neighbours for direct video) holds a real player;
// everything else is a lazy thumbnail. Players are destroyed as you move on.
import { h, esc, icon, on, emit, fmtDur, shareOrCopy, debounce, safeURL } from "./util.js";
import * as db from "./database.js";
import * as C from "./collections.js";
import * as media from "./media-store.js";
import * as L from "./channels.js";
import { GENERAL, ADULT, XFREE } from "./providers/registry.js";
import { ProviderError, normalise } from "./providers/provider-base.js";
import { setRoot, sheet, toast, confirmBox, ask, searchField } from "./ui.js";
import { loadAPI as loadYT } from "./youtube.js";
import { channelRow, addSourceSheet } from "./live.js";
import { addDirectVideo } from "./providers/json-feed.js";

const session = new Map();       // provider|tab|query → {items, page, hasMore, index}  (this tab only)
let soundOn = false;             // remembered for the session after the user unmutes

export function initDiscover() {
  setRoot("discover", {
    bareRoot: true,
    build(content, view) {
      view.classList.add("discover-view");
      let section = "general", pid = db.setting("discover.provider") || "local", feed = null;
      const top = h(`<div class="feed-top"><div class="chips feed-sections"></div><div class="chips feed-tabs"></div></div>`);
      const stage = h(`<div class="feed-stage"></div>`);
      content.append(stage, top);

      function sections() {
        const adultOn = db.setting("content.adult");
        const secs = top.querySelector(".feed-sections");
        const btns = [...GENERAL.map(p => [p.id, p.name, "general"]), ["adult", "Adult", "adult"]];
        secs.replaceChildren(...btns.map(([id, label, sec]) => {
          const on2 = sec === "adult" ? section === "adult" : section === "general" && pid === id;
          const b = h(`<button class="chip${on2 ? " on" : ""}${sec === "adult" ? " adult-chip" : ""}">${esc(label)}</button>`);
          b.onclick = () => {
            if (sec === "adult") { section = "adult"; pid = pid && ADULT.some(p => p.id === pid) ? pid : "eporner"; }
            else { section = "general"; pid = id; db.setSetting("discover.provider", id); }
            sections(); open();
          };
          return b;
        }));
        if (section === "adult" && !adultOn) return;
        if (section === "adult") {
          const sub = h(`<div class="chips feed-sub"></div>`);
          for (const [id, label] of [["eporner", "Eporner"], ["streams", "My Streams"], ["xfree", "Xfree"]]) {
            const b = h(`<button class="chip${pid === id ? " on" : ""}">${label}</button>`);
            b.onclick = () => { pid = id; sections(); open(); };
            sub.append(b);
          }
          secs.append(sub);
        }
      }
      function open() {
        feed?.destroy(); feed = null;
        const tabs = top.querySelector(".feed-tabs"); tabs.replaceChildren();
        if (section === "adult" && !db.setting("content.adult")) {
          stage.replaceChildren(msgCard("Adult content off", "Adult Discover is currently disabled.", [["Settings", () => { location.hash = "#/settings"; emit("settings-section", "content"); }]]));
          return;
        }
        if (section === "adult" && pid === "streams") return adultStreams(stage, tabs);
        if (section === "adult" && pid === "xfree") {
          stage.replaceChildren(msgCard("Xfree", "LunaTV doesn’t scrape websites. Xfree will appear here as a native feed only if it offers a supported public API or embed. Until then you can open it directly.", [["Open Xfree", () => window.open(XFREE.url, "_blank", "noopener")]]));
          return;
        }
        const prov = [...GENERAL, ...ADULT].find(p => p.id === pid) || GENERAL[0];
        let tab = prov.tabs[0].id, query = "";
        const drawTabs = () => {
          tabs.replaceChildren(...prov.tabs.map(t => { const b = h(`<button class="chip${t.id === tab ? " on" : ""}">${esc(t.label)}</button>`); b.onclick = () => { tab = t.id; query = ""; drawTabs(); start(); }; return b; }));
          if (prov.search) { const s = h(`<button class="chip${query ? " on" : ""}" aria-label="Search ${esc(prov.name)}">${icon("search")} ${query ? esc(query) : "Search"}</button>`); s.onclick = async () => { const q = await ask({ title: `Search ${prov.name}`, value: query, ok: "Search" }); if (q != null) { query = q.trim(); drawTabs(); start(); } }; tabs.append(s); }
          if (prov.id === "direct") { const a = h(`<button class="chip">${icon("plus")} Add Video URL</button>`); a.onclick = async () => { const u = await ask({ title: "Video URL", placeholder: "https://…/clip.mp4", type: "url", ok: "Add" }); if (u && safeURL(u)) { await addDirectVideo(u, new URL(u).pathname.split("/").pop() || "Video"); start(); } else if (u) toast("Enter a full https:// address.", { err: true }); }; tabs.append(a); }
        };
        const start = () => { feed?.destroy(); feed = new Feed(stage, prov, { tab, query, adult: section === "adult" }); };
        drawTabs(); start();
      }
      sections(); open();
      on("settings-changed", k => { if (k === "content.adult") { sections(); open(); } });
      return {
        hidden: () => feed?.pauseAll(),
        shown: () => { if (!feed && !stage.children.length) open(); feed?.resume(); },
        destroy: () => feed?.destroy(),
      };
    },
  });
}

function msgCard(title, text, buttons = []) {
  const el = h(`<div class="feed-msg"><div class="glass fm-box"><img src="assets/branding/lunatv-crescent.webp" alt="" class="empty-mark"><b>${esc(title)}</b><p>${esc(text)}</p><div class="btn-row"></div></div></div>`);
  buttons.forEach(([l, fn], i) => { const b = h(`<button class="btn ${i ? "" : "blue"}">${esc(l)}</button>`); b.onclick = fn; el.querySelector(".btn-row").append(b); });
  return el;
}

// Adult live streams imported by the user (M3U/direct) — kept out of Live TV.
function adultStreams(stage, tabs) {
  const add = h(`<button class="chip">${icon("plus")} Add Adult Source</button>`);
  add.onclick = () => addSourceSheet({ adult: true });
  tabs.replaceChildren(add);
  const box = h(`<div class="feed-list"></div>`);
  const render = () => {
    const list = L.channels({ adult: true });
    if (!list.length) { box.replaceChildren(msgCard("No adult streams", "Add an M3U playlist or direct stream. It stays inside Discover › Adult.", [["Add Source", () => addSourceSheet({ adult: true })]])); return; }
    const l = h(`<div class="list glass"></div>`);
    list.slice(0, 500).forEach(c => l.append(channelRow(c, list, { adult: true })));
    box.replaceChildren(l);
  };
  stage.replaceChildren(box); render();
  on("live-changed", () => { if (box.isConnected) render(); });
}

// ------------------------------------------------------------------ the feed
class Feed {
  constructor(stage, prov, { tab, query, adult }) {
    Object.assign(this, { stage, prov, tab, query, adult });
    this.key = `${prov.id}|${tab}|${query}`;
    const s = session.get(this.key);
    this.items = s?.items || []; this.page = s?.page || 0; this.hasMore = s?.hasMore ?? true; this.index = db.setting("discover.resume") ? s?.index || 0 : 0;
    this.seen = new Set(this.items.map(i => i.id)); this.loading = false; this.error = null; this.ctl = null; this.players = new Map();
    this.el = h(`<div class="feed" role="feed" aria-label="${esc(prov.name)} feed" tabindex="0"></div>`);
    stage.replaceChildren(this.el);
    this.io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && e.intersectionRatio > 0.6) this.activate(+e.target.dataset.i); }, { root: this.el, threshold: [0.6] });
    this.el.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); this.go(1); } if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); this.go(-1); } });
    if (this.items.length) { this.items.forEach((it, i) => this.el.append(this.card(it, i))); requestAnimationFrame(() => { this.el.children[this.index]?.scrollIntoView({ block: "start" }); }); }
    else this.more();
  }
  save() { session.set(this.key, { items: this.items, page: this.page, hasMore: this.hasMore, index: this.index }); }
  go(d) { const n = this.el.children[this.index + d]; n?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  async more() {
    if (this.loading || !this.hasMore) return;
    this.loading = true; this.ctl?.abort(); this.ctl = new AbortController();
    const spin = h(`<div class="feed-loading"><span class="spinner luna-spin"></span></div>`);
    this.el.append(spin);
    try {
      const r = await this.prov.page({ tab: this.tab, query: this.query, page: this.page + 1, signal: this.ctl.signal, adult: this.adult });
      this.page++; this.hasMore = !!r.hasMore;
      const fresh = r.items.map(x => normaliseItem(this.prov.id, x, this.adult)).filter(x => !this.seen.has(x.id));
      fresh.forEach(x => this.seen.add(x.id));
      const start = this.items.length;
      this.items.push(...fresh);
      spin.remove();
      fresh.forEach((it, j) => this.el.append(this.card(it, start + j)));
      if (!this.items.length) this.el.append(msgCard("Nothing here yet", this.prov.id === "local" ? "Open a video to begin building your LunaTV library." : "This feed returned no results.", this.prov.id === "local" ? [["Open Video", () => emit("open-media")]] : []));
      if (!fresh.length && this.hasMore) { this.loading = false; return this.more(); }
      this.save();
    } catch (e) {
      spin.remove();
      if (e.name === "AbortError") return;
      const msg = e instanceof ProviderError ? e.message : `LunaTV couldn’t reach ${this.prov.name} right now.`;
      const card = msgCard("Provider unavailable", msg, (e.retry ?? true) ? [["Retry", () => { card.remove(); this.more(); }]] : []);
      card.classList.add("fcard"); this.el.append(card);
    } finally { this.loading = false; }
  }
  card(it, i) {
    const fav = C.isFavorite("feed", it.id, it.adult);
    const el = h(`<article class="fcard" data-i="${i}" aria-label="${esc(it.title)}">
      <div class="fc-media">${it.thumbnail ? `<img class="fc-thumb" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(it.thumbnail)}">` : `<div class="lunafall fc-thumb"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""></div>`}</div>
      <div class="fc-shade"></div>
      <div class="fc-badge">${it.adult ? `<span class="adult-tag">ADULT</span>` : ""}<span>${esc(this.prov.name.toUpperCase())}</span></div>
      <div class="fc-info"><b>${esc(it.title)}</b><span>${[it.creator, it.duration ? fmtDur(it.duration) : "", it.views ? `${compact(it.views)} views` : ""].filter(Boolean).map(esc).join(" · ")}</span></div>
      <div class="fc-side">
        <button class="fc-btn${fav ? " on" : ""}" data-a="fav" aria-label="Favorite">${icon(fav ? "heartFill" : "heart")}</button>
        <button class="fc-btn" data-a="mute" aria-label="Sound" hidden>${icon(soundOn ? "volume" : "mute")}</button>
        <button class="fc-btn" data-a="share" aria-label="Share">${icon("share")}</button>
        ${it.sourceUrl ? `<a class="fc-btn" data-a="src" href="${esc(it.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open source">${icon("external")}</a>` : ""}
        <button class="fc-btn" data-a="more" aria-label="More">${icon("more")}</button>
        <button class="fc-btn" data-a="full" aria-label="Fullscreen">${icon("expand")}</button>
      </div>
      <div class="fc-play" hidden>${icon("play")}</div>
      <div class="fc-heart" aria-hidden="true">${icon("heartFill")}</div>
    </article>`);
    el.querySelector(".fc-thumb")?.addEventListener("error", e => e.target.replaceWith(h(`<div class="lunafall fc-thumb"><img class="lf-mark" src="assets/branding/lunatv-crescent.webp" alt=""></div>`)));
    el.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "fav") this.fav(it, el);
      else if (a === "mute") this.toggleSound(el);
      else if (a === "share") shareOrCopy({ title: it.title, url: it.sourceUrl || (it.ytId ? `https://www.youtube.com/watch?v=${it.ytId}` : "") }).then(r => { if (r === "copied") toast("Link copied"); if (r === "failed") toast("Nothing to share for this item.", { err: true }); });
      else if (a === "more") this.moreMenu(it, el);
      else if (a === "full") { const m = el.querySelector(".fc-media"); (m.requestFullscreen?.() || m.webkitRequestFullscreen?.() || m.querySelector("video")?.webkitEnterFullscreen?.())?.catch?.(() => {}); }
    });
    // tap = play/pause (direct video), double tap = favorite, press & hold = pause
    let lastTap = 0, holdT = null, held = false;
    const surface = el.querySelector(".fc-media");
    surface.addEventListener("pointerdown", () => { held = false; holdT = setTimeout(() => { const v = el.querySelector("video"); if (v && !v.paused) { v.pause(); held = true; } }, 350); });
    surface.addEventListener("pointerup", () => {
      clearTimeout(holdT);
      const v = el.querySelector("video");
      if (held) { v?.play().catch(() => {}); held = false; return; }
      const now = Date.now();
      if (now - lastTap < 280) { lastTap = 0; clearTimeout(this.tapT); if (!C.isFavorite("feed", it.id, it.adult)) this.fav(it, el); else pulse(el); return; }
      lastTap = now;
      clearTimeout(this.tapT);
      this.tapT = setTimeout(() => { if (v) { if (v.paused) v.play().catch(() => {}); else v.pause(); el.querySelector(".fc-play").hidden = !v.paused; } }, 280);
    });
    surface.addEventListener("pointercancel", () => clearTimeout(holdT));
    this.io.observe(el);
    return el;
  }
  async fav(it, el) {
    const on2 = await C.toggleFavorite({ type: "feed", ref: it.id, title: it.title, adult: it.adult, snapshot: { ...it, videoUrl: it.kind === "local" ? "" : it.videoUrl } });
    const b = el.querySelector("[data-a=fav]"); b.classList.toggle("on", on2); b.innerHTML = icon(on2 ? "heartFill" : "heart");
    if (on2) pulse(el);
    toast(on2 ? "Added to Favorites" : "Removed from Favorites");
  }
  moreMenu(it, el) {
    sheet({ title: it.title, subtitle: this.prov.name, groups: [[
      it.sourceUrl && { icon: "external", label: `Open in ${this.prov.id === "eporner" ? "Eporner" : this.prov.id === "youtube" ? "YouTube" : "Source"}`, run: () => window.open(it.sourceUrl, "_blank", "noopener,noreferrer") },
      it.sourceUrl && { icon: "copy", label: "Copy Link", run: async () => { try { await navigator.clipboard.writeText(it.sourceUrl); toast("Link copied"); } catch { toast("Couldn’t copy", { err: true }); } } },
      { icon: "next", label: "Skip — Video Unavailable", run: () => { el.classList.add("dead"); this.go(1); } },
    ]] });
  }
  toggleSound(el) {
    soundOn = !soundOn;
    const v = el.querySelector("video"); if (v) { v.muted = !soundOn; if (soundOn) v.volume = 1; }
    el.querySelector("[data-a=mute]").innerHTML = icon(soundOn ? "volume" : "mute");
  }
  activate(i) {
    if (i === this.active) return;
    this.active = i; this.index = i; this.save();
    // keep previous / active / next; destroy the rest
    for (const [k] of this.players) if (Math.abs(k - i) > 1) this.unmount(k);
    for (const k of [i - 1, i + 1]) if (this.items[k] && this.items[k].kind !== "embed" && this.items[k].kind !== "youtube") this.mount(k, false);
    this.mount(i, true);
    for (const [k, p] of this.players) if (k !== i) p.pause?.();
    if (this.items.length - i <= 5) this.more();
    clearTimeout(this.histT);
    const it = this.items[i];
    if (it) this.histT = setTimeout(() => C.recordHistory({ type: "feed", ref: it.id, title: it.title, adult: it.adult, snapshot: { id: it.id, title: it.title, thumbnail: it.thumbnail, sourceUrl: it.sourceUrl, provider: it.provider } }), 3000);
  }
  async mount(i, activeNow) {
    const it = this.items[i], el = this.el.children[i];
    if (!it || !el || el.classList.contains("dead")) return;
    let p = this.players.get(i);
    if (!p) {
      const box = el.querySelector(".fc-media");
      if (it.kind === "local" || it.kind === "video") {
        const url = it.kind === "local" ? await media.fileURL(it.localId) : it.videoUrl;
        if (!url) { this.unavailable(el, it); return; }
        const v = h(`<video playsinline webkit-playsinline loop preload="${activeNow ? "auto" : "metadata"}" muted></video>`);
        v.src = url; v.muted = !soundOn;
        v.addEventListener("error", () => this.unavailable(el, it));
        v.addEventListener("playing", () => { el.querySelector(".fc-play").hidden = true; box.querySelector(".fc-thumb")?.classList.add("gone"); });
        box.append(v);
        el.querySelector("[data-a=mute]").hidden = false;
        p = { el: v, pause: () => v.pause(), play: () => { v.muted = !soundOn; return v.play().catch(() => { el.querySelector(".fc-play").hidden = false; }); }, destroy: () => { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); if (it.kind === "local") URL.revokeObjectURL(url); } };
      } else if (it.kind === "youtube") {
        const host = h(`<div class="fc-frame"><div></div></div>`); box.append(host);
        let player = null, dead = false;
        loadYT().then(YT => {
          if (dead) return;
          player = new YT.Player(host.firstElementChild, { videoId: it.ytId, host: "https://www.youtube.com", playerVars: { autoplay: 1, mute: soundOn ? 0 : 1, playsinline: 1, rel: 0, loop: 1, playlist: it.ytId, origin: location.origin },
            events: { onError: () => this.unavailable(el, it), onReady: () => box.querySelector(".fc-thumb")?.classList.add("gone") } });
        }).catch(() => this.unavailable(el, it, "YouTube couldn’t be reached."));
        p = { pause: () => player?.pauseVideo?.(), play: () => player?.playVideo?.(), destroy: () => { dead = true; try { player?.destroy(); } catch {} host.remove(); } };
      } else if (it.kind === "embed" && it.embedUrl) {
        // Official provider embed. LunaTV can't control what's inside it, so no fake controls.
        const f = h(`<iframe class="fc-frame" title="${esc(it.title)}" src="${esc(it.embedUrl)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="eager"></iframe>`);
        f.addEventListener("load", () => box.querySelector(".fc-thumb")?.classList.add("gone"));
        box.append(f);
        p = { pause: () => {}, play: () => {}, destroy: () => { f.src = "about:blank"; f.remove(); } };
      } else { this.unavailable(el, it); return; }
      this.players.set(i, p);
    }
    if (activeNow) p.play?.();
  }
  unmount(i) { const p = this.players.get(i); if (!p) return; p.destroy(); this.players.delete(i); const el = this.el.children[i]; el?.querySelector(".fc-thumb")?.classList.remove("gone"); }
  unavailable(el, it, why = "") {
    if (el.querySelector(".fc-dead")) return;
    const d = h(`<div class="fc-dead glass"><b>Video unavailable</b>${why ? `<p>${esc(why)}</p>` : ""}<div class="btn-row"><button class="btn blue">Next</button>${it.sourceUrl ? `<a class="btn" href="${esc(it.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open Source</a>` : ""}</div></div>`);
    d.querySelector("button").onclick = () => this.go(1);
    el.append(d); el.classList.add("dead");
  }
  pauseAll() { for (const [, p] of this.players) p.pause?.(); }
  resume() { this.players.get(this.active)?.play?.(); }
  destroy() { this.ctl?.abort(); this.io.disconnect(); clearTimeout(this.histT); for (const k of [...this.players.keys()]) this.unmount(k); this.save(); }
}
function normaliseItem(pid, x, adult) { const n = normalise(pid, x); n.adult = adult || n.adult; return n; }
function pulse(el) { const hh = el.querySelector(".fc-heart"); hh.classList.remove("go"); void hh.offsetWidth; hh.classList.add("go"); }
const compact = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);
