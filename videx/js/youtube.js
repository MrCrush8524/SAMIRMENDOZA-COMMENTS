// YouTube: Google Identity Services (token client, no client secret), YouTube
// Data API search, and the official embed. The access token lives in memory
// only and is dropped on sign-out, expiry or reload.
import { h, esc, icon, on, emit } from "./util.js";
import * as db from "./db.js";
import { setRoot, toast, confirmBox, onBack } from "./ui.js";

export const CLIENT_ID = "377117992546-tguolq0bqjvrog0s46f2kr50nchhfekn.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
let token = null, expires = 0, client = null, gisP = null;

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return gisP ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisP = null; rej(new Error("Couldn’t reach Google sign-in. Check your connection or content blocker.")); };
    document.head.append(s);
  });
}
const signedIn = () => token && Date.now() < expires;

async function signIn() {
  await loadGIS();
  client ||= google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPE,
    callback: r => {
      if (r.error) { setStatus(`Sign-in failed: ${r.error_description || r.error}`); return; }
      token = r.access_token; expires = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
      setStatus(); toast("Connected to YouTube");
    },
    error_callback: e => setStatus(e?.type === "popup_closed" ? "Sign-in was cancelled." : e?.type === "popup_failed_to_open" ? "The sign-in window was blocked. Allow pop-ups for this site and try again." : `Sign-in didn’t complete (${e?.type || "unknown"}).`),
  });
  client.requestAccessToken({ prompt: token ? "" : "consent" });
}
function signOut() {
  if (token) try { google.accounts.oauth2.revoke(token, () => {}); } catch {}
  token = null; expires = 0; setStatus("Signed out.");
}

let statusEl = null, authRow = null;
function setStatus(msg) {
  if (!statusEl) return;
  const ok = signedIn();
  statusEl.querySelector(".dot").classList.toggle("on", ok);
  statusEl.querySelector("span:last-child").textContent = msg || (ok ? "Connected to YouTube" : "Not signed in");
  authRow.querySelector("[data-a=in]").hidden = ok;
  authRow.querySelector("[data-a=out]").hidden = !ok;
}

async function search(q, grid, note) {
  if (!signedIn()) { token = null; setStatus("Sign in with Google to search YouTube."); return; }
  note.textContent = "Searching…"; grid.replaceChildren();
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=24&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { token = null; setStatus("Your Google session expired. Sign in again."); note.textContent = ""; return; }
    if (!r.ok) {
      const reason = d.error?.errors?.[0]?.reason;
      throw new Error(reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? "VIDeX has used up today’s YouTube search quota. Try again tomorrow." : d.error?.message || `YouTube returned HTTP ${r.status}.`);
    }
    const items = (d.items || []).filter(x => x.id?.videoId);
    note.textContent = items.length ? `${items.length} results` : "No results.";
    items.forEach(x => grid.append(videoCard({ id: x.id.videoId, title: decode(x.snippet.title), channel: decode(x.snippet.channelTitle), thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url || "" })));
  } catch (e) { note.textContent = e.message; }
}
const decode = s => { const t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value; };

function videoCard(v) {
  const b = h(`<button class="yt-card glass">${v.thumb ? `<img loading="lazy" alt="" src="${esc(v.thumb)}">` : ""}<div><b>${esc(v.title)}</b><small>${esc(v.channel)}</small></div></button>`);
  b.onclick = () => openEmbed(v);
  return b;
}

// ---- official embed with a VIDeX close control outside the iframe
let ytp = null, pushed = false;
function openEmbed(v) {
  if (!ytp) {
    ytp = h(`<div class="ytp" role="dialog" aria-label="YouTube player"><div class="ytp-bar"><button class="pbtn" aria-label="Close YouTube">${icon("close")}</button><div class="ttl"></div></div><iframe title="YouTube video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="ytp-note">Played by YouTube’s official player. VIDeX’s frame grab, reverse and speed tools don’t apply here.</div></div>`);
    document.body.append(ytp);
    ytp.querySelector("button").onclick = requestClose;
    onBack(() => { if (!ytp.classList.contains("show")) return false; close(); return true; });
  }
  ytp.querySelector(".ttl").textContent = v.title;
  ytp.querySelector("iframe").src = `https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(location.origin)}`;
  ytp.classList.add("show");
  document.querySelector(".dock")?.classList.add("away");
  try { history.pushState({ videxYT: 1 }, ""); pushed = true; } catch { pushed = false; }
  db.put("ythist", { ...v, at: Date.now() }).then(async () => {
    const all = (await db.all("ythist")).sort((a, b) => b.at - a.at);
    for (const old of all.slice(50)) await db.del("ythist", old.id);
    emit("yt-changed");
  });
}
function requestClose() { if (pushed && history.state?.videxYT) history.back(); else close(); }
function close() {
  ytp.querySelector("iframe").src = "about:blank";
  ytp.classList.remove("show"); pushed = false;
  document.querySelector(".dock")?.classList.remove("away");
}

export async function ytHistory() { return (await db.all("ythist")).sort((a, b) => b.at - a.at); }
export async function clearYTHistory() { await db.clear("ythist"); emit("yt-changed"); }
export { videoCard };

export function initYouTube() {
  setRoot("youtube", {
    build(content) {
      statusEl = h(`<div class="yt-status"><span class="dot"></span><span>Not signed in</span></div>`);
      authRow = h(`<div class="btn-row"><button class="btn blue" data-a="in">Sign in with Google</button><button class="btn" data-a="out" hidden>${icon("signout")}Sign out</button></div>`);
      authRow.querySelector("[data-a=in]").onclick = () => signIn().catch(e => setStatus(e.message));
      authRow.querySelector("[data-a=out]").onclick = signOut;
      const f = h(`<form class="btn-row" style="margin-top:14px;flex-wrap:nowrap" role="search"><label class="field" style="flex:1">${icon("search")}<input type="search" enterkeyhint="search" placeholder="Search YouTube" aria-label="Search YouTube"></label><button class="btn">Search</button></form>`);
      const note = h(`<p class="note"></p>`), grid = h(`<div class="grid yt-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))"></div>`);
      f.onsubmit = e => { e.preventDefault(); const q = f.querySelector("input").value.trim(); if (q) search(q, grid, note); };
      const hist = h(`<div></div>`);
      content.append(h(`<h1 class="page-title">YouTube</h1>`), statusEl, authRow, f, note, grid, hist);
      const renderHist = async () => {
        const items = await ytHistory();
        hist.replaceChildren();
        if (!items.length) return;
        const s = h(`<section class="shelf"><div style="display:flex;align-items:center;justify-content:space-between"><h2 class="shelf-h">Recently Played</h2><button class="btn sm">Clear</button></div><div class="rail"></div></section>`);
        s.querySelector(".btn").onclick = async () => { if (await confirmBox({ title: "Clear YouTube history in VIDeX?", ok: "Clear", danger: true })) clearYTHistory(); };
        items.slice(0, 20).forEach(v => { const c = videoCard(v); c.style.cssText = "width:220px;flex:none"; s.querySelector(".rail").append(c); });
        hist.append(s);
      };
      on("yt-changed", renderHist);
      renderHist(); setStatus();
      content.append(h(`<p class="note">Searches use the YouTube Data API through your Google sign-in; videos play in YouTube’s own player. VIDeX never downloads or stores YouTube videos.</p>`));
      return { refresh: () => setStatus() };
    },
  });
}
