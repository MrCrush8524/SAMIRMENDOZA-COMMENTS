// YouTube: paste any watch / youtu.be / Shorts / playlist link and it plays in
// YouTube's official IFrame player. No LunaTV login, no Google sign-in, no
// stream extraction. When YouTube refuses to embed a video, LunaTV says so and
// offers "Open in YouTube". History here is LunaTV's own, not YouTube's.
import { h, esc, icon, on, emit, safeURL } from "./util.js";
import * as db from "./database.js";
import { recordHistory, isFavorite, toggleFavorite } from "./collections.js";
import { ask, toast, onBack } from "./ui.js";
import { setYouTubeHandler } from "./player.js";

const ID = /^[A-Za-z0-9_-]{11}$/;
/** → { video, playlist, start, shorts } or null */
export function parseYouTube(input) {
  let u;
  try { u = new URL(String(input).trim().replace(/^(?!https?:)/i, "https://")); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let video = "", shorts = false;
  if (host === "youtu.be") video = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const p = u.pathname.split("/").filter(Boolean);
    if (p[0] === "watch") video = u.searchParams.get("v") || "";
    else if (p[0] === "shorts" || p[0] === "embed" || p[0] === "live" || p[0] === "v") { video = p[1] || ""; shorts = p[0] === "shorts"; }
  } else return null;
  const playlist = u.searchParams.get("list") || "";
  const t = u.searchParams.get("t") || u.searchParams.get("start") || "";
  const start = /^\d+$/.test(t) ? +t : (t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/) || []).slice(1).reduce((a, x, i) => a + (+x || 0) * [3600, 60, 1][i], 0);
  if (video && !ID.test(video)) video = "";
  if (!video && !/^[A-Za-z0-9_-]{10,}$/.test(playlist)) return null;
  return { video, playlist, start: start || 0, shorts };
}
export const watchURL = (id, list) => list && !id ? `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${list ? `&list=${encodeURIComponent(list)}` : ""}`;
export const thumb = id => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

// ------------------------------------------------------------------ IFrame API
let apiP = null;
export function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return apiP ||= new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => { apiP = null; rej(new Error("YouTube couldn’t be reached.")); };
    document.head.append(s);
    setTimeout(() => { if (!window.YT?.Player) { apiP = null; rej(new Error("YouTube couldn’t be reached.")); } }, 15000);
  });
}
export const ERRORS = {
  2: ["Link not recognised", "YouTube says this video ID isn’t valid."],
  5: ["Playback not available in LunaTV", "YouTube’s player hit an error on this device."],
  100: ["Video unavailable", "This video was removed or made private."],
  101: ["Playback not available in LunaTV", "The owner doesn’t allow this video to play outside YouTube, or YouTube requires you to sign in or confirm your age."],
  150: ["Playback not available in LunaTV", "The owner doesn’t allow this video to play outside YouTube, or YouTube requires you to sign in or confirm your age."],
  153: ["Playback not available in LunaTV", "YouTube needs this page’s address to allow playback. Opening it in YouTube will work."],
};

// ------------------------------------------------------------------ overlay player
let O = null, yt = null, cur = null, pushed = false, endedCb = null;
function build() {
  O = h(`<div class="ytp" role="dialog" aria-label="YouTube player">
    <div class="ytp-bar"><button class="pbtn" data-a="close" aria-label="Close YouTube">${icon("close")}</button><div class="ttl"></div>
      <button class="pbtn" data-a="fav" aria-label="Favorite">${icon("heart")}</button>
      <a class="pbtn" data-a="open" target="_blank" rel="noopener" aria-label="Open in YouTube">${icon("external")}</a></div>
    <div class="ytp-stage"><div id="ytp-host"></div></div>
    <div class="ytp-msg glass" hidden><b></b><p></p><div class="btn-row"><a class="btn blue" target="_blank" rel="noopener">Open in YouTube</a><button class="btn" data-a="close2">Close</button></div></div>
    <div class="ytp-note">Played by YouTube’s official player. LunaTV’s frame capture, speed and subtitle tools don’t apply here.</div></div>`);
  document.body.append(O);
  O.addEventListener("click", e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "close" || a === "close2") requestClose();
    if (a === "fav" && cur) toggleFavorite({ type: "youtube", ref: cur.id || `list:${cur.playlist}`, title: cur.title, snapshot: { id: cur.id, title: cur.title, thumb: cur.id ? thumb(cur.id) : "", playlist: cur.playlist } }).then(onF => { favIcon(); toast(onF ? "Added to Favorites" : "Removed from Favorites"); });
  });
  onBack(() => { if (!O.classList.contains("show")) return false; close(); return true; });
}
function favIcon() { const on2 = cur && isFavorite("youtube", cur.id || `list:${cur.playlist}`); O.querySelector("[data-a=fav]").innerHTML = icon(on2 ? "heartFill" : "heart"); }
function message(code) {
  const [t, d] = ERRORS[code] || ERRORS[5];
  const m = O.querySelector(".ytp-msg");
  m.querySelector("b").textContent = t; m.querySelector("p").textContent = d;
  m.querySelector("a").href = watchURL(cur.id, cur.playlist);
  m.hidden = false;
}

/** item: { id, playlist?, title?, start? }  opts: { onEnded } */
export async function openYouTube(item, { onEnded } = {}) {
  if (!O) build();
  cur = { ...item, title: item.title || "YouTube" }; endedCb = onEnded || null;
  O.querySelector(".ttl").textContent = cur.title;
  O.querySelector("[data-a=open]").href = watchURL(cur.id, cur.playlist);
  O.querySelector(".ytp-msg").hidden = true;
  O.classList.add("show"); document.body.classList.add("player-open");
  favIcon();
  if (!pushed) { try { history.pushState({ lunatvYT: 1 }, "", location.hash); pushed = true; } catch {} }
  const host = O.querySelector(".ytp-stage");
  host.innerHTML = `<div id="ytp-host"></div>`;
  record();
  let YT;
  try { YT = await loadAPI(); }
  catch {
    // Official embed without the JS API: still YouTube's own player, just no events.
    const src = cur.id ? `https://www.youtube.com/embed/${encodeURIComponent(cur.id)}?autoplay=1&playsinline=1&rel=0${cur.playlist ? `&list=${encodeURIComponent(cur.playlist)}` : ""}` : `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(cur.playlist)}`;
    host.innerHTML = `<iframe title="YouTube video player" src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    return;
  }
  yt?.destroy?.();
  const vars = { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin, ...(cur.start ? { start: cur.start } : {}), ...(cur.playlist ? { listType: "playlist", list: cur.playlist } : {}) };
  yt = new YT.Player("ytp-host", {
    ...(cur.id ? { videoId: cur.id } : {}), playerVars: vars, host: "https://www.youtube.com",
    events: {
      onReady: e => { const d = e.target.getVideoData?.(); if (d?.title) { cur.title = d.title; if (d.video_id) cur.id = d.video_id; O.querySelector(".ttl").textContent = d.title; record(); } },
      onStateChange: e => { if (e.data === YT.PlayerState.ENDED && !cur.playlist) endedCb?.(); if (e.data === YT.PlayerState.PLAYING) { const d = yt.getVideoData?.(); if (d?.title && d.title !== cur.title) { cur.title = d.title; cur.id = d.video_id || cur.id; O.querySelector(".ttl").textContent = d.title; record(); } } },
      onError: e => message(e.data),
    },
  });
}
function record() {
  if (!cur?.id) return;
  recordHistory({ type: "youtube", ref: cur.id, title: cur.title, snapshot: { id: cur.id, title: cur.title, thumb: thumb(cur.id), playlist: cur.playlist || "" } });
}
function requestClose() { if (pushed && history.state?.lunatvYT) history.back(); else close(); }
function close() {
  try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
  yt = null;
  if (O) { O.querySelector(".ytp-stage").innerHTML = ""; O.classList.remove("show"); }
  document.body.classList.remove("player-open");
  pushed = false; cur = null; endedCb = null;
  emit("history-changed");
}

export async function openYouTubeLink() {
  const u = await ask({ title: "YouTube link", message: "Paste a watch, youtu.be, Shorts or playlist link.", placeholder: "https://youtu.be/…", type: "url", ok: "Play" });
  if (!u) return;
  const y = parseYouTube(u);
  if (!y) { toast("That isn’t a YouTube link LunaTV can read.", { err: true }); return; }
  openYouTube({ id: y.video, playlist: y.playlist, start: y.start });
}

// Optional: search with the user's own YouTube Data API key (Settings › Providers).
export const canSearch = () => !!(db.setting("providers.youtubeKey") || "").trim();
export async function searchYouTube(q, { shorts = false, pageToken = "" } = {}) {
  const key = (db.setting("providers.youtubeKey") || "").trim();
  if (!key) throw new Error("Add a YouTube Data API key in Settings › Content › Providers to search.");
  const p = new URLSearchParams({ part: "snippet", type: "video", maxResults: "20", q, key, videoEmbeddable: "true", safeSearch: "moderate", ...(shorts ? { videoDuration: "short" } : {}), ...(pageToken ? { pageToken } : {}) });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.errors?.[0]?.reason === "quotaExceeded" ? "Today’s YouTube search quota for your key is used up." : d.error?.message || `YouTube answered HTTP ${r.status}.`);
  const dec = s => { const t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value; };
  return { items: (d.items || []).filter(x => x.id?.videoId).map(x => ({ id: x.id.videoId, title: dec(x.snippet.title), creator: dec(x.snippet.channelTitle), thumb: x.snippet.thumbnails?.high?.url || thumb(x.id.videoId) })), next: d.nextPageToken || "" };
}

export function ytCard(s) {
  const t = safeURL(s.thumb || (s.id ? thumb(s.id) : ""));
  const b = h(`<button class="yt-card glass">${t ? `<img loading="lazy" alt="" src="${esc(t)}">` : ""}<div><b>${esc(s.title || "YouTube video")}</b><small>${esc(s.creator || "YouTube")}</small></div></button>`);
  b.querySelector("img")?.addEventListener("error", e => e.target.remove());
  b.onclick = () => openYouTube({ id: s.id, playlist: s.playlist, title: s.title });
  return b;
}

setYouTubeHandler((entry, opts) => openYouTube({ id: entry.id, title: entry.title }, opts));
on("open-youtube-link", openYouTubeLink);
