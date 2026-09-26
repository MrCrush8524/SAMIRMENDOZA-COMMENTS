// The LunaTV player. Built on first use; never an empty player at launch.
// Modes: "local" (library video, resumable, queue) and "live" (network stream,
// channel surfing, mini guide). Every control is feature-detected: anything the
// browser can't do is hidden rather than faked.
import { h, icon, esc, fmtTime, fmtBytes, clamp, emit, on, isIOS, shareOrCopy } from "./util.js";
import * as Cast from "./cast.js";
import * as db from "./database.js";
import * as media from "./media-store.js";
import { SubtitleRenderer, parseVTT, toVTT } from "./subtitles.js";
import { sheet, panel, slider, toast, onBack, sheetOpen } from "./ui.js";

const HLS_SRC = new URL("../vendor/hls.min.js", import.meta.url).href;   // bundled, no CDN
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];
const FITS = [["original", "Original"], ["fit", "Fit"], ["fill", "Fill (stretch)"], ["crop", "Crop to fill"], ["16:9", "16:9"], ["4:3", "4:3"], ["zoom", "Zoom"]];
const SLEEP = [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "90 min"], [120, "2 hours"], ["video", "End of video"], ["episode", "End of episode"]];

let P = null, v = null, subs = null;
const S = {
  open: false, mode: null, pushed: false, mini: false, ignorePop: false, locked: false, cinema: false,
  item: null, list: [], order: [], idx: 0, group: null, repeat: "off", shuffle: false,
  src: null, hls: null, urls: [], urlIdx: 0, stream: null, channels: [], chIdx: -1, nowNext: null, onStarted: null,
  restoring: false, lastSave: 0, rev: null, idleT: null, scrubbing: false, speed: 1, fit: "fit",
  a: null, b: null, sleep: null, fps: 0, adj: { bri: 1, con: 1, sat: 1, temp: 0 }, subURLsDummy: [],
  ambientT: null, ytHandler: null,
};
const skipSec = () => db.setting("playback.skip") || 10;

// ------------------------------------------------------------------ build
function build() {
  P = {};
  const el = h(`<div class="player" role="dialog" aria-label="Video player">
    <canvas class="p-ambient" width="16" height="9" aria-hidden="true"></canvas>
    <div class="p-stage"><video playsinline webkit-playsinline preload="auto" x-webkit-airplay="allow"></video><div class="p-temp"></div></div>
    <div class="p-subs" aria-live="off"></div>
    <div class="p-ripple l"></div><div class="p-ripple r"></div>
    <span class="spinner p-spin" hidden></span>
    <div class="p-hud glass" aria-live="polite"></div>
    <div class="p-osd glass" hidden></div>
    <div class="p-cast glass" hidden><span class="pc-ic">${icon("cast")}</span><div><b>Casting</b><small></small></div><button class="btn sm" data-a="stopCast">Stop</button></div>
    <div class="p-layer">
      <div class="p-top">
        <button class="pbtn" data-a="close" aria-label="Close player">${icon("close")}</button>
        <button class="pbtn" data-a="minimize" aria-label="Mini player">${icon("chevD")}</button>
        <div class="ttl"><b></b><small></small></div>
        <div class="grp">
          <span class="p-sleep" hidden></span>
          <button class="pbtn" data-a="guide" aria-label="Channel guide" hidden>${icon("guide")}</button>
          <button class="pbtn" data-a="airplay" aria-label="AirPlay" hidden>${icon("airplay")}</button>
          <button class="pbtn" data-a="cast" aria-label="Cast" hidden>${icon("cast")}</button>
          <button class="pbtn" data-a="pip" aria-label="Picture in Picture">${icon("pip")}</button>
          <button class="pbtn" data-a="lock" aria-label="Lock controls">${icon("lock")}</button>
          <button class="pbtn" data-a="more" aria-label="More options">${icon("more")}</button>
        </div>
      </div>
      <div class="p-bottom glass">
        <div class="scrub-wrap"><input class="scrub" type="range" min="0" max="1000" step="1" value="0" aria-label="Timeline"><i class="ab a" hidden></i><i class="ab b" hidden></i></div>
        <div class="p-time"><span data-r="cur">0:00</span><span data-r="dur">0:00</span></div>
        <div class="p-main">
          <button class="pbtn" data-a="prev" aria-label="Previous">${icon("prev")}</button>
          <button class="pbtn" data-a="back" aria-label="Back"></button>
          <button class="pbtn pp" data-a="play" aria-label="Play">${icon("play")}</button>
          <button class="pbtn" data-a="fwd" aria-label="Forward"></button>
          <button class="pbtn" data-a="next" aria-label="Next">${icon("next")}</button>
        </div>
        <div class="p-tools">
          <button class="pbtn" data-a="mute" aria-label="Mute">${icon("volume")}</button>
          <input class="vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">
          <button class="pbtn" data-a="stepB" aria-label="Previous frame" hidden>${icon("stepB")}</button>
          <button class="pbtn" data-a="stepF" aria-label="Next frame" hidden>${icon("stepF")}</button>
          <button class="pbtn" data-a="cc" aria-label="Subtitles">${icon("cc")}</button>
          <button class="pbtn" data-a="audio" aria-label="Audio track" hidden>${icon("audio")}</button>
          <button class="pbtn spd" data-a="speed" aria-label="Playback speed">1×</button>
          <button class="pbtn" data-a="fit" aria-label="Video fit">${icon("aspect")}</button>
          <button class="pbtn" data-a="full" aria-label="Fullscreen">${icon("expand")}</button>
        </div>
      </div>
      <div class="p-resume glass" hidden><span></span><button class="btn sm" data-a="startover">Start Over</button></div>
    </div>
    <div class="p-mini-ctl"><button class="pbtn" data-a="expand" aria-label="Expand player">${icon("expand")}</button><button class="pbtn" data-a="play2" aria-label="Play or pause">${icon("pause")}</button><button class="pbtn" data-a="close2" aria-label="Close player">${icon("close")}</button></div>
    <button class="p-unlock pbtn" data-a="unlock" aria-label="Unlock controls" hidden>${icon("unlock")}</button>
    <div class="p-guide glass" hidden><div class="pg-head"><b>Channels</b><button class="pbtn" data-a="guideClose" aria-label="Close guide">${icon("close")}</button></div><div class="pg-list"></div></div>
    <div class="p-msg glass" hidden><b></b><p></p><div class="btn-row"></div></div>
    <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" hidden data-r="subfile">
    <input type="file" accept="video/*,.mkv,.m4v,.mov,.webm" hidden data-r="relinkfile">
  </div>`);
  document.body.append(el);
  P.root = el; v = el.querySelector("video");
  for (const n of el.querySelectorAll("[data-a]")) P[n.dataset.a] = n;
  for (const n of el.querySelectorAll("[data-r]")) P[n.dataset.r] = n;
  Object.assign(P, {
    scrub: el.querySelector(".scrub"), ttl: el.querySelector(".ttl b"), sub: el.querySelector(".ttl small"), hud: el.querySelector(".p-hud"),
    spin: el.querySelector(".p-spin"), msg: el.querySelector(".p-msg"), layer: el.querySelector(".p-layer"), osd: el.querySelector(".p-osd"),
    rl: el.querySelector(".p-ripple.l"), rr: el.querySelector(".p-ripple.r"), vol: el.querySelector(".vol"), abA: el.querySelector(".ab.a"), abB: el.querySelector(".ab.b"),
    sleepBadge: el.querySelector(".p-sleep"), resume: el.querySelector(".p-resume"), guidePanel: el.querySelector(".p-guide"), stage: el.querySelector(".p-stage"),
    temp: el.querySelector(".p-temp"), ambient: el.querySelector(".p-ambient"), subsLayer: el.querySelector(".p-subs"),
  });
  subs = new SubtitleRenderer(P.subsLayer);
  db.onSetting(k => { if (k.startsWith("subs.")) subs.applyStyle(); if (k === "appearance.ambient") ambient(); if (k === "playback.skip") skipIcons(); });
  skipIcons();

  // feature detection — hidden, never faked
  if (!(document.pictureInPictureEnabled || v.webkitSupportsPresentationMode?.("picture-in-picture"))) P.pip.hidden = true;
  if (!(el.requestFullscreen || el.webkitRequestFullscreen || v.webkitEnterFullscreen)) P.full.hidden = true;
  if (window.WebKitPlaybackTargetAvailabilityEvent) v.addEventListener("webkitplaybacktargetavailabilitychanged", e => { P.airplay.hidden = e.availability !== "available"; });
  // Casting: Chromecast via Google's Cast SDK, or the browser's Remote Playback API.
  if (v.remote?.watchAvailability && !isIOS) v.remote.watchAvailability(a => { S.remoteAvail = a; castButton(); }).catch(() => {});
  Cast.initCast().then(castButton);
  on("cast-state", castButton);
  on("cast-remote", onRemote);
  if (!volumeWritable) P.vol.hidden = true;

  const act = {
    close: requestClose, close2: requestClose, play: togglePlay, play2: togglePlay, back: () => skip(-skipSec()), fwd: () => skip(skipSec()),
    prev: () => (S.mode === "live" ? surf(-1) : step(-1)), next: () => (S.mode === "live" ? surf(1) : step(1)),
    stepB: () => frame(-1), stepF: () => frame(1), cc: subtitleMenu, audio: audioMenu, speed: speedMenu, fit: fitMenu,
    full: toggleFullscreen, pip: togglePip, more: moreMenu, lock: () => setLock(true), unlock: () => setLock(false),
    minimize: () => setMini(true), expand: () => setMini(false), guide: openGuide, guideClose: () => { P.guidePanel.hidden = true; },
    mute: () => { v.muted = !v.muted; hud(v.muted ? "Muted" : "Sound on"); },
    airplay: () => v.webkitShowPlaybackTargetPicker?.(), cast: castAction, stopCast: () => { Cast.stopCasting(); },
    startover: () => { v.currentTime = 0; P.resume.hidden = true; },
  };
  el.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && act[b.dataset.a]) { e.stopPropagation(); act[b.dataset.a](); wake(); } });

  const sc = P.scrub;
  sc.addEventListener("pointerdown", () => { S.scrubbing = true; wake(); });
  sc.addEventListener("input", () => { const d = dur(); if (!d) return; if (S.casting) { Cast.remoteSeek(sc.value / 1000 * d); return; } v.currentTime = sc.value / 1000 * d; paint(); });
  const endScrub = () => { S.scrubbing = false; wake(); };
  sc.addEventListener("pointerup", endScrub); sc.addEventListener("pointercancel", endScrub); sc.addEventListener("change", endScrub);
  P.vol.addEventListener("input", () => { v.volume = +P.vol.value; v.muted = v.volume === 0; });

  v.addEventListener("play", () => { stopReverse(); setPlayIcons(true); wake(); frameButtons(); });
  v.addEventListener("pause", () => { setPlayIcons(false); wake(); save(true); frameButtons(); });
  v.addEventListener("timeupdate", () => { paint(); save(false); abCheck(); });
  v.addEventListener("progress", paint); v.addEventListener("durationchange", paint);
  v.addEventListener("waiting", () => { P.spin.hidden = false; });
  v.addEventListener("playing", () => { P.spin.hidden = true; clearTimeout(S.startT); hideMsg(); S.onStarted?.(); S.onStarted = null; ambient(); });
  v.addEventListener("canplay", () => { P.spin.hidden = true; });
  v.addEventListener("ended", onEnded);
  v.addEventListener("error", onVideoError);
  v.addEventListener("ratechange", () => { P.speed.textContent = fmtRate(v.playbackRate) + "×"; });
  v.addEventListener("volumechange", () => { P.mute.innerHTML = icon(v.muted || v.volume === 0 ? "mute" : "volume"); P.vol.value = v.muted ? 0 : v.volume; });
  if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) trackFps();
  const tick = () => { if (S.open && subs.active) subs.render(v.currentTime); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  gestures();
  document.addEventListener("keydown", keys);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(true); });
  addEventListener("pagehide", () => save(true));
  document.addEventListener("fullscreenchange", () => { P.full.innerHTML = icon(document.fullscreenElement ? "shrink" : "expand"); });
  P.subfile.addEventListener("change", loadSubtitleFile);
  P.relinkfile.addEventListener("change", relinkChosen);
  onBack(() => {
    if (S.ignorePop) { S.ignorePop = false; return true; }
    if (!S.open || S.mini) return false;
    if (!P.guidePanel.hidden) { P.guidePanel.hidden = true; try { history.pushState({ lunatvPlayer: 1 }, "", location.hash); } catch {} return true; }
    doClose(); return true;
  });
}
function skipIcons() {
  const n = skipSec();
  P.back.innerHTML = n === 10 ? icon("back10") : `<span class="skipn">−${n}</span>`;
  P.fwd.innerHTML = n === 10 ? icon("fwd10") : `<span class="skipn">+${n}</span>`;
  P.back.setAttribute("aria-label", `Back ${n} seconds`); P.fwd.setAttribute("aria-label", `Forward ${n} seconds`);
}
function setPlayIcons(playing) {
  const i = icon(playing ? "pause" : "play");
  P.play.innerHTML = i; P.play2.innerHTML = i;
  P.play.setAttribute("aria-label", playing ? "Pause" : "Play");
}

// ------------------------------------------------------------------ open / close
function show({ title, subtitle = "" }) {
  if (!P) build();
  P.root.classList.add("show"); P.root.classList.remove("idle", "mini");
  S.mini = false;
  document.body.classList.add("player-open");
  P.ttl.textContent = title || ""; P.sub.textContent = subtitle;
  if (!S.open) { S.open = true; try { history.pushState({ lunatvPlayer: 1 }, "", location.hash); S.pushed = true; } catch { S.pushed = false; } }
  hideMsg(); P.guidePanel.hidden = true; wake();
}

/** Play library media. entries = media records (or {_yt} YouTube snapshots); opts {group, shuffle, restart, repeat} */
export async function playLocal(entries, idx = 0, opts = {}) {
  S.mode = "local"; S.list = entries; S.group = opts.group || null;
  S.repeat = opts.repeat || opts.group?.repeat || "off"; S.shuffle = !!opts.shuffle;
  S.order = entries.map((_, i) => i);
  if (S.shuffle) { for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; } S.idx = 0; }
  else S.idx = idx;
  await loadEntry(opts.restart);
}
async function loadEntry(restart = false) {
  const e = S.list[S.order[S.idx]];
  if (!e) return;
  if (e._yt) {                                   // hand off to the YouTube player, continue after
    if (S.open) { save(true); teardown(); P.root.classList.remove("show"); S.open = false; if (S.pushed && history.state?.lunatvPlayer) { S.ignorePop = true; history.back(); } S.pushed = false; document.body.classList.remove("player-open"); }
    S.ytHandler?.(e, { onEnded: () => advance() });
    return;
  }
  show({ title: e.title, subtitle: e.series && e.season ? `${e.series} · S${e.season} E${e.episode}` : "" });
  await loadLocal(e, restart);
}

async function loadLocal(m, restart = false) {
  save(true); teardown();
  S.item = m; S.lastSave = 0; S.a = S.b = null; paintAB();
  P.ttl.textContent = m.title;
  setModeUI();
  const url = await media.fileURL(m.id);
  if (!url) {
    showMsg("File needs to be reconnected", `LunaTV still has “${m.title}”, its poster and your place in it, but this browser no longer holds the video itself. Choose the same file to reconnect it.`,
      [["Locate File", () => P.relinkfile.click()], ["Close", requestClose]]);
    return;
  }
  S.src = url;
  const resumeAt = !restart && db.setting("playback.resume") && media.inProgress(m) ? m.position : 0;
  S.restoring = resumeAt > 0;
  v.src = url;
  v.onloadedmetadata = () => {
    if (S.restoring && resumeAt < v.duration - 5) {
      v.currentTime = resumeAt;
      v.addEventListener("seeked", () => { S.restoring = false; }, { once: true });
      P.resume.querySelector("span").textContent = `Resumed from ${fmtTime(resumeAt)}`;
      P.resume.hidden = false; setTimeout(() => { P.resume.hidden = true; }, 6000);
    } else S.restoring = false;
    paint();
  };
  S.speed = db.setting("playback.rememberSpeed") ? db.setting("playback.speed") : S.speed || 1;
  v.playbackRate = S.speed;
  applyFit(); applyAdjust();
  await attachSubtitles(m.id);
  mediaSession(m.title);
  v.play().catch(() => {});
}
async function relinkChosen(e) {
  const f = e.target.files[0]; e.target.value = "";
  if (!f || !S.item) return;
  const r = await media.relink(S.item.id, f);
  if (!r.ok) { toast(r.reason, { err: true }); return; }
  if (r.warn) toast(r.warn, { ms: 4000 });
  loadLocal(S.item);
}

/**
 * Play a network stream. ch: {name, urls[], logo, id}; opts: {channels (surf list), nowNext(ch) → {now, next}, onStarted, subtitle}
 */
export async function playStream(ch, opts = {}) {
  S.mode = "live"; S.list = []; S.group = null; S.stream = ch;
  S.channels = opts.channels || []; S.chIdx = S.channels.findIndex(c => c.id === ch.id); S.nowNext = opts.nowNext || null; S.onChannel = opts.onChannel || null;
  show({ title: ch.name, subtitle: opts.subtitle || nowLine(ch) });
  save(true); teardown();
  S.item = null; S.urls = (ch.urls?.length ? ch.urls : [ch.url]).filter(Boolean); S.urlIdx = 0; S.onStarted = opts.onStarted || null;
  setModeUI(); applyFit(); applyAdjust();
  mediaSession(ch.name);
  if (S.urls.some(u => location.protocol === "https:" && /^http:/i.test(u)) && S.urls.every(u => /^http:/i.test(u))) toast("This source uses insecure http and may be blocked by your browser.", { err: true, ms: 4500 });
  loadStreamUrl();
}
const nowLine = ch => { const nn = S.nowNext?.(ch); return nn?.now ? `Now: ${nn.now.title}` : ""; };

async function loadStreamUrl() {
  teardown();
  const url = S.urls[S.urlIdx];
  if (!url) return streamFailed("This channel has no stream address.");
  P.spin.hidden = false; hideMsg();
  clearTimeout(S.startT);
  S.startT = setTimeout(() => streamFailed("LunaTV couldn’t open this stream. It isn’t responding."), 20000);
  const isHls = /\.m3u8($|\?)/i.test(url) || /\/hls\//i.test(url) || /m3u8/i.test(url);
  if (isHls && !v.canPlayType("application/vnd.apple.mpegurl")) {
    let Hls;
    try { Hls = await loadHls(); } catch { return streamFailed("The streaming engine couldn’t load."); }
    if (!Hls.isSupported()) return streamFailed("This browser can’t play live HLS streams.");
    const hls = S.hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
    let recovered = false;
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal || S.hls !== hls) return;
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); return; }
      streamFailed(d.type === Hls.ErrorTypes.NETWORK_ERROR ? "LunaTV couldn’t open this stream. It may be offline, region-locked, or blocked by its host." : "This device can’t decode this stream’s format.");
    });
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => { P.audio.hidden = hls.audioTracks.length < 2; });
    hls.loadSource(url); hls.attachMedia(v);
  } else v.src = url;
  v.playbackRate = 1;
  v.play().catch(() => {});
}
function streamFailed(reason) {
  clearTimeout(S.startT); P.spin.hidden = true;
  if (S.casting) return;
  if (S.mode !== "live") return;
  if (S.urlIdx < S.urls.length - 1) { S.urlIdx++; hud("Trying another source…"); loadStreamUrl(); return; }
  teardown();
  const btns = [["Try Again", () => { S.urlIdx = 0; loadStreamUrl(); }]];
  if (S.channels.length > 1) btns.push(["Next Channel", () => surf(1)]);
  btns.push(["Close", requestClose]);
  showMsg("Stream unavailable", reason, btns);
}
function onVideoError() {
  if (S.casting || (!v.getAttribute("src") && !S.hls)) return;
  if (S.mode === "live") { if (!S.hls) streamFailed("LunaTV couldn’t open this stream. It may be offline, blocked, or in a format this device can’t play."); return; }
  showMsg("Video format not supported", v.error?.code === 4 ? "This device can’t play this video format directly (common with MKV, HEVC or AC-3 audio). It may play in another browser." : "The video couldn’t be decoded.",
    S.order.length > 1 ? [["Next Video", () => step(1)], ["Close", requestClose]] : [["Close", requestClose]]);
}

function teardown() {
  stopReverse(); clearTimeout(S.startT); clearInterval(S.ambientT);
  if (S.hls) { try { S.hls.destroy(); } catch {} S.hls = null; }
  v.onloadedmetadata = null;
  v.removeAttribute("src"); v.load();
  if (S.src) { URL.revokeObjectURL(S.src); S.src = null; }
  subs.clear(); P.cc.classList.remove("on"); S.subCues = [];
  P.audio.hidden = true; P.resume.hidden = true;
  S.restoring = false;
}

export function requestClose() { if (S.pushed && history.state?.lunatvPlayer) history.back(); else doClose(); }
function doClose() {
  if (!S.open) return;
  save(true);
  if (S.casting) { S.casting = false; Cast.stopCasting(); P.root.querySelector(".p-cast").hidden = true; }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (document.pictureInPictureElement) document.exitPictureInPicture?.().catch(() => {});
  teardown(); clearSleep();
  S.open = false; S.pushed = false; S.mini = false; S.item = null; S.list = []; S.stream = null; S.onStarted = null; S.locked = false;
  P.root.classList.remove("show", "idle", "mini", "locked", "cinema"); P.unlock.hidden = true; S.cinema = false;
  P.spin.hidden = true; hideMsg();
  document.body.classList.remove("player-open", "player-mini");
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  emit("library-changed");
}
export const isOpen = () => S.open;
export const setYouTubeHandler = fn => { S.ytHandler = fn; };

// Mini player: keeps playing while you browse; sits above the bottom nav.
function setMini(on) {
  if (on === S.mini) return;
  S.mini = on;
  P.root.classList.toggle("mini", on);
  document.body.classList.toggle("player-mini", on);
  document.body.classList.toggle("player-open", !on);
  if (on) { if (document.fullscreenElement) document.exitFullscreen?.(); if (S.pushed && history.state?.lunatvPlayer) { S.ignorePop = true; history.back(); } S.pushed = false; }
  else { try { history.pushState({ lunatvPlayer: 1 }, "", location.hash); S.pushed = true; } catch {} wake(); }
}

// ------------------------------------------------------------------ mode UI
function setModeUI() {
  const live = S.mode === "live", queue = S.order.length > 1 || S.repeat !== "off";
  for (const k of ["speed", "back", "fwd"]) P[k].hidden = live;
  P.scrub.parentElement.hidden = live;
  P.guide.hidden = !live || S.channels.length < 2;
  const surfable = live && S.channels.length > 1;
  P.prev.hidden = P.next.hidden = live ? !surfable : !queue;
  P.prev.setAttribute("aria-label", live ? "Previous channel" : "Previous");
  P.next.setAttribute("aria-label", live ? "Next channel" : "Next");
  if (!live) { P.prev.disabled = S.idx === 0 && S.repeat !== "all"; P.next.disabled = S.idx >= S.order.length - 1 && S.repeat !== "all"; }
  else P.prev.disabled = P.next.disabled = false;
  P.speed.textContent = fmtRate(live ? 1 : S.speed) + "×";
  frameButtons(); paint();
}
function frameButtons() {
  const ok = S.mode === "local" && v.paused && !!S.fps;     // precise stepping needs a measured frame rate
  P.stepB.hidden = P.stepF.hidden = !ok;
}
function paint() {
  if (!P) return;
  if (S.mode === "live") { P.cur.innerHTML = `<span class="live">LIVE</span>`; P.dur.textContent = ""; return; }
  const d = dur(), t = S.casting ? Cast.snapshot().time : v.currentTime || 0;
  if (!S.scrubbing) P.scrub.value = d ? Math.round(t / d * 1000) : 0;
  let b = 0;
  try { for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= t) b = v.buffered.end(i); } catch {}
  P.scrub.style.setProperty("--p", (d ? t / d * 100 : 0) + "%");
  P.scrub.style.setProperty("--b", (d ? b / d * 100 : 0) + "%");
  P.cur.textContent = fmtTime(t);
  P.dur.textContent = d ? "−" + fmtTime(d - t) : "--:--";
}
const dur = () => (S.casting ? Cast.snapshot().duration || 0 : isFinite(v.duration) ? v.duration : 0);
const fmtRate = r => String(r).replace(/^0\./, ".");

// ------------------------------------------------------------------ transport
function togglePlay() {
  if (S.casting) { Cast.remoteToggle(); return; }
  if (S.rev) { stopReverse(); v.play().catch(() => {}); return; }
  if (v.paused) v.play().catch(() => hud("Tap play again")); else v.pause();
}
function skip(d) {
  if (S.mode === "live") return;
  if (S.casting) { const r = Cast.snapshot(); Cast.remoteSeek(clamp(r.time + d, 0, r.duration || r.time + d)); hud(d < 0 ? `−${Math.abs(d)}s` : `+${d}s`); return; }
  v.currentTime = clamp(v.currentTime + d, 0, dur() || v.currentTime + Math.max(d, 0));
  paint(); hud(d < 0 ? `−${Math.abs(d)}s` : `+${d}s`);
}
function step(dir) {
  if (S.mode !== "local") return;
  let n = S.idx + dir;
  if (n < 0 || n >= S.order.length) { if (S.repeat !== "all") return; n = (n + S.order.length) % S.order.length; }
  S.idx = n; setModeUI(); loadEntry();
}
function advance() {
  if (S.repeat === "one") { loadEntry(true); return; }
  if (S.idx < S.order.length - 1 || S.repeat === "all") { S.idx = (S.idx + 1) % S.order.length; loadEntry(true); }
}
function onEnded() {
  if (S.mode !== "local" || !S.item) return;
  media.markFinished(S.item, v.duration);
  S.item = { ...S.item, position: 0 };
  if (S.sleep && (S.sleep.kind === "video" || S.sleep.kind === "episode")) { clearSleep(); hud("Sleep timer: stopped"); wake(); return; }
  if (S.repeat === "one") { v.currentTime = 0; v.play(); return; }
  if (db.setting("playback.autoplay") && (S.idx < S.order.length - 1 || S.repeat === "all")) { step(1); return; }
  wake();
}
function save(force) {
  if (S.mode !== "local" || !S.item || S.restoring || !(v.currentTime > 0)) return;
  const now = Date.now();
  if (!force && now - S.lastSave < 5000) return;
  S.lastSave = now;
  media.saveProgress(S.item, v.currentTime, v.duration);
}

// Simulated reverse (repeated backward seeks), paced to seek completion.
function toggleReverse() {
  if (S.rev) { stopReverse(); hud("Reverse off"); return; }
  v.pause(); hud("Reverse (simulated)");
  S.rev = setInterval(() => { if (v.seeking) return; if (v.currentTime <= 0.05) { stopReverse(); return; } v.currentTime = Math.max(0, v.currentTime - 0.1 * S.speed); }, 100);
}
function stopReverse() { if (!S.rev) return; clearInterval(S.rev); S.rev = null; }

function trackFps() {
  let last = null;
  const cb = (_, meta) => {
    if (last && meta.presentedFrames > last.presentedFrames && meta.mediaTime > last.mediaTime) {
      const f = (meta.presentedFrames - last.presentedFrames) / (meta.mediaTime - last.mediaTime);
      if (f > 10 && f < 121) { const had = S.fps; S.fps = had ? Math.round(had * 0.8 + f * 0.2) : Math.round(f); if (!had) frameButtons(); }
    }
    last = meta; v.requestVideoFrameCallback(cb);
  };
  v.requestVideoFrameCallback(cb);
}
function frame(dir) {
  if (S.mode !== "local" || !S.fps) return;
  if (!v.paused) v.pause();
  v.currentTime = clamp(v.currentTime + dir / S.fps, 0, dur() || v.currentTime);
  hud(dir > 0 ? "Next frame" : "Previous frame");
}

// A–B repeat
function abCheck() { if (S.a != null && S.b != null && v.currentTime >= S.b) v.currentTime = S.a; }
function paintAB() {
  const d = dur();
  for (const [k, el] of [["a", P.abA], ["b", P.abB]]) { el.hidden = S[k] == null || !d; if (!el.hidden) el.style.left = `${S[k] / d * 100}%`; }
}
function abMenu() {
  sheet({ title: "A–B Repeat", subtitle: S.a != null && S.b != null ? `Looping ${fmtTime(S.a)} – ${fmtTime(S.b)}` : "", groups: [[
    { icon: "ab", label: `Set A${S.a != null ? ` (${fmtTime(S.a)})` : ""}`, run: () => { S.a = v.currentTime; if (S.b != null && S.b <= S.a) S.b = null; paintAB(); hud(`A · ${fmtTime(S.a)}`); } },
    { icon: "ab", label: `Set B${S.b != null ? ` (${fmtTime(S.b)})` : ""}`, disabled: S.a == null, run: () => { if (v.currentTime <= S.a + 0.3) { toast("B must come after A", { err: true }); return; } S.b = v.currentTime; paintAB(); hud(`Looping ${fmtTime(S.a)} – ${fmtTime(S.b)}`); } },
    { icon: "close", label: "Clear Loop", disabled: S.a == null, run: () => { S.a = S.b = null; paintAB(); hud("Loop cleared"); } },
  ]] });
}

// Sleep timer
function clearSleep() { if (S.sleep?.t) clearInterval(S.sleep.t); S.sleep = null; if (P) P.sleepBadge.hidden = true; }
function sleepMenu() {
  const isEp = S.item?.category === "tv";
  sheet({ title: "Sleep Timer", subtitle: S.sleep ? `Active · ${sleepLabel()}` : "", groups: [
    SLEEP.filter(([k]) => k !== "episode" || isEp).filter(([k]) => S.mode === "local" || typeof k === "number").map(([k, l]) => ({ icon: "moon", label: l, run: () => setSleep(k) })),
    S.sleep ? [{ icon: "close", label: "Turn Off Sleep Timer", run: () => { clearSleep(); hud("Sleep timer off"); } }] : [],
  ] });
}
function setSleep(k) {
  clearSleep();
  if (typeof k === "number") {
    const end = Date.now() + k * 60000;
    S.sleep = { kind: "time", end, t: setInterval(() => { if (Date.now() >= end) { v.pause(); clearSleep(); hud("Sleep timer: paused", 2000); } else badge(); }, 1000) };
  } else S.sleep = { kind: k };
  badge(); hud(`Sleep timer · ${sleepLabel()}`);
}
const sleepLabel = () => !S.sleep ? "" : S.sleep.kind === "time" ? `${Math.max(0, Math.ceil((S.sleep.end - Date.now()) / 60000))} min left` : S.sleep.kind === "video" ? "end of video" : "end of episode";
function badge() { P.sleepBadge.hidden = !S.sleep; P.sleepBadge.innerHTML = S.sleep ? `${icon("moon")}<span>${sleepLabel()}</span>` : ""; }

// Lock
function setLock(on) {
  S.locked = on;
  P.root.classList.toggle("locked", on);
  P.unlock.hidden = !on;
  if (on) { hud("Controls locked"); flashUnlock(); } else { hud("Controls unlocked"); wake(); }
}
let unlockT;
function flashUnlock() { P.unlock.classList.add("vis"); clearTimeout(unlockT); unlockT = setTimeout(() => P.unlock.classList.remove("vis"), 2500); }

// Speed / fit / adjustments
function speedMenu() {
  sheet({ title: "Playback Speed", groups: [SPEEDS.map(s => ({ label: fmtRate(s) + "×" + (s === 1 ? "  Normal" : ""), check: s === S.speed, run: () => {
    S.speed = s; v.playbackRate = s; hud(fmtRate(s) + "×");
    if (db.setting("playback.rememberSpeed")) db.setSetting("playback.speed", s);
  } }))] });
}
function fitMenu() { sheet({ title: "Video Fit", groups: [FITS.map(([k, l]) => ({ label: l, check: S.fit === k, run: () => { S.fit = k; applyFit(); hud(l); } }))] }); }
function applyFit() {
  const st = v.style;
  st.objectFit = { original: "none", fit: "contain", fill: "fill", crop: "cover", "16:9": "fill", "4:3": "fill", zoom: "contain" }[S.fit];
  st.transform = S.fit === "zoom" ? "scale(1.25)" : "";
  if (S.fit === "16:9" || S.fit === "4:3") {
    const r = S.fit === "16:9" ? 16 / 9 : 4 / 3, W = innerWidth, H = innerHeight;
    const w = Math.min(W, H * r), hh = w / r;
    Object.assign(st, { width: `${w}px`, height: `${hh}px`, left: `${(W - w) / 2}px`, top: `${(H - hh) / 2}px` });
  } else Object.assign(st, { width: "", height: "", left: "", top: "" });
}
addEventListener("resize", () => { if (S.open && (S.fit === "16:9" || S.fit === "4:3")) applyFit(); });
function applyAdjust() {
  const a = S.adj;
  v.style.filter = `brightness(${a.bri}) contrast(${a.con}) saturate(${a.sat})`;
  // temperature: a soft warm/cool colour wash over the picture (non-destructive)
  P.temp.style.background = a.temp > 0 ? `rgba(255,150,60,${a.temp * 0.18})` : a.temp < 0 ? `rgba(80,150,255,${-a.temp * 0.18})` : "transparent";
}
function adjustPanel() {
  const pct = v => `${Math.round(v * 100)}%`;
  const body = h(`<div></div>`);
  const rows = [
    slider({ label: "Brightness", min: 0.4, max: 1.6, step: 0.05, value: S.adj.bri, fmt: pct, oninput: x => { S.adj.bri = x; applyAdjust(); } }),
    slider({ label: "Contrast", min: 0.5, max: 1.8, step: 0.05, value: S.adj.con, fmt: pct, oninput: x => { S.adj.con = x; applyAdjust(); } }),
    slider({ label: "Saturation", min: 0, max: 2, step: 0.05, value: S.adj.sat, fmt: pct, oninput: x => { S.adj.sat = x; applyAdjust(); } }),
    slider({ label: "Temperature", min: -1, max: 1, step: 0.05, value: S.adj.temp, fmt: x => x === 0 ? "Neutral" : x > 0 ? `Warm ${Math.round(x * 100)}` : `Cool ${Math.round(-x * 100)}`, oninput: x => { S.adj.temp = x; applyAdjust(); } }),
  ];
  const reset = h(`<button class="btn sm" style="margin:6px 16px 12px">Reset</button>`);
  reset.onclick = () => { S.adj = { bri: 1, con: 1, sat: 1, temp: 0 }; applyAdjust(); rows[0].set(1); rows[1].set(1); rows[2].set(1); rows[3].set(0); };
  body.append(...rows, reset);
  panel({ title: "Video Settings", subtitle: "Doesn’t change the file", body });
}

// ------------------------------------------------------------------ more menu
function moreMenu() {
  const local = S.mode === "local";
  sheet({ title: S.item?.title || S.stream?.name || "Options", groups: [
    [
      { icon: "sliders", label: "Video Settings", sub: "Brightness, contrast, saturation, temperature", run: adjustPanel },
      { icon: "cc", label: "Subtitle Style & Sync", run: subtitleStylePanel },
      local && { icon: "ab", label: "A–B Repeat", run: abMenu },
      local && { icon: "rev", label: S.rev ? "Stop Reverse" : "Reverse (simulated)", run: toggleReverse },
      { icon: "moon", label: "Sleep Timer", sub: S.sleep ? sleepLabel() : "", run: sleepMenu },
    ],
    [
      { icon: "camera", label: "Capture Frame", run: screenshot },
      { icon: "info", label: "Video Info", run: infoSheet },
      S.stream && { icon: "share", label: "Share Stream Link", run: async () => { const r = await shareOrCopy({ title: S.stream.name, url: S.urls[S.urlIdx] }); if (r === "copied") toast("Link copied"); } },
    ],
    [
      { icon: "film2", label: S.cinema ? "Leave Cinema Mode" : "Cinema Mode", run: () => { S.cinema = !S.cinema; P.root.classList.toggle("cinema", S.cinema); hud(S.cinema ? "Cinema mode" : "Cinema mode off"); } },
      { icon: "sparkle", label: db.setting("appearance.ambient") ? "Turn Off Ambient Glow" : "Turn On Ambient Glow", run: () => db.setSetting("appearance.ambient", !db.setting("appearance.ambient")) },
      { icon: "grid", label: db.setting("playback.gestures") ? "Disable Gestures" : "Enable Gestures", run: () => { db.setSetting("playback.gestures", !db.setting("playback.gestures")); hud(db.setting("playback.gestures") ? "Gestures on" : "Gestures off"); } },
      { icon: "lock", label: "Lock Controls", run: () => setLock(true) },
    ],
  ] });
}

// ------------------------------------------------------------------ capture / info
async function screenshot() {
  if (!v.videoWidth) { hud("Nothing to capture yet"); return; }
  let blob;
  try {
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    blob = await new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error("empty")), "image/png"); } catch (e) { rej(e); } });
  } catch {
    toast(S.mode === "live" ? "This stream’s host doesn’t allow frame capture (browser security)." : "Frame capture isn’t available for this video.", { err: true, ms: 3500 });
    return;
  }
  const name = `LunaTV-${(S.item?.title || S.stream?.name || "frame").replace(/[^\w-]+/g, "_").slice(0, 40)}-${fmtTime(v.currentTime).replace(/:/g, ".")}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (isIOS && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
  hud("Frame saved");
}
function infoSheet() {
  const rows = [];
  const add = (k, val) => { if (val) rows.push({ label: String(val), sub: k, disabled: true }); };
  if (S.item) { add("File", S.item.filename); add("Size", S.item.size ? fmtBytes(S.item.size) : ""); add("Type", S.item.mime); }
  if (S.stream) add("Stream", (() => { try { return new URL(S.urls[S.urlIdx]).host; } catch { return ""; } })());
  add("Resolution", v.videoWidth ? `${v.videoWidth} × ${v.videoHeight}` : "");
  add("Duration", dur() ? fmtTime(dur()) : S.mode === "live" ? "Live" : "");
  add("Frame rate", S.fps ? `≈ ${S.fps} fps (measured)` : "");
  if (S.item?.size && dur()) add("Average bitrate", `≈ ${(S.item.size * 8 / dur() / 1e6).toFixed(1)} Mbps (estimated)`);
  if (S.hls) { const lv = S.hls.levels?.[S.hls.currentLevel]; add("Video codec", lv?.videoCodec); add("Audio codec", lv?.audioCodec); if (lv?.bitrate) add("Stream bitrate", `${(lv.bitrate / 1e6).toFixed(1)} Mbps`); }
  const at = audioTracks(); if (at.length) add("Audio tracks", at.map(t => t.label).join(", "));
  add("Subtitles", subs.active ? S.subName || "Loaded" : "None");
  sheet({ title: "Video Info", groups: [rows] });
}

// ------------------------------------------------------------------ subtitles & audio
async function attachSubtitles(mediaId) {
  const list = (await db.all("subs")).filter(s => s.mediaId === mediaId).sort((a, b) => b.added - a.added);
  S.subTracks = list;
  if (list[0]) selectSub(list[0]);
}
function selectSub(rec) {
  if (!rec) { subs.clear(); S.subName = ""; P.cc.classList.remove("on"); return; }
  subs.load(parseVTT(rec.vtt)); S.subName = rec.name; P.cc.classList.add("on");
  subs.offset = rec.offset || 0;
}
function subtitleMenu() {
  const tracks = S.subTracks || [];
  sheet({ title: "Subtitles", groups: [
    [{ label: "Off", check: !subs.active, run: () => { selectSub(null); hud("Subtitles off"); } },
      ...tracks.map(t => ({ label: t.name, check: subs.active && S.subName === t.name, run: () => { selectSub(t); hud(t.name); } }))],
    [{ icon: "file", label: "Load Subtitle File…", sub: ".srt or .vtt", run: () => P.subfile.click() },
      { icon: "sliders", label: "Style & Sync", run: subtitleStylePanel }],
  ] });
}
async function loadSubtitleFile(e) {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const vtt = toVTT(await f.text());
    if (!parseVTT(vtt).length) throw new Error("no cues");
    const rec = { id: `${S.item?.id || "stream"}|${f.name}`, mediaId: S.item?.id || "", name: f.name.replace(/\.[^.]+$/, ""), vtt, added: Date.now(), offset: 0 };
    if (S.item) await db.put("subs", rec);
    S.subTracks = [rec, ...(S.subTracks || []).filter(t => t.id !== rec.id)];
    selectSub(rec); hud("Subtitles loaded");
  } catch { toast("That file doesn’t look like SRT or VTT subtitles.", { err: true }); }
}
function subtitleStylePanel() {
  const body = h(`<div></div>`), set = (k, x) => db.setSetting(`subs.${k}`, x);
  const sync = slider({ label: "Sync", min: -10, max: 10, step: 0.1, value: subs.offset, fmt: x => `${x > 0 ? "+" : ""}${x.toFixed(1)} s`, oninput: x => { subs.offset = x; subs.last = null; saveOffset(); } });
  const fine = h(`<div class="btn-row" style="padding:0 16px 8px"><button class="btn sm">−0.1 s</button><button class="btn sm">+0.1 s</button><button class="btn sm">Reset</button></div>`);
  const [minus, plus, zero] = fine.querySelectorAll("button");
  const nudge = d => { subs.offset = Math.round(clamp(subs.offset + d, -10, 10) * 10) / 10; sync.set(subs.offset); subs.last = null; saveOffset(); };
  minus.onclick = () => nudge(-0.1); plus.onclick = () => nudge(0.1); zero.onclick = () => nudge(-subs.offset);
  const colors = (label, key, opts) => {
    const r = h(`<div class="slider-row"><span class="sl-label">${label}</span><div class="swatches">${opts.map(c => `<button class="sw${db.setting(key) === c ? " on" : ""}" style="background:${c}" data-c="${c}" aria-label="${label} ${c}"></button>`).join("")}</div></div>`);
    r.onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; r.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x === b)); db.setSetting(key, b.dataset.c); };
    return r;
  };
  body.append(
    h(`<div class="section-label" style="margin:4px 16px 4px">Sync</div>`), sync, fine,
    h(`<div class="section-label" style="margin:8px 16px 4px">Style</div>`),
    slider({ label: "Size", min: 60, max: 200, step: 5, value: db.setting("subs.size"), fmt: x => `${x}%`, oninput: x => set("size", x) }),
    slider({ label: "Weight", min: 300, max: 900, step: 100, value: db.setting("subs.weight"), oninput: x => set("weight", x) }),
    colors("Text", "subs.color", ["#ffffff", "#f5e663", "#9fe0ff", "#c8ffb0"]),
    colors("Background", "subs.bg", ["#000000", "#1b2433", "#ffffff"]),
    slider({ label: "Background opacity", min: 0, max: 1, step: 0.05, value: db.setting("subs.bgOpacity"), fmt: x => `${Math.round(x * 100)}%`, oninput: x => set("bgOpacity", x) }),
    slider({ label: "Position", min: 2, max: 40, step: 1, value: db.setting("subs.position"), fmt: x => `${x}% from bottom`, oninput: x => set("position", x) }),
    slider({ label: "Line height", min: 1, max: 2, step: 0.05, value: db.setting("subs.lineHeight"), fmt: x => x.toFixed(2), oninput: x => set("lineHeight", x) }),
  );
  if (!subs.active) body.prepend(h(`<p class="note" style="margin:0 16px 8px">Load a subtitle file to see these changes.</p>`));
  panel({ title: "Subtitles", subtitle: S.subName || "", body });
}
let offT;
function saveOffset() {
  clearTimeout(offT);
  offT = setTimeout(() => { const t = (S.subTracks || []).find(x => x.name === S.subName); if (t && t.mediaId) { t.offset = subs.offset; db.put("subs", t); } }, 400);
}
function audioTracks() {
  if (S.hls?.audioTracks?.length) return S.hls.audioTracks.map((t, i) => ({ label: t.name || t.lang || `Track ${i + 1}`, on: i === S.hls.audioTrack, pick: () => { S.hls.audioTrack = i; } }));
  const at = v.audioTracks;
  if (at && at.length) return [...at].map((t, i) => ({ label: t.label || t.language || `Track ${i + 1}`, on: t.enabled, pick: () => { for (let j = 0; j < at.length; j++) at[j].enabled = j === i; } }));
  return [];
}
function audioMenu() { sheet({ title: "Audio", groups: [audioTracks().map(t => ({ label: t.label, check: t.on, run: () => { t.pick(); hud(t.label); } }))] }); }
function refreshAudioButton() { P.audio.hidden = audioTracks().length < 2; }

// ------------------------------------------------------------------ live: surfing & mini guide
function surf(dir) {
  const list = S.channels; if (list.length < 2) return;
  S.chIdx = (S.chIdx + dir + list.length) % list.length;
  const ch = list[S.chIdx];
  S.stream = ch; S.urls = (ch.urls?.length ? ch.urls : [ch.url]).filter(Boolean); S.urlIdx = 0;
  P.ttl.textContent = ch.name; P.sub.textContent = nowLine(ch);
  S.onChannel?.(ch); S.onStarted = () => S.onChannel?.(ch, true);
  osd(ch);
  if (S.casting) { castCurrent(); return; }
  loadStreamUrl();
}
let osdT;
function osd(ch) {
  const nn = S.nowNext?.(ch);
  P.osd.innerHTML = `${ch.logo ? `<img alt="" src="${esc(ch.logo)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div><b>${esc(ch.name)}</b><small>${nn?.now ? esc(nn.now.title) : "No guide information"}</small></div>`;
  P.osd.hidden = false; clearTimeout(osdT); osdT = setTimeout(() => { P.osd.hidden = true; }, 3000);
}
function openGuide() {
  const list = P.guidePanel.querySelector(".pg-list");
  list.replaceChildren(...S.channels.slice(0, 400).map((c, i) => {
    const nn = S.nowNext?.(c);
    const b = h(`<button class="pg-row${i === S.chIdx ? " on" : ""}"><span class="pg-ch">${esc(c.name)}</span><span class="pg-now">${nn?.now ? `Now · ${esc(nn.now.title)}` : "—"}</span><span class="pg-next">${nn?.next ? `Next · ${esc(nn.next.t || nn.next.title || "")}` : ""}</span></button>`);
    b.onclick = () => { S.chIdx = i - 1; surf(1); P.guidePanel.hidden = true; };
    return b;
  }));
  P.guidePanel.hidden = false;
  list.children[S.chIdx]?.scrollIntoView({ block: "center" });
}

// ------------------------------------------------------------------ fullscreen / pip
async function toggleFullscreen() {
  const el = P.root;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: "hide" }); screen.orientation?.lock?.("landscape").catch(() => {}); return; }
    if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return; }
  } catch {}
  if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); else hud("Fullscreen isn’t available here");
}
async function togglePip() {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (document.pictureInPictureEnabled) await v.requestPictureInPicture();
    else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode(v.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
  } catch { hud("Picture in Picture isn’t available for this video"); }
}

// ------------------------------------------------------------------ ambient glow
function ambient() {
  clearInterval(S.ambientT);
  const on = db.setting("appearance.ambient") && !matchMedia("(prefers-reduced-motion: reduce)").matches && !db.setting("appearance.reduceMotion");
  P.ambient.classList.toggle("on", !!on);
  if (!on) return;
  const ctx = P.ambient.getContext("2d", { willReadFrequently: false });
  S.ambientT = setInterval(() => {
    if (document.hidden || v.paused || !v.videoWidth) return;
    try { ctx.drawImage(v, 0, 0, 16, 9); ctx.getImageData(0, 0, 1, 1); }
    catch { clearInterval(S.ambientT); P.ambient.classList.remove("on"); }   // cross-origin frames can't be sampled
  }, 700);
}

// ------------------------------------------------------------------ chrome visibility
function wake() {
  if (!P || S.locked) return;
  P.root.classList.remove("idle");
  clearTimeout(S.idleT);
  S.idleT = setTimeout(() => {
    if (!v.paused && !S.scrubbing && !sheetOpen() && P.msg.hidden && P.guidePanel.hidden && !S.mini) P.root.classList.add("idle");
  }, S.cinema ? 1500 : 3000);
}
function hideChrome() { if (!v.paused && !S.scrubbing) { clearTimeout(S.idleT); P.root.classList.add("idle"); } }
let hudT;
function hud(t, ms = 900) { if (!P) return; P.hud.textContent = t; P.hud.classList.add("show"); clearTimeout(hudT); hudT = setTimeout(() => P.hud.classList.remove("show"), ms); }
function showMsg(title, text, buttons) {
  P.msg.querySelector("b").textContent = title;
  P.msg.querySelector("p").textContent = text;
  const row = P.msg.querySelector(".btn-row"); row.innerHTML = "";
  buttons.forEach(([label, fn], i) => { const b = h(`<button class="btn ${i ? "" : "blue"}">${esc(label)}</button>`); b.onclick = e => { e.stopPropagation(); fn(); }; row.append(b); });
  P.msg.hidden = false; P.root.classList.remove("idle"); P.spin.hidden = true;
}
function hideMsg() { if (P) P.msg.hidden = true; }

// ------------------------------------------------------------------ gestures
const volumeWritable = (() => { const t = document.createElement("video"); try { t.volume = 0.5; } catch {} return t.volume === 0.5; })();
function gestures() {
  let g = null, lastTap = 0, lastSide = null, tapT = null, warnedVol = false;
  const root = P.root;
  const inChrome = t => t.closest(".p-bottom,.p-top button,.p-msg,.p-mini-ctl,.p-guide,.p-unlock,.p-resume");
  let lastType = "mouse";
  root.addEventListener("pointerdown", e => {
    lastType = e.pointerType;
    if (S.mini || inChrome(e.target) || !e.isPrimary) return;
    g = { x: e.clientX, y: e.clientY, bri: S.adj.bri, vol: v.volume, t0: v.currentTime, mode: null, t: Date.now() };
  });
  root.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse" && !g) { if (!S.locked) wake(); return; }
    if (!g || S.locked || !db.setting("playback.gestures")) return;
    const dy = g.y - e.clientY, dx = e.clientX - g.x;
    if (!g.mode) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.3) g.mode = g.x < innerWidth / 2 ? "bri" : "vol";
      else if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.5 && S.mode === "local" && db.setting("playback.seekSwipe") && dur()) g.mode = "seek";
    }
    if (!g.mode) return;
    if (g.mode === "seek") {
      const t = clamp(g.t0 + dx / innerWidth * Math.min(dur(), 180), 0, dur());
      v.currentTime = t; hud(`${fmtTime(t)} / ${fmtTime(dur())}`);
      return;
    }
    const delta = dy / (innerHeight * 0.45);
    if (g.mode === "bri") { S.adj.bri = clamp(g.bri + delta, 0.3, 1.6); applyAdjust(); hud(`Brightness ${Math.round(S.adj.bri * 100)}%`); }
    else if (volumeWritable) { v.volume = clamp(g.vol + delta, 0, 1); v.muted = false; hud(`Volume ${Math.round(v.volume * 100)}%`); }
    else if (!warnedVol) { warnedVol = true; hud("Use your device’s volume buttons", 1600); }
  });
  const end = e => {
    if (!g) return;
    const moved = g.mode || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12 || Date.now() - g.t > 500;
    const x = g.x; g = null;
    if (moved) return;
    if (S.locked) { flashUnlock(); return; }
    if (e.pointerType === "mouse") { togglePlay(); wake(); return; }
    const side = x < innerWidth / 3 ? "l" : x > innerWidth * 2 / 3 ? "r" : "c";
    const now = Date.now(), dbl = db.setting("playback.gestures") && S.mode === "local";
    if (dbl && now - lastTap < 300 && side === lastSide && side !== "c") {
      clearTimeout(tapT); lastTap = 0;
      skip(side === "l" ? -skipSec() : skipSec());
      const r = side === "l" ? P.rl : P.rr;
      r.textContent = side === "l" ? `−${skipSec()}s` : `+${skipSec()}s`;
      r.classList.add("show"); setTimeout(() => r.classList.remove("show"), 60);
      return;
    }
    lastTap = now; lastSide = side;
    clearTimeout(tapT);
    const wasIdle = root.classList.contains("idle");
    tapT = setTimeout(() => { if (wasIdle) wake(); else hideChrome(); }, dbl && side !== "c" ? 300 : 0);
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", () => { g = null; });
  // Double-click → fullscreen is a mouse convention only; on touch a double-tap already means ±skip.
  root.addEventListener("dblclick", e => { if (lastType === "mouse" && !inChrome(e.target) && !S.locked && !S.mini) toggleFullscreen(); });
}

function keys(e) {
  if (!S.open || S.mini || e.target.matches("input:not(.scrub):not(.vol),textarea,select,[contenteditable]") || sheetOpen()) return;
  if (S.locked) { if (e.key === "Escape") setLock(false); return; }
  const k = e.key; let handled = true;
  if (k === " " || k === "k") togglePlay();
  else if (k === "ArrowLeft" || k === "j") S.mode === "live" ? surf(-1) : skip(-skipSec());
  else if (k === "ArrowRight" || k === "l") S.mode === "live" ? surf(1) : skip(skipSec());
  else if (k === ",") frame(-1); else if (k === ".") frame(1);
  else if (k === "ArrowUp") { v.volume = clamp(v.volume + 0.1, 0, 1); v.muted = false; hud(`Volume ${Math.round(v.volume * 100)}%`); }
  else if (k === "ArrowDown") { v.volume = clamp(v.volume - 0.1, 0, 1); hud(`Volume ${Math.round(v.volume * 100)}%`); }
  else if (k === "m") { v.muted = !v.muted; hud(v.muted ? "Muted" : "Sound on"); }
  else if (k === "f") toggleFullscreen();
  else if (k === "c") subtitleMenu();
  else if (k === "Escape" && !document.fullscreenElement) { if (!P.guidePanel.hidden) P.guidePanel.hidden = true; else requestClose(); }
  else if (k === "n") step(1); else if (k === "p") step(-1);
  else handled = false;
  if (handled) { e.preventDefault(); wake(); }
}

// ------------------------------------------------------------------ misc
function mediaSession(title) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "LunaTV", artwork: [{ src: new URL("../assets/icons/icon-512.png", import.meta.url).href, sizes: "512x512", type: "image/png" }] });
    const ms = navigator.mediaSession, set = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
    set("play", () => v.play()); set("pause", () => v.pause());
    set("seekbackward", S.mode === "local" ? () => skip(-skipSec()) : null); set("seekforward", S.mode === "local" ? () => skip(skipSec()) : null);
    set("previoustrack", S.order.length > 1 || S.channels.length > 1 ? () => (S.mode === "live" ? surf(-1) : step(-1)) : null);
    set("nexttrack", S.order.length > 1 || S.channels.length > 1 ? () => (S.mode === "live" ? surf(1) : step(1)) : null);
  } catch {}
}
let hlsP = null;
export function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return hlsP ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = HLS_SRC; s.async = true;
    s.onload = () => (window.Hls ? res(window.Hls) : rej(new Error("hls")));
    s.onerror = () => { hlsP = null; rej(new Error("hls")); };
    document.head.append(s);
  });
}
// audio tracks can appear after metadata loads
document.addEventListener("loadedmetadata", e => { if (P && e.target === v) refreshAudioButton(); }, true);

// ------------------------------------------------------------------ casting
/** Web address the TV can fetch for what's playing, or "" for browser-stored videos. */
function castableURL() { return S.mode === "live" ? (S.urls[S.urlIdx] || "") : ""; }
function castButton() {
  if (!P) return;
  const any = Cast.devicesAvailable() || S.remoteAvail || S.casting;
  P.cast.hidden = !any;
  P.cast.classList.toggle("on", !!S.casting);
}
async function castCurrent() {
  const url = castableURL(), ch = S.stream;
  try {
    const okd = await Cast.castURL({ url, title: ch?.name || S.item?.title || "LunaTV", subtitle: nowLine(ch || {}) || "LunaTV", image: ch?.logo || "", live: S.mode === "live" });
    if (!okd) return;
    S.casting = true;
    teardown(); hideMsg(); P.spin.hidden = true;           // the TV plays it now; stop fetching it here
    P.root.querySelector(".p-cast").hidden = false;
    P.root.querySelector(".p-cast small").textContent = `${ch?.name || ""} · on ${Cast.deviceName()}`;
    castButton(); setModeUI();
  } catch (e) { toast(e.message, { err: true, ms: 5000 }); }
}
async function castAction() {
  if (S.casting) { sheet({ title: `Casting to ${Cast.deviceName()}`, groups: [[{ icon: "close", label: "Stop Casting", run: () => Cast.stopCasting() }]] }); return; }
  const url = castableURL();
  if (Cast.devicesAvailable() && url) return castCurrent();
  if (S.remoteAvail && v.remote) { try { await v.remote.prompt(); } catch (e) { if (e?.name !== "AbortError" && e?.name !== "NotAllowedError") toast("Couldn’t start casting this video.", { err: true }); } return; }
  if (Cast.devicesAvailable()) toast("This video is stored inside this browser, so a Chromecast can’t reach it. On iPhone, iPad or Mac use AirPlay; live channels and stream links cast normally.", { err: true, ms: 6000 });
}
function onRemote(r) {
  if (!P || !S.casting) return;
  if (!r.connected) {
    S.casting = false; P.root.querySelector(".p-cast").hidden = true; castButton(); setModeUI();
    hud("Casting ended", 1400); setPlayIcons(false); paint();
    if (S.open && S.mode === "live") loadStreamUrl();        // pick the channel back up on this device
    return;
  }
  setPlayIcons(!r.paused); paint();
  P.root.querySelector(".p-cast small").textContent = `${S.stream?.name || S.item?.title || ""} · on ${r.device}`;
}
