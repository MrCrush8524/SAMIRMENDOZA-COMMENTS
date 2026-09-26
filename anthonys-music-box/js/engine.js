// The single playback engine. One <audio> and one <video> element for the life of the app;
// screens subscribe to state and never create players of their own.
import * as Lib from './library.js';
import { readLS, writeLS } from './db.js';
import { t as tr } from './i18n.js';

const audio = document.getElementById('audio');
const video = document.getElementById('video');
// Music plays through <audio> (keeps iOS background playback); videos through <video>.
// Only one is ever loaded at a time, and events from the idle one are ignored.
let media = audio;
function on(type, fn) { for (const el of [audio, video]) el.addEventListener(type, ev => { if (ev.target === media) fn(ev); }); }
function useElement(el) {
  if (el === media) return;
  const old = media;
  if (old === video && inPip()) exitPip();
  media = el;
  old.pause(); old.removeAttribute('src'); try { old.load(); } catch {}
  media.playbackRate = S.rate;
  notify('element');
}
export const isVideo = () => media === video && !!S.id;
const subs = new Set();
export const subscribe = fn => (subs.add(fn), fn(S, 'init'), () => subs.delete(fn));
function notify(kind) { subs.forEach(fn => { try { fn(S, kind); } catch (e) { console.error(e); } }); }

export const S = {
  id: null,          // current track id
  queue: [],         // resolved play order (the truth for next/previous)
  index: -1,
  original: null,    // unshuffled order, restored when shuffle turns off
  history: [],       // recently finished ids, newest last
  shuffle: false,
  repeat: 0,         // 0 off, 1 all, 2 one
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  volume: 1,
  rate: 1,
  error: '',
  station: null,     // live radio station when streaming
  sleepAt: 0,        // epoch ms, or -1 for end of track
  volumeSupported: true,
  outputPicker: null,
};

// iOS ignores audio.volume; hide the slider there rather than ship a dead control.
(() => { try { audio.volume = 0.5; S.volumeSupported = Math.abs(audio.volume - 0.5) < 0.01; audio.volume = 1; } catch { S.volumeSupported = false; } })();
if (typeof audio.webkitShowPlaybackTargetPicker === 'function' && window.WebKitPlaybackTargetAvailabilityEvent) S.outputPicker = 'webkit';
else if (audio.remote && typeof audio.remote.prompt === 'function') S.outputPicker = 'remote';

let wantPlay = false, srcURL = null, started = false, counted = false, listened = 0, lastTick = 0, autoSkips = 0, sleepTimer = 0;
const current = () => (S.id ? Lib.get(S.id) : null);

function setSrc(url) {
  if (srcURL && srcURL !== url) { URL.revokeObjectURL(srcURL); srcURL = null; }
  media.src = url;
}

export async function load(id, { autoplay = true, at = 0, fromAuto = false } = {}) {
  const t = Lib.get(id);
  if (!t) return;
  S.station = null;
  S.id = id; S.error = ''; S.time = at; S.duration = t.duration || 0; S.loading = true;
  started = false; counted = false; listened = 0;
  if (!fromAuto) autoSkips = 0;
  if (!t.blob || t.unavailable) { fail(tr('This song’s audio isn’t available on this device. Re-link the file to play it.')); notify('track'); return; }
  useElement(t.video ? video : audio);
  const url = URL.createObjectURL(t.blob);
  setSrc(url); srcURL = url;
  media.playbackRate = S.rate;
  if (at > 0) {
    const seekOnce = () => { try { media.currentTime = at; } catch {} media.removeEventListener('loadedmetadata', seekOnce); };
    on('loadedmetadata', seekOnce);
  }
  updateMediaSession();
  notify('track');
  persist();
  wantPlay = autoplay;
  if (autoplay) await play();
  else { S.playing = false; S.loading = false; notify('state'); }
}

export async function play() {
  wantPlay = true;
  if (!media.src) { if (S.queue.length) return load(S.queue[Math.max(0, S.index)]); return; }
  try { await media.play(); }
  catch (e) {
    if (e?.name === 'NotAllowedError') { S.playing = false; S.loading = false; notify('state'); }
    else if (e?.name !== 'AbortError') console.warn(e);
  }
}
export const pause = () => { wantPlay = false; media.pause(); };
export const toggle = () => (media.paused ? play() : pause());
export function stop() {
  if (inPip()) exitPip();
  media.pause(); media.removeAttribute('src'); try { media.load(); } catch {}
  if (srcURL) { URL.revokeObjectURL(srcURL); srcURL = null; }
  Object.assign(S, { id: null, station: null, queue: [], index: -1, original: null, playing: false, time: 0, duration: 0, error: '' });
  persist(); updateMediaSession(); notify('track');
}

export function seek(sec) {
  if (S.station || !Number.isFinite(sec)) return;
  const d = media.duration || S.duration || 0;
  sec = Math.max(0, d ? Math.min(sec, d - 0.25) : sec);
  try { media.currentTime = sec; } catch {}
  S.time = sec; notify('time');
}
export const seekBy = d => seek((media.currentTime || 0) + d);
export function setVolume(v) { S.volume = Math.max(0, Math.min(1, v)); audio.volume = video.volume = S.volume; writeLS('amb-volume', S.volume); notify('volume'); }

// ---------- queue ----------
function fisher(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function playList(ids, start = 0, { shuffle = false } = {}) {
  ids = ids.filter(id => Lib.get(id));
  if (!ids.length) return;
  if (shuffle) {
    S.original = [...ids];
    S.queue = fisher(ids); S.index = 0; S.shuffle = true;
  } else {
    start = Math.max(0, Math.min(start, ids.length - 1));
    S.queue = [...ids]; S.index = start;
    if (S.shuffle) {
      // Keep shuffle on: chosen song first, the rest shuffled into a durable order.
      S.original = [...ids];
      const rest = ids.filter((_, i) => i !== start);
      S.queue = [ids[start], ...fisher(rest)]; S.index = 0;
    } else S.original = null;
  }
  S.history = S.history.slice(-50);
  load(S.queue[S.index]);
}

export function toggleShuffle() {
  if (S.station) return;
  if (!S.shuffle) {
    S.original = [...S.queue];
    const before = S.queue.slice(0, S.index + 1);
    S.queue = [...before, ...fisher(S.queue.slice(S.index + 1))];
    S.shuffle = true;
  } else {
    if (S.original) {
      const cur = S.id;
      // Keep any songs added while shuffled.
      const extra = S.queue.filter(id => !S.original.includes(id));
      S.queue = [...S.original, ...extra];
      S.index = Math.max(0, S.queue.indexOf(cur));
    }
    S.original = null; S.shuffle = false;
  }
  persist(); notify('queue');
}
export function cycleRepeat() { S.repeat = (S.repeat + 1) % 3; persist(); notify('queue'); }

export function next(auto = false) {
  if (S.station) return;
  if (!S.queue.length) return;
  if (auto && S.repeat === 2) { seek(0); play(); return; }
  if (S.id) S.history.push(S.id);
  if (S.index + 1 < S.queue.length) { S.index++; return load(S.queue[S.index], { fromAuto: auto }); }
  if (S.repeat === 1 || !auto) {
    if (S.repeat !== 1 && !auto) { /* manual next at end: stop at start of queue */ S.index = 0; return load(S.queue[0], { autoplay: false }); }
    S.index = 0; return load(S.queue[0], { fromAuto: auto });
  }
  // Queue ended normally.
  media.pause(); seek(0); S.playing = false; notify('state');
}
export function prev() {
  if (S.station) return;
  if ((media.currentTime || 0) > 3 || !S.queue.length) { seek(0); return; }
  if (S.index > 0) { S.index--; return load(S.queue[S.index]); }
  if (S.repeat === 1) { S.index = S.queue.length - 1; return load(S.queue[S.index]); }
  seek(0);
}
export function jumpTo(i) { if (i < 0 || i >= S.queue.length) return; if (S.id) S.history.push(S.id); S.index = i; load(S.queue[i]); }

function insertOriginal(ids, afterCurrent) {
  if (!S.original) return;
  if (afterCurrent) { const p = S.original.indexOf(S.id); S.original.splice(p + 1, 0, ...ids); }
  else S.original.push(...ids);
}
export function enqueueNext(ids) {
  ids = [].concat(ids).filter(id => Lib.get(id));
  if (!ids.length) return;
  if (!S.queue.length || S.station) return playList(ids, 0);
  S.queue.splice(S.index + 1, 0, ...ids); insertOriginal(ids, true);
  persist(); notify('queue');
}
export function enqueueLast(ids) {
  ids = [].concat(ids).filter(id => Lib.get(id));
  if (!ids.length) return;
  if (!S.queue.length || S.station) return playList(ids, 0);
  S.queue.push(...ids); insertOriginal(ids, false);
  persist(); notify('queue');
}
export function removeAt(i) {
  if (i === S.index || i < 0 || i >= S.queue.length) return;
  const [id] = S.queue.splice(i, 1);
  if (i < S.index) S.index--;
  if (S.original) { const k = S.original.indexOf(id); if (k >= 0) S.original.splice(k, 1); }
  persist(); notify('queue');
}
export function move(from, to) {
  if (from === to || from < 0 || to < 0 || from >= S.queue.length || to >= S.queue.length) return;
  const [id] = S.queue.splice(from, 1); S.queue.splice(to, 0, id);
  S.index = S.queue.indexOf(S.id);
  persist(); notify('queue');
}
export function clearUpNext() {
  S.queue = S.queue.slice(0, S.index + 1);
  if (S.original) S.original = S.original.filter(id => S.queue.includes(id));
  persist(); notify('queue');
}
// Remove deleted tracks from the queue without interrupting playback when possible.
export function prune() {
  const alive = id => !!Lib.get(id);
  if (S.id && !alive(S.id) && !S.station) { stop(); return; }
  const cur = S.id;
  S.queue = S.queue.filter(alive); S.index = S.queue.indexOf(cur);
  if (S.original) S.original = S.original.filter(alive);
  S.history = S.history.filter(alive);
  persist(); notify('queue');
}

// ---------- radio ----------
export async function playStation(st) {
  useElement(audio);
  S.station = st; S.id = null; S.error = ''; S.time = 0; S.duration = 0; S.loading = true;
  started = true;
  setSrc(st.url);
  updateMediaSession(); notify('track');
  await play();
}

// ---------- sleep timer ----------
export function setSleep(minutes) {
  clearTimeout(sleepTimer);
  if (minutes === 0) S.sleepAt = 0;
  else if (minutes === -1) S.sleepAt = -1;
  else { S.sleepAt = Date.now() + minutes * 60000; sleepTimer = setTimeout(() => { pause(); S.sleepAt = 0; notify('sleep'); }, minutes * 60000); }
  notify('sleep');
}

// ---------- errors ----------
function fail(msg) {
  S.error = msg; S.loading = false; S.playing = false;
  const t = current(); if (t) t.unavailable = !t.blob;
  notify('error');
}

// ---------- audio events ----------
on('playing', () => {
  S.playing = true; S.loading = false; S.error = '';
  if (!started && S.id) { started = true; Lib.markStarted(S.id); }
  setPlaybackState(); notify('state');
});
on('play', () => { S.playing = true; setPlaybackState(); notify('state'); });
on('pause', () => { S.playing = false; setPlaybackState(); persist(); notify('state'); });
on('waiting', () => { S.loading = true; notify('state'); });
on('stalled', () => { if (S.station) { S.loading = true; notify('state'); } });
on('canplay', () => { S.loading = false; notify('state'); });
on('loadedmetadata', () => {
  if (S.station) return;
  const d = media.duration;
  if (Number.isFinite(d) && d > 0) {
    S.duration = d;
    const t = current();
    if (t && Math.abs((t.duration || 0) - d) > 1.5) { t.duration = d; Lib.saveTrack(t).catch(() => {}); }
  }
  notify('time'); updatePosition();
});
on('timeupdate', () => {
  const now = media.currentTime || 0;
  if (!S.station && S.playing) {
    const delta = now - lastTick;
    if (delta > 0 && delta < 2) listened += delta;
    const d = S.duration || media.duration || 0;
    if (!counted && S.id && (listened >= 30 || (d && listened >= d * 0.5))) { counted = true; Lib.markPlayed(S.id); }
  }
  lastTick = now; S.time = now;
  notify('time');
  if (Math.floor(now) % 5 === 0) { updatePosition(); persistTime(); }
});
on('ended', () => {
  if (S.sleepAt === -1) { S.sleepAt = 0; notify('sleep'); if (S.id) S.history.push(S.id); S.playing = false; notify('state'); return; }
  next(true);
});
on('error', () => {
  if (!media.getAttribute('src')) return;
  const code = media.error?.code;
  if (S.station) { fail(tr('This station isn’t responding or uses a format this browser can’t play.')); return; }
  const t = current();
  const msg = tr(code === 4 ? 'This file’s format can’t be played in this browser.' : 'This song couldn’t be played. It may be damaged or missing.');
  if (t) t.unavailable = true;
  fail(msg);
  if (autoSkips < 3 && S.index + 1 < S.queue.length && wantPlay) { autoSkips++; setTimeout(() => { S.index++; load(S.queue[S.index], { fromAuto: true }); }, 900); }
});
on('ratechange', () => { S.rate = media.playbackRate; });


// ---------- Media Session ----------
const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
function absolute(u) { try { return new URL(u, location.href).href; } catch { return u; } }
export function updateMediaSession() {
  if (!ms) return;
  try {
    if (S.station) {
      const art = S.station.favicon ? [{ src: S.station.favicon, sizes: '256x256' }] : [];
      ms.metadata = new MediaMetadata({ title: S.station.name, artist: tr('Live Radio'), album: "Anthony's Music Box", artwork: [...art, { src: absolute('assets/icon-512.png'), sizes: '512x512', type: 'image/png' }] });
      return;
    }
    const t = current();
    if (!t) { ms.metadata = null; return; }
    const art = [];
    if (t.art) art.push({ src: Lib.artOf(t, true), sizes: '512x512', type: t.art.type || 'image/jpeg' });
    else if (t.thumb) art.push({ src: Lib.artOf(t), sizes: '320x320', type: 'image/jpeg' });
    else { const a = Lib.artOf(t); art.push({ src: absolute(a), sizes: '600x600' }); }
    art.push({ src: absolute('assets/default-cover.jpg'), sizes: '1200x1200', type: 'image/jpeg' });
    ms.metadata = new MediaMetadata({ title: Lib.trackTitle(t), artist: Lib.trackArtist(t), album: t.album || "Anthony's Music Box", artwork: art });
  } catch (e) { console.warn('mediaSession', e); }
}
function setPlaybackState() { if (ms) try { ms.playbackState = S.playing ? 'playing' : 'paused'; } catch {} }
function updatePosition() {
  if (!ms?.setPositionState || S.station) return;
  const d = media.duration;
  if (!Number.isFinite(d) || d <= 0) return;
  try { ms.setPositionState({ duration: d, position: Math.min(media.currentTime || 0, d), playbackRate: media.playbackRate || 1 }); } catch {}
}
if (ms) {
  const h = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* unsupported action */ } };
  h('play', () => play());
  h('pause', () => pause());
  h('stop', () => pause());
  h('nexttrack', () => next());
  h('previoustrack', () => prev());
  h('seekto', d => { if (d.fastSeek && 'fastSeek' in media) media.fastSeek(d.seekTime); else seek(d.seekTime); updatePosition(); });
  h('seekbackward', d => seekBy(-(d.seekOffset || 10)));
  h('seekforward', d => seekBy(d.seekOffset || 10));
}

// ---------- persistence ----------
function persist() {
  writeLS('amb-queue', { q: S.queue.slice(0, 5000), i: S.index, o: S.original?.slice(0, 5000) || null, sh: S.shuffle, rp: S.repeat, t: media.currentTime || S.time || 0, h: S.history.slice(-30) });
  if (S.id) writeLS('smr-last', { id: S.id, time: media.currentTime || 0 });
}
let lastPersist = 0;
function persistTime() { const n = Date.now(); if (n - lastPersist > 4000) { lastPersist = n; persist(); } }
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });

export function restore() {
  S.volume = readLS('amb-volume', 1);
  if (S.volumeSupported) audio.volume = video.volume = S.volume;
  const q = readLS('amb-queue', null);
  const alive = id => !!Lib.get(id);
  if (q && Array.isArray(q.q) && q.q.length) {
    S.queue = q.q.filter(alive);
    S.original = Array.isArray(q.o) ? q.o.filter(alive) : null;
    S.shuffle = !!q.sh; S.repeat = [0, 1, 2].includes(q.rp) ? q.rp : 0;
    S.history = Array.isArray(q.h) ? q.h.filter(alive) : [];
    const id = q.q[q.i];
    S.index = alive(id) ? S.queue.indexOf(id) : Math.min(Math.max(0, q.i), S.queue.length - 1);
    if (S.index >= 0 && S.queue[S.index]) load(S.queue[S.index], { autoplay: false, at: q.t || 0 });
    return;
  }
  const last = readLS('smr-last', null);
  if (last?.id && alive(last.id)) { S.queue = Lib.L.tracks.map(t => t.id); S.index = S.queue.indexOf(last.id); load(last.id, { autoplay: false, at: last.time || 0 }); }
}

export function showOutputPicker() {
  try {
    if (S.outputPicker === 'webkit') media.webkitShowPlaybackTargetPicker();
    else if (S.outputPicker === 'remote') media.remote.prompt().catch(() => {});
  } catch (e) { console.warn(e); }
}
export const audioEl = audio;
export const videoEl = video;
export const mediaEl = () => media;

// ---------- Picture in Picture (video) ----------
export const pipSupported = !!((document.pictureInPictureEnabled && video.requestPictureInPicture && !video.disablePictureInPicture)
  || (typeof video.webkitSupportsPresentationMode === 'function' && video.webkitSupportsPresentationMode('picture-in-picture')));
export const inPip = () => document.pictureInPictureElement === video || video.webkitPresentationMode === 'picture-in-picture';
function exitPip() {
  try {
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else if (video.webkitPresentationMode === 'picture-in-picture') video.webkitSetPresentationMode('inline');
  } catch { /* already closed */ }
}
export async function togglePip(force) {
  if (!pipSupported || !isVideo()) return false;
  const want = force ?? !inPip();
  try {
    if (want && !inPip()) {
      if (video.requestPictureInPicture && document.pictureInPictureEnabled) await video.requestPictureInPicture();
      else video.webkitSetPresentationMode('picture-in-picture');
    } else if (!want && inPip()) exitPip();
    return true;
  } catch (e) { console.warn('PiP', e); return false; }
}
export function fullscreen() {
  try {
    if (video.requestFullscreen) video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.();
  } catch (e) { console.warn(e); }
}
for (const ev of ['enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged']) video.addEventListener(ev, () => notify('pip'));
// Chrome: enter PiP automatically when the tab/app is hidden during video playback.
if (ms) { try { ms.setActionHandler('enterpictureinpicture', () => { if (isVideo() && S.playing) togglePip(true); }); } catch { /* unsupported */ } }
