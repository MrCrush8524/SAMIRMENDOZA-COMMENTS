// The VIDeX player. Built on first use (never an empty player at launch).
// Modes: "local" (library file, resumable, queue) and "live" (network stream).
import { $, h, icon, esc, fmtTime, clamp, emit, isIOS } from "./util.js";
import * as store from "./store.js";
import { sheet, toast, onBack } from "./ui.js";

const HLS_SRC = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

let P = null;                   // DOM refs, built lazily
let v = null;                   // <video>
const S = {                     // session state
  open: false, mode: null, pushed: false,
  item: null, list: [], order: [], idx: 0, group: null, repeat: "off", shuffle: false,
  src: null, hls: null, urls: [], urlIdx: 0, stream: null,
  restoring: false, lastSave: 0, rev: null, idleT: null, scrubbing: false, speed: 1,
  subURLs: [], fps: 30, startT: null, onStarted: null,
};

// ------------------------------------------------------------------ build
function build() {
  P = {};
  const el = h(`<div class="player" role="dialog" aria-label="Video player">
    <video playsinline webkit-playsinline preload="auto"></video>
    <div class="p-ripple l"></div><div class="p-ripple r"></div>
    <span class="spinner p-spin" hidden></span>
    <div class="p-hud glass" aria-live="polite"></div>
    <div class="p-layer">
      <div class="p-top">
        <button class="pbtn" data-a="close" aria-label="Close player">${icon("close")}</button>
        <div class="ttl"></div>
        <div class="grp">
          <button class="pbtn" data-a="aspect" aria-label="Fit or fill screen">${icon("aspect")}</button>
          <button class="pbtn" data-a="pip" aria-label="Picture in picture">${icon("pip")}</button>
          <button class="pbtn" data-a="full" aria-label="Fullscreen">${icon("expand")}</button>
        </div>
      </div>
      <div class="p-bottom glass">
        <input class="scrub" type="range" min="0" max="1000" step="1" value="0" aria-label="Timeline">
        <div class="p-time"><span data-r="cur">0:00</span><span data-r="dur">0:00</span></div>
        <div class="p-main">
          <button class="pbtn" data-a="prev" aria-label="Previous">${icon("prev")}</button>
          <button class="pbtn" data-a="back" aria-label="Back 10 seconds">${icon("back10")}</button>
          <button class="pbtn pp" data-a="play" aria-label="Play">${icon("play")}</button>
          <button class="pbtn" data-a="fwd" aria-label="Forward 10 seconds">${icon("fwd10")}</button>
          <button class="pbtn" data-a="next" aria-label="Next">${icon("next")}</button>
        </div>
        <div class="p-tools">
          <button class="pbtn" data-a="cc" aria-label="Subtitles">${icon("cc")}</button>
          <button class="pbtn" data-a="stepB" aria-label="Previous frame">${icon("stepB")}</button>
          <button class="pbtn" data-a="rev" aria-label="Reverse (simulated)">${icon("rev")}</button>
          <button class="pbtn" data-a="shot" aria-label="Screen grab">${icon("camera")}</button>
          <button class="pbtn" data-a="stepF" aria-label="Next frame">${icon("stepF")}</button>
          <button class="pbtn spd" data-a="speed" aria-label="Playback speed">1×</button>
        </div>
      </div>
    </div>
    <div class="p-msg glass" hidden><b></b><p></p><div class="btn-row"></div></div>
    <input type="file" accept=".srt,.vtt,text/vtt" hidden data-r="subfile">
  </div>`);
  document.body.append(el);
  P.root = el; v = el.querySelector("video");
  for (const n of el.querySelectorAll("[data-a]")) P[n.dataset.a] = n;
  for (const n of el.querySelectorAll("[data-r]")) P[n.dataset.r] = n;
  P.scrub = el.querySelector(".scrub"); P.ttl = el.querySelector(".ttl"); P.hud = el.querySelector(".p-hud");
  P.spin = el.querySelector(".p-spin"); P.msg = el.querySelector(".p-msg"); P.layer = el.querySelector(".p-layer");
  P.rl = el.querySelector(".p-ripple.l"); P.rr = el.querySelector(".p-ripple.r");

  if (!(document.pictureInPictureEnabled || v.webkitSupportsPresentationMode?.("picture-in-picture"))) P.pip.hidden = true;
  if (!(el.requestFullscreen || el.webkitRequestFullscreen || v.webkitEnterFullscreen)) P.full.hidden = true;

  const act = {
    close: requestClose, play: togglePlay, back: () => skip(-10), fwd: () => skip(10),
    prev: () => step(-1), next: () => step(1), rev: toggleReverse, shot: screenshot, speed: speedMenu,
    stepB: () => frame(-1), stepF: () => frame(1), cc: subtitleMenu, full: toggleFullscreen, pip: togglePip,
    aspect: () => { const f = P.root.classList.toggle("fill"); hud(f ? "Fill screen" : "Fit to screen"); },
  };
  el.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && act[b.dataset.a]) { e.stopPropagation(); act[b.dataset.a](); wake(); } });

  // Timeline: never hide controls while scrubbing.
  const sc = P.scrub;
  sc.addEventListener("pointerdown", () => { S.scrubbing = true; wake(); });
  sc.addEventListener("input", () => { const d = dur(); if (d) { v.currentTime = sc.value / 1000 * d; paintScrub(); } });
  const endScrub = () => { S.scrubbing = false; wake(); };
  sc.addEventListener("pointerup", endScrub); sc.addEventListener("pointercancel", endScrub); sc.addEventListener("change", endScrub);

  v.addEventListener("play", () => { stopReverse(); P.play.innerHTML = icon("pause"); P.play.setAttribute("aria-label", "Pause"); wake(); });
  v.addEventListener("pause", () => { P.play.innerHTML = icon("play"); P.play.setAttribute("aria-label", "Play"); wake(); save(true); });
  v.addEventListener("timeupdate", () => { paintScrub(); save(false); });
  v.addEventListener("progress", paintScrub);
  v.addEventListener("durationchange", paintScrub);
  v.addEventListener("waiting", () => { P.spin.hidden = false; });
  v.addEventListener("playing", () => { P.spin.hidden = true; clearTimeout(S.startT); hideMsg(); S.onStarted?.(); S.onStarted = null; });
  v.addEventListener("canplay", () => { P.spin.hidden = true; });
  v.addEventListener("ended", onEnded);
  v.addEventListener("error", onVideoError);
  v.addEventListener("ratechange", () => { P.speed.textContent = fmtRate(v.playbackRate) + "×"; });
  if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) trackFps();

  gestures();
  document.addEventListener("keydown", keys);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(true); });
  addEventListener("pagehide", () => save(true));
  document.addEventListener("fullscreenchange", () => { P.full.innerHTML = icon(document.fullscreenElement ? "shrink" : "expand"); });
  el.querySelector("[data-r=subfile]").addEventListener("change", loadSubtitleFile);
  onBack(() => { if (!S.open) return false; doClose(); return true; });
}

// ------------------------------------------------------------------ open / close
function show(title) {
  if (!P) build();
  P.root.classList.add("show"); P.root.classList.remove("fill", "idle");
  document.querySelector(".dock")?.classList.add("away");
  P.ttl.textContent = title || "";
  if (!S.open) { S.open = true; try { history.pushState({ videxPlayer: 1 }, ""); S.pushed = true; } catch { S.pushed = false; } }
  hideMsg(); wake();
}

/** Play library media. list = media records; idx = start; opts {group, shuffle, restart} */
export async function playLocal(list, idx = 0, opts = {}) {
  S.mode = "local"; S.list = list; S.group = opts.group || null;
  S.repeat = opts.group?.repeat || "off"; S.shuffle = !!opts.shuffle;
  S.order = list.map((_, i) => i);
  if (S.shuffle) { for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; } S.idx = 0; }
  else S.idx = idx;
  show(list[S.order[S.idx]]?.title);
  await loadLocal(list[S.order[S.idx]], opts.restart);
}

async function loadLocal(m, restart = false) {
  save(true); teardownSource();
  S.item = m; S.lastSave = 0;
  P.ttl.textContent = m.title;
  setModeUI();
  const url = await store.fileURL(m.id);
  if (!url) { showMsg("Video not available", "The browser no longer has this video. It may have been cleared to free up space. Remove it and import the file again.", [["Close", requestClose]]); return; }
  S.src = url;
  const resumeAt = !restart && store.inProgress(m) ? m.position : 0;
  S.restoring = resumeAt > 0;
  v.src = url;
  v.onloadedmetadata = () => {
    if (S.restoring && resumeAt < v.duration - 5) { v.currentTime = resumeAt; v.addEventListener("seeked", () => { S.restoring = false; }, { once: true }); }
    else S.restoring = false;
    paintScrub();
  };
  v.playbackRate = S.speed;
  await attachSubtitles(m.id);
  mediaSession(m.title);
  v.play().catch(() => { /* autoplay refused: controls stay up, user taps play */ });
}

/** Play a live stream. ch: {name, urls[], logo, ...}; onStarted: called once playback actually begins. */
export async function playStream(ch, { onStarted } = {}) {
  S.mode = "live"; S.list = []; S.group = null; S.stream = ch;
  show(ch.name);
  save(true); teardownSource();
  S.item = null; S.urls = ch.urls?.length ? ch.urls : [ch.url]; S.urlIdx = 0; S.onStarted = onStarted;
  setModeUI();
  mediaSession(ch.name);
  loadStreamUrl();
}

async function loadStreamUrl() {
  teardownSource();
  const url = S.urls[S.urlIdx];
  P.spin.hidden = false; hideMsg();
  clearTimeout(S.startT);
  S.startT = setTimeout(() => streamFailed("This channel isn’t responding."), 20000);
  const isHls = /\.m3u8($|\?)/i.test(url) || /\/hls\//i.test(url) || /m3u8/i.test(url);
  if (isHls && !v.canPlayType("application/vnd.apple.mpegurl")) {
    let Hls;
    try { Hls = await loadHls(); } catch { return streamFailed("The streaming engine couldn’t load. Check your connection."); }
    if (!Hls.isSupported()) return streamFailed("This browser can’t play live HLS streams.");
    const hls = S.hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
    let recovered = false;
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal || S.hls !== hls) return;
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); return; }
      streamFailed(d.type === Hls.ErrorTypes.NETWORK_ERROR ? "The stream is offline, geo-blocked, or blocked by its host." : "This stream uses a format this browser can’t decode.");
    });
    hls.loadSource(url); hls.attachMedia(v);
  } else {
    v.src = url;
  }
  v.playbackRate = 1;
  v.play().catch(() => {});
}

function streamFailed(reason) {
  clearTimeout(S.startT); P.spin.hidden = true;
  if (S.mode !== "live") return;
  if (S.urlIdx < S.urls.length - 1) { S.urlIdx++; hud("Trying another source…"); loadStreamUrl(); return; }
  teardownSource();
  showMsg("Channel unavailable", reason, [["Try again", () => { S.urlIdx = 0; loadStreamUrl(); }], ["Close", requestClose]]);
}

function onVideoError() {
  if (!v.getAttribute("src") && !S.hls) return;           // teardown, not a real error
  if (S.mode === "live") { if (!S.hls) streamFailed("The stream is offline, blocked, or in a format this browser can’t play."); return; }
  const code = v.error?.code;
  showMsg("Can’t play this video", code === 4 ? "This browser doesn’t support this file’s format or codec (common with MKV, HEVC or AC-3 audio). It may play in a different browser." : "The video couldn’t be decoded.",
    S.order.length > 1 ? [["Next video", () => step(1)], ["Close", requestClose]] : [["Close", requestClose]]);
}

function teardownSource() {
  stopReverse(); clearTimeout(S.startT);
  if (S.hls) { try { S.hls.destroy(); } catch {} S.hls = null; }
  v.onloadedmetadata = null;
  v.removeAttribute("src"); v.load();
  if (S.src) { URL.revokeObjectURL(S.src); S.src = null; }
  for (const u of S.subURLs) URL.revokeObjectURL(u);
  S.subURLs = [];
  for (const t of [...v.querySelectorAll("track")]) t.remove();
  S.restoring = false;
}

export function requestClose() { if (S.pushed && history.state?.videxPlayer) history.back(); else doClose(); }
function doClose() {
  if (!S.open) return;
  save(true);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (document.pictureInPictureElement) document.exitPictureInPicture?.().catch(() => {});
  teardownSource();
  S.open = false; S.pushed = false; S.item = null; S.list = []; S.stream = null; S.onStarted = null;
  P.root.classList.remove("show", "idle");
  P.spin.hidden = true; hideMsg();
  document.querySelector(".dock")?.classList.remove("away");
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  emit("library-changed");
}
export const isOpen = () => S.open;

// ------------------------------------------------------------------ mode UI
function setModeUI() {
  const live = S.mode === "live", queue = S.order.length > 1 || S.repeat !== "off";
  for (const k of ["stepB", "stepF", "rev", "speed", "back", "fwd"]) P[k].hidden = live;
  P.scrub.hidden = live;
  P.prev.hidden = P.next.hidden = live || !queue;
  if (!live) { P.prev.disabled = S.idx === 0 && S.repeat !== "all"; P.next.disabled = S.idx >= S.order.length - 1 && S.repeat !== "all"; }
  P.speed.textContent = fmtRate(live ? 1 : S.speed) + "×";
  P.rev.classList.remove("on");
  paintScrub();
}

function paintScrub() {
  if (!P) return;
  if (S.mode === "live") { P.cur.innerHTML = `<span class="live">LIVE</span>`; P.dur.textContent = ""; return; }
  const d = dur(), t = v.currentTime || 0;
  if (!S.scrubbing) P.scrub.value = d ? Math.round(t / d * 1000) : 0;
  let b = 0;
  try { for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= t) b = v.buffered.end(i); } catch {}
  P.scrub.style.setProperty("--p", (d ? t / d * 100 : 0) + "%");
  P.scrub.style.setProperty("--b", (d ? b / d * 100 : 0) + "%");
  P.cur.textContent = fmtTime(t);
  P.dur.textContent = d ? "-" + fmtTime(d - t) : "--:--";
}
const dur = () => (isFinite(v.duration) ? v.duration : 0);
const fmtRate = r => String(r).replace(/^0\./, ".");

// ------------------------------------------------------------------ transport
function togglePlay() {
  if (S.rev) { stopReverse(); v.play().catch(() => {}); return; }
  if (v.paused) v.play().catch(() => hud("Tap again to play")); else v.pause();
}
function skip(d) {
  if (S.mode === "live") return;
  const dd = dur(); v.currentTime = clamp(v.currentTime + d, 0, dd || v.currentTime + Math.max(d, 0));
  paintScrub();
}
function step(dir) {
  if (S.mode !== "local") return;
  let n = S.idx + dir;
  if (n < 0 || n >= S.order.length) { if (S.repeat !== "all") return; n = (n + S.order.length) % S.order.length; }
  S.idx = n; setModeUI();
  loadLocal(S.list[S.order[n]]);
}
function onEnded() {
  if (S.mode !== "local" || !S.item) return;
  store.markFinished(S.item.id, v.duration);
  S.item = { ...S.item, position: 0 };
  if (S.repeat === "one") { v.currentTime = 0; v.play(); return; }
  if (S.idx < S.order.length - 1 || S.repeat === "all") { step(1); return; }
  wake();
}
function save(force) {
  if (S.mode !== "local" || !S.item || S.restoring || !(v.currentTime > 0)) return;
  const now = Date.now();
  if (!force && now - S.lastSave < 5000) return;
  S.lastSave = now;
  store.saveProgress(S.item.id, v.currentTime, v.duration);
}

// Simulated reverse: repeated backward seeks (not decoder reverse), paced to seek completion.
function toggleReverse() {
  if (S.rev) { stopReverse(); hud("Reverse off"); return; }
  v.pause();
  P.rev.classList.add("on");
  hud("Reverse (simulated)");
  S.rev = setInterval(() => {
    if (v.seeking) return;
    if (v.currentTime <= 0.05) { stopReverse(); return; }
    v.currentTime = Math.max(0, v.currentTime - 0.1 * S.speed);
  }, 100);
}
function stopReverse() { if (!S.rev) return; clearInterval(S.rev); S.rev = null; P?.rev.classList.remove("on"); }

function trackFps() {
  let last = null;
  const cb = (_, meta) => {
    if (last && meta.presentedFrames > last.presentedFrames && meta.mediaTime > last.mediaTime) {
      const f = (meta.presentedFrames - last.presentedFrames) / (meta.mediaTime - last.mediaTime);
      if (f > 10 && f < 121) S.fps = Math.round(S.fps * 0.8 + f * 0.2);
    }
    last = meta; v.requestVideoFrameCallback(cb);
  };
  v.requestVideoFrameCallback(cb);
}
function frame(dir) {
  if (S.mode !== "local") return;
  if (!v.paused) v.pause();
  stopReverse();
  v.currentTime = clamp(v.currentTime + dir / (S.fps || 30), 0, dur() || v.currentTime);
  hud(dir > 0 ? "Next frame" : "Previous frame");
}

function speedMenu() {
  sheet({ title: "Playback speed", groups: [SPEEDS.map(s => ({ label: fmtRate(s) + "×" + (s === 1 ? "  Normal" : ""), check: s === S.speed, run: () => { S.speed = s; v.playbackRate = s; hud(fmtRate(s) + "×"); } }))] });
}

// ------------------------------------------------------------------ screen grab
async function screenshot() {
  if (!v.videoWidth) { hud("Nothing to capture yet"); return; }
  let blob;
  try {
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    blob = await new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error("empty")), "image/png"); } catch (e) { rej(e); } });
  } catch {
    hud(S.mode === "live" ? "This stream doesn’t allow screen grabs" : "Screen grab isn’t available for this video", 2200);
    return;
  }
  const name = `VIDeX-${(S.item?.title || S.stream?.name || "frame").replace(/[^\w-]+/g, "_").slice(0, 40)}-${fmtTime(v.currentTime).replace(/:/g, ".")}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (isIOS && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
  hud("Frame saved");
}

// ------------------------------------------------------------------ subtitles
async function attachSubtitles(mediaId) {
  const subs = await store.subtitlesFor(mediaId);
  subs.forEach((s, i) => addTrack(s.name, s.vtt, i === subs.length - 1));
}
function addTrack(name, vtt, showIt) {
  const u = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
  S.subURLs.push(u);
  const t = document.createElement("track");
  t.kind = "subtitles"; t.label = name; t.src = u; t.srclang = "und";
  v.append(t);
  if (showIt) t.addEventListener("load", () => selectTrack(name), { once: true });
  // Some engines only load a track once it's selected.
  if (showIt) setTimeout(() => selectTrack(name), 50);
}
function selectTrack(label) {
  for (const t of v.textTracks) t.mode = t.label === label ? "showing" : "disabled";
  P.cc.classList.toggle("on", !!label);
}
function subtitleMenu() {
  const tracks = [...v.textTracks].filter(t => t.kind === "subtitles" || t.kind === "captions");
  const cur = tracks.find(t => t.mode === "showing");
  sheet({
    title: "Subtitles",
    groups: [
      [{ label: "Off", check: !cur, run: () => { selectTrack(null); hud("Subtitles off"); } },
        ...tracks.map(t => ({ label: t.label || t.language || "Track", check: t === cur, run: () => { selectTrack(t.label); hud(t.label || "Subtitles on"); } }))],
      [{ icon: "file", label: "Load subtitle file…", sub: ".srt or .vtt", run: () => P.subfile.click() }],
    ],
  });
}
async function loadSubtitleFile(e) {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const vtt = store.toVTT(await f.text());
    if (!/-->/.test(vtt)) throw new Error("no cues");
    const name = f.name.replace(/\.[^.]+$/, "");
    if (S.item) await store.addSubtitle(S.item.id, name, vtt);
    addTrack(name, vtt, true);
    hud("Subtitles loaded");
  } catch { toast("That file doesn’t look like SRT or VTT subtitles.", { err: true }); }
}

// ------------------------------------------------------------------ fullscreen / pip
async function toggleFullscreen() {
  const el = P.root;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: "hide" }); screen.orientation?.lock?.("landscape").catch(() => {}); return; }
    if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return; }
  } catch { /* fall through to iOS video fullscreen */ }
  if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  else hud("Fullscreen isn’t available here");
}
async function togglePip() {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (document.pictureInPictureEnabled) await v.requestPictureInPicture();
    else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode(v.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
  } catch { hud("Picture in Picture isn’t available for this video"); }
}

// ------------------------------------------------------------------ chrome visibility
function wake() {
  if (!P) return;
  P.root.classList.remove("idle");
  clearTimeout(S.idleT);
  S.idleT = setTimeout(() => {
    if (!v.paused && !S.scrubbing && !document.querySelector(".scrim") && P.msg.hidden) P.root.classList.add("idle");
  }, 3000);
}
function hideChrome() { if (!v.paused && !S.scrubbing) { clearTimeout(S.idleT); P.root.classList.add("idle"); } }
let hudT;
function hud(t, ms = 900) { P.hud.textContent = t; P.hud.classList.add("show"); clearTimeout(hudT); hudT = setTimeout(() => P.hud.classList.remove("show"), ms); }
function showMsg(title, text, buttons) {
  P.msg.querySelector("b").textContent = title;
  P.msg.querySelector("p").textContent = text;
  const row = P.msg.querySelector(".btn-row"); row.innerHTML = "";
  buttons.forEach(([label, fn], i) => { const b = h(`<button class="btn ${i ? "" : "blue"}">${esc(label)}</button>`); b.onclick = e => { e.stopPropagation(); fn(); }; row.append(b); });
  P.msg.hidden = false; P.root.classList.remove("idle");
}
function hideMsg() { if (P) P.msg.hidden = true; }

// ------------------------------------------------------------------ gestures
// Tap: toggle chrome. Double-tap left/right third: ∓10 s. Vertical swipe:
// left half = VIDeX brightness (CSS only), right half = volume where allowed.
const volumeWritable = (() => { const t = document.createElement("video"); try { t.volume = 0.5; } catch {} return t.volume === 0.5; })();
function gestures() {
  let g = null, lastTap = 0, lastSide = null, tapT = null, bri = 1, warnedVol = false;
  const root = P.root;
  const inChrome = t => t.closest(".p-bottom,.p-top button,.p-msg");
  root.addEventListener("pointerdown", e => {
    if (inChrome(e.target) || !e.isPrimary) return;
    g = { x: e.clientX, y: e.clientY, bri, vol: v.volume, mode: null, t: Date.now() };
  });
  root.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse" && !g) { wake(); return; }
    if (!g) return;
    const dy = g.y - e.clientY, dx = e.clientX - g.x;
    if (!g.mode && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.3) g.mode = g.x < innerWidth / 2 ? "bri" : "vol";
    if (!g.mode) return;
    const delta = dy / (innerHeight * 0.45);
    if (g.mode === "bri") {
      bri = clamp(g.bri + delta, 0.25, 1.6); root.style.setProperty("--bri", bri);
      hud(`Brightness ${Math.round(bri * 100)}%`);
    } else if (volumeWritable) {
      v.volume = clamp(g.vol + delta, 0, 1); v.muted = false;
      hud(`Volume ${Math.round(v.volume * 100)}%`);
    } else if (!warnedVol) { warnedVol = true; hud("Use your device’s volume buttons", 1600); }
  });
  const end = e => {
    if (!g) return;
    const moved = g.mode || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12 || Date.now() - g.t > 500;
    const x = g.x; g = null;
    if (moved) return;
    // Mouse: click toggles playback (desktop convention); movement already woke the chrome.
    if (e.pointerType === "mouse") { togglePlay(); wake(); return; }
    const side = x < innerWidth / 3 ? "l" : x > innerWidth * 2 / 3 ? "r" : "c";
    const now = Date.now();
    if (now - lastTap < 300 && side === lastSide && side !== "c" && S.mode === "local") {
      clearTimeout(tapT); lastTap = 0;
      skip(side === "l" ? -10 : 10);
      const r = side === "l" ? P.rl : P.rr;
      r.textContent = side === "l" ? "−10s" : "+10s";
      r.classList.add("show"); setTimeout(() => r.classList.remove("show"), 60);
      return;
    }
    lastTap = now; lastSide = side;
    clearTimeout(tapT);
    const wasIdle = root.classList.contains("idle");
    tapT = setTimeout(() => { if (wasIdle) wake(); else hideChrome(); }, S.mode === "local" && side !== "c" ? 300 : 0);
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", () => { g = null; });
  root.addEventListener("dblclick", e => { if (!inChrome(e.target)) toggleFullscreen(); });
}

function keys(e) {
  if (!S.open || e.target.matches("input:not(.scrub),textarea,select") || document.querySelector(".scrim")) return;
  const k = e.key; let handled = true;
  if (k === " " || k === "k") togglePlay();
  else if (k === "ArrowLeft" || k === "j") skip(-10);
  else if (k === "ArrowRight" || k === "l") skip(10);
  else if (k === ",") frame(-1);
  else if (k === ".") frame(1);
  else if (k === "ArrowUp") { v.volume = clamp(v.volume + 0.1, 0, 1); hud(`Volume ${Math.round(v.volume * 100)}%`); }
  else if (k === "ArrowDown") { v.volume = clamp(v.volume - 0.1, 0, 1); hud(`Volume ${Math.round(v.volume * 100)}%`); }
  else if (k === "m") { v.muted = !v.muted; hud(v.muted ? "Muted" : "Sound on"); }
  else if (k === "f") toggleFullscreen();
  else if (k === "Escape" && !document.fullscreenElement) requestClose();
  else if (k === "n") step(1); else if (k === "p") step(-1);
  else handled = false;
  if (handled) { e.preventDefault(); wake(); }
}

// ------------------------------------------------------------------ misc
function mediaSession(title) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "VIDeX", artwork: [{ src: "icon-512.png", sizes: "512x512", type: "image/png" }] });
    const ms = navigator.mediaSession, set = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
    set("play", () => v.play()); set("pause", () => v.pause());
    set("seekbackward", S.mode === "local" ? () => skip(-10) : null); set("seekforward", S.mode === "local" ? () => skip(10) : null);
    set("previoustrack", S.order.length > 1 ? () => step(-1) : null); set("nexttrack", S.order.length > 1 ? () => step(1) : null);
  } catch {}
}

let hlsP = null;
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return hlsP ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = HLS_SRC; s.async = true;
    s.onload = () => (window.Hls ? res(window.Hls) : rej(new Error("hls")));
    s.onerror = () => { hlsP = null; rej(new Error("hls")); };
    document.head.append(s);
  });
}
