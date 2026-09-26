// YouTube: paste any watch / youtu.be / Shorts / playlist link and it plays in
// YouTube's official IFrame player. No LunaTV login, no Google sign-in, no
// stream extraction. When YouTube refuses to embed a video, LunaTV says so and
// offers "Open in YouTube". History here is LunaTV's own, not YouTube's.
import { tr, trn } from "./i18n.js";
import { h, esc, icon, on, emit, safeURL } from "./util.js";
import * as db from "./database.js";
import { recordHistory, isFavorite, toggleFavorite } from "./collections.js";
import { ask, toast, onBack, setRoot } from "./ui.js";
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
    s.onerror = () => { apiP = null; rej(new Error(tr("YouTube couldn’t be reached."))); };
    document.head.append(s);
    setTimeout(() => { if (!window.YT?.Player) { apiP = null; rej(new Error(tr("YouTube couldn’t be reached."))); } }, 15000);
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
  O = h(`<div class="ytp" role="dialog" aria-label="${tr("YouTube player")}">
    <div class="ytp-bar"><button class="pbtn" data-a="close" aria-label="${tr("Close YouTube")}">${icon("close")}</button><div class="ttl"></div>
      <button class="pbtn" data-a="fav" aria-label="${tr("Favorite")}">${icon("heart")}</button>
      <a class="pbtn" data-a="open" target="_blank" rel="noopener" aria-label="${tr("Open in YouTube")}">${icon("external")}</a></div>
    <div class="ytp-stage"><div id="ytp-host"></div></div>
    <div class="ytp-msg glass" hidden><b></b><p></p><div class="btn-row"><a class="btn blue" target="_blank" rel="noopener">${tr("Open in YouTube")}</a><button class="btn" data-a="close2">${tr("Close")}</button></div></div>
    <div class="ytp-note">${tr("Played by YouTube’s official player. LunaTV’s frame capture, speed and subtitle tools don’t apply here.")}</div></div>`);
  document.body.append(O);
  O.addEventListener("click", e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "close" || a === "close2") requestClose();
    if (a === "fav" && cur) toggleFavorite({ type: "youtube", ref: cur.id || `list:${cur.playlist}`, title: cur.title, snapshot: { id: cur.id, title: cur.title, thumb: cur.id ? thumb(cur.id) : "", playlist: cur.playlist } }).then(onF => { favIcon(); toast(onF ? tr("Added to Favorites") : tr("Removed from Favorites")); });
  });
  onBack(() => { if (!O.classList.contains("show")) return false; close(); return true; });
}
function favIcon() { const on2 = cur && isFavorite("youtube", cur.id || `list:${cur.playlist}`); O.querySelector("[data-a=fav]").innerHTML = icon(on2 ? "heartFill" : "heart"); }
function message(code) {
  const [t, d] = (ERRORS[code] || ERRORS[5]).map(x => tr(x));
  const m = O.querySelector(".ytp-msg");
  m.querySelector("b").textContent = t; m.querySelector("p").textContent = d;
  m.querySelector("a").href = watchURL(cur.id, cur.playlist);
  m.hidden = false;
}

/** item: { id, playlist?, title?, start? }  opts: { onEnded } */
export async function openYouTube(item, { onEnded } = {}) {
  if (!O) build();
  cur = { ...item, title: item.title || tr("YouTube") }; endedCb = onEnded || null;
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
    host.innerHTML = `<iframe title="${tr("YouTube video player")}" src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
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
  const u = await ask({ title: tr("YouTube link"), message: tr("Paste a watch, youtu.be, Shorts or playlist link."), placeholder: "https://youtu.be/…", type: "url", ok: tr("Play") });
  if (!u) return;
  const y = parseYouTube(u);
  if (!y) { toast(tr("That isn’t a YouTube link LunaTV can read."), { err: true }); return; }
  openYouTube({ id: y.video, playlist: y.playlist, start: y.start });
}

// ------------------------------------------------------------------ Google sign-in (optional)
// Playing a pasted link never needs an account. Signing in with Google only
// unlocks YouTube Data API features (search, Shorts, your liked videos and
// playlists). Uses Google Identity Services with LunaTV's OAuth web client —
// no client secret in the browser. The access token lives in memory only and
// is dropped on sign-out, expiry or reload.
export const GOOGLE_CLIENT_ID = "377117992546-tguolq0bqjvrog0s46f2kr50nchhfekn.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const auth = { token: null, expires: 0, client: null, pending: null, gis: null };
export const signedIn = () => !!auth.token && Date.now() < auth.expires;
export const canSearch = signedIn;
function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return auth.gis ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => res(); s.onerror = () => { auth.gis = null; rej(new Error(tr("Couldn’t reach Google sign-in. Check your connection or content blocker."))); };
    document.head.append(s);
  });
}
/** Opens Google's consent popup (or silently refreshes). Resolves true when signed in. */
export async function signIn({ silent = false } = {}) {
  await loadGIS();
  return new Promise((res, rej) => {
    auth.client ||= google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SCOPE, callback: () => {} });
    auth.client.callback = r => {
      if (r.error) { rej(new Error(r.error_description || r.error)); return; }
      auth.token = r.access_token; auth.expires = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
      emit("youtube-auth"); res(true);
    };
    auth.client.error_callback = e => rej(new Error(e?.type === "popup_closed" ? tr("Sign-in was cancelled.") : e?.type === "popup_failed_to_open" ? tr("The sign-in window was blocked. Allow pop-ups for this site and try again.") : tr("Google sign-in didn’t complete.")));
    auth.client.requestAccessToken({ prompt: silent ? "" : (auth.token ? "" : "consent") });
  });
}
export function signOut() {
  if (auth.token) try { google.accounts.oauth2.revoke(auth.token, () => {}); } catch {}
  auth.token = null; auth.expires = 0; emit("youtube-auth");
}
/** Authenticated YouTube Data API v3 GET with the OAuth access token. */
async function api(path, params) {
  if (!signedIn()) {
    if (auth.token) { try { await signIn({ silent: true }); } catch { auth.token = null; emit("youtube-auth"); } }
    if (!signedIn()) throw new Error(tr("Sign in with Google on the YouTube tab to use search, Shorts, liked videos and playlists."));
  }
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${auth.token}` } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { auth.token = null; emit("youtube-auth"); throw new Error(tr("Your Google session ended. Sign in again on the YouTube tab.")); }
  if (!r.ok) {
    const reason = d.error?.errors?.[0]?.reason;
    throw new Error(reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? tr("LunaTV has used today’s YouTube search allowance. Try again tomorrow.") : d.error?.message || tr("YouTube answered HTTP {p0}.", { p0: r.status }));
  }
  return d;
}
const dec = s => { const t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value; };
const vItem = (id, sn) => ({ id, title: dec(sn.title), creator: dec(sn.videoOwnerChannelTitle || sn.channelTitle), thumb: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || thumb(id) });
export async function searchYouTube(q, { shorts = false, pageToken = "" } = {}) {
  const d = await api("search", { part: "snippet", type: "video", maxResults: "20", q, videoEmbeddable: "true", safeSearch: "moderate", ...(shorts ? { videoDuration: "short" } : {}), ...(pageToken ? { pageToken } : {}) });
  return { items: (d.items || []).filter(x => x.id?.videoId).map(x => vItem(x.id.videoId, x.snippet)), next: d.nextPageToken || "" };
}
export async function likedVideos() {
  const d = await api("videos", { part: "snippet", myRating: "like", maxResults: "24" });
  return (d.items || []).map(x => vItem(x.id, x.snippet));
}
export async function myPlaylists() {
  const d = await api("playlists", { part: "snippet,contentDetails", mine: "true", maxResults: "24" });
  return (d.items || []).map(x => ({ playlist: x.id, title: dec(x.snippet.title), creator: `${x.contentDetails?.itemCount ?? ""} videos`, thumb: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url || "" }));
}

export function ytCard(s) {
  const t = safeURL(s.thumb || (s.id ? thumb(s.id) : ""));
  const b = h(`<button class="yt-card glass">${t ? `<img loading="lazy" alt="" src="${esc(t)}">` : ""}<div><b>${esc(s.title || tr("YouTube video"))}</b><small>${esc(s.creator || tr("YouTube"))}</small></div></button>`);
  b.querySelector("img")?.addEventListener("error", e => e.target.remove());
  b.onclick = () => openYouTube({ id: s.id, playlist: s.playlist, title: s.title });
  return b;
}

setYouTubeHandler((entry, opts) => openYouTube({ id: entry.id, title: entry.title }, opts));

// ------------------------------------------------------------------ YouTube tab
export function initYouTubeArea() {
  setRoot("youtube", {
    build(content) {
      const acct = h(`<div class="list glass yt-acct"><div class="row static"><span class="ic">${icon("youtube")}</span><span class="label"></span><button class="btn sm"></button></div></div>`);
      const actions = h(`<div class="btn-row" style="margin-top:12px"><button class="btn blue">${icon("link")}${tr("Paste YouTube Link")}</button><button class="btn">${icon("compass")}${tr("Shorts in Discover")}</button></div>`);
      const form = h(`<form class="btn-row yt-search" role="search"><label class="field" style="flex:1">${icon("search")}<input type="search" enterkeyhint="search" placeholder="${tr("Search YouTube")}" aria-label="${tr("Search YouTube")}"></label><button class="btn">${tr("Search")}</button></form>`);
      const note = h(`<p class="note"></p>`), results = h(`<div class="grid yt-grid"></div>`), rails = h(`<div></div>`);
      content.append(h(`<h1 class="page-title">${tr("YouTube")}</h1>`), acct, actions, form, note, results, rails);
      const [pasteB, shortsB] = actions.querySelectorAll("button");
      pasteB.onclick = openYouTubeLink;
      shortsB.onclick = () => { db.setSetting("discover.provider", "youtube"); location.hash = "#/discover"; };
      const drawAcct = () => {
        const ok2 = signedIn(), b = acct.querySelector("button");
        acct.querySelector(".label").innerHTML = ok2 ? `${tr("Signed in with Google")}<span class="sub">${tr("Search, Shorts, liked videos and your playlists")}</span>` : `${tr("Not signed in")}<span class="sub">${tr("Pasted links play without an account. Sign in to search and see your likes and playlists.")}</span>`;
        b.textContent = ok2 ? tr("Sign Out") : tr("Sign in with Google");
        b.classList.toggle("blue", !ok2);
        b.onclick = async () => { if (signedIn()) signOut(); else { try { await signIn(); toast(tr("Signed in to YouTube")); } catch (e) { toast(e.message, { err: true, ms: 4500 }); } } };
      };
      form.onsubmit = async e => {
        e.preventDefault();
        const q = form.querySelector("input").value.trim(); if (!q) return;
        if (!signedIn()) { try { await signIn(); } catch (err) { note.textContent = err.message; return; } }
        note.textContent = tr("Searching…"); results.replaceChildren();
        try { const r = await searchYouTube(q); note.textContent = r.items.length ? `${trn("{n} result", "{n} results", r.items.length)}` : tr("No results."); r.items.forEach(x => results.append(ytCard(x))); }
        catch (err) { note.textContent = err.message; }
      };
      const rail = (title, items, mk) => { if (!items.length) return null; const s = h(`<section class="shelf"><h2 class="shelf-h">${esc(title)}</h2><div class="rail"></div></section>`); items.forEach(i => { const c = mk(i); c.classList.add("rail-yt"); s.lastElementChild.append(c); }); return s; };
      let token = 0;
      const drawRails = async () => {
        const my = ++token, out = [];
        if (signedIn()) {
          const [liked, pls] = await Promise.all([likedVideos().catch(() => []), myPlaylists().catch(() => [])]);
          if (my !== token) return;
          out.push(rail(tr("Liked Videos"), liked, ytCard), rail(tr("Your Playlists"), pls, ytCard));
        }
        const { history } = await import("./collections.js");
        const recent = (await history({ type: "youtube" })).slice(0, 20).map(x => x.snapshot || { id: x.ref, title: x.title });
        if (my !== token) return;
        out.push(rail(tr("Recently Played in LunaTV"), recent, ytCard));
        rails.replaceChildren(...out.filter(Boolean));
      };
      drawAcct(); drawRails();
      on("youtube-auth", () => { drawAcct(); drawRails(); });
      on("history-changed", drawRails);
      return { refresh: drawRails };
    },
  });
}
on("open-youtube-link", openYouTubeLink);
