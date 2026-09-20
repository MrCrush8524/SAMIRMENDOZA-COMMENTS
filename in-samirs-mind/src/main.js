import { hasSave, loadSave, newSave, writeSave } from './save.js';
import { applyLanguage, getStoredLanguage } from './i18n.js';
import { AudioManager } from './audio.js';

const $ = (sel) => document.querySelector(sel);

const titleScreen = $('#title-screen');
const selectorScreen = $('#selector-screen');
const hud = $('#hud');
const promptEl = $('#prompt');
const journalPopup = $('#journal-popup');
const journalText = $('#journal-text');
const trackPopup = $('#track-popup');
const trackName = $('#track-name');
const tvOverlay = $('#tv-overlay');
const tvVideo = $('#tv-video');
const saveToast = $('#save-toast');
const loadingVeil = $('#loading-veil');
const langSelect = $('#lang-select');

let audio = new AudioManager();
let chapter = null;
let currentSave = null;
let pendingTrack = null;

loadingVeil.classList.add('hidden');

const lang = getStoredLanguage();
langSelect.value = lang;
applyLanguage(lang);
langSelect.addEventListener('change', () => applyLanguage(langSelect.value));

$('#btn-continue').disabled = !hasSave();
audio.playMenu();

$('#btn-new-dream').addEventListener('click', () => {
  titleScreen.classList.add('hidden');
  selectorScreen.classList.add('visible');
});

$('#selector-back').addEventListener('click', () => {
  selectorScreen.classList.remove('visible');
  titleScreen.classList.remove('hidden');
});

document.querySelectorAll('.dreamer-card').forEach((card) => {
  const start = () => {
    const dreamer = card.getAttribute('data-id');
    currentSave = newSave(dreamer);
    beginDream(currentSave);
  };
  card.addEventListener('click', start);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
});

$('#btn-continue').addEventListener('click', () => {
  const save = loadSave();
  if (!save) return;
  currentSave = save;
  beginDream(currentSave);
});

async function beginDream(save) {
  titleScreen.classList.add('hidden');
  selectorScreen.classList.remove('visible');
  loadingVeil.classList.remove('hidden');
  audio.stopMenu();

  const { Chapter1 } = await import('./chapter1.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
  document.getElementById('app').innerHTML = '';
  document.getElementById('app').appendChild(canvas);

  chapter = new Chapter1({
    canvas,
    dreamer: save.dreamer,
    save,
    audio,
    onJournal: showJournal,
    onTrackFound: (it) => showTrackPopup(it),
    onTV: playTV,
    onSave: doSave,
    onPromptChange: (text) => {
      if (text) { promptEl.textContent = text; promptEl.style.display = 'block'; }
      else promptEl.style.display = 'none';
    }
  });

  hud.classList.add('visible');
  loadingVeil.classList.add('hidden');
  audio.playMain();
  doSave();

  window.__ism_debug_pos = () => chapter.camera.position.toArray();
}

function showJournal(text) {
  journalText.textContent = text;
  journalPopup.classList.add('visible');
  document.exitPointerLock();
}
$('#journal-close').addEventListener('click', () => {
  journalPopup.classList.remove('visible');
  doSave();
});

function showTrackPopup(it) {
  pendingTrack = it;
  trackName.textContent = it.name;
  trackPopup.classList.add('visible');
  document.exitPointerLock();
}
$('#track-save').addEventListener('click', () => {
  if (!pendingTrack || !chapter) return;
  chapter.confirmTrackPicked(pendingTrack);
  trackPopup.classList.remove('visible');
  pendingTrack = null;
  doSave();
});
$('#track-play').addEventListener('click', () => {
  if (!pendingTrack || !chapter) return;
  const it = pendingTrack;
  chapter.confirmTrackPicked(it);
  trackPopup.classList.remove('visible');
  pendingTrack = null;
  audio.playDreamTrackNow(it.src);
  doSave();
});

function playTV(src, onDone) {
  tvVideo.src = src;
  tvOverlay.classList.add('visible');
  document.exitPointerLock();
  tvVideo.currentTime = 0;
  tvVideo.play().catch(() => {});
  const finish = () => {
    tvOverlay.classList.remove('visible');
    tvVideo.pause();
    tvVideo.removeEventListener('ended', finish);
    onDone();
  };
  tvVideo.addEventListener('ended', finish);
  $('#tv-close').onclick = finish;
}

function doSave() {
  if (!currentSave) return;
  writeSave(currentSave);
  saveToast.classList.add('visible');
  setTimeout(() => saveToast.classList.remove('visible'), 1400);
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    journalPopup.classList.remove('visible');
    trackPopup.classList.remove('visible');
  }
});
