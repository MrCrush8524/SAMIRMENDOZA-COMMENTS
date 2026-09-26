// Anthony's Music Box — app shell, navigation stacks, pages, Now Playing.
import { icon } from './icons.js';
import * as Lib from './library.js';
import * as E from './engine.js';
import { L } from './library.js';
import { readLS, writeLS } from './db.js';
import { parseLRC } from './meta.js';
import {
  $, $$, esc, plural, fmtTime, fmtDur, fmtBytes, reduceMotion, ctx, ctxs, toast,
  openSheet, closeSheet, actionSheet, confirmSheet, formSheet, initSheetGestures, sheetOpen,
  slider, img, collage, songRow, tile, navRow, sectionHead, colorOf,
} from './ui.js';
import { radioPage } from './radio.js';

const ROW = 64;
const WOLF = 'assets/wolf.webp';

// ================= error boundary =================
window.addEventListener('error', e => { console.error(e.error || e.message); softError(); });
window.addEventListener('unhandledrejection', e => { console.error(e.reason); softError(); });
let lastSoft = 0;
function softError() { const n = Date.now(); if (n - lastSoft > 8000) { lastSoft = n; try { toast('Something went wrong, but your music is still playing.', { kind: 'warn' }); } catch {} } }

// ================= navigation =================
const TABS = ['home', 'library', 'search'];
const stacks = { home: [{ route: 'home', p: {} }], library: [{ route: 'library', p: {} }], search: [{ route: 'search', p: {} }] };
let tab = 'home';
const stage = $('#stage');
const top = () => stacks[tab][stacks[tab].length - 1];

function ensureEl(e) {
  if (!e.el) { e.el = document.createElement('section'); e.el.className = 'page' + (TABS.includes(e.route) && !e.sub ? '' : ' sub'); e.el.hidden = true; stage.appendChild(e.el); e.stale = true; }
  return e.el;
}
function render(e, keepScroll = false) {
  const page = PAGES[e.route];
  const el = ensureEl(e);
  e.stale = false;
  try {
    if (!page) throw new Error('Unknown page ' + e.route);
    el.innerHTML = page.html(e.p, e);
    el.dataset.route = e.route;
    page.mount?.(el, e.p, e);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="page-pad"><div class="error-card glass"><b>This screen hit a snag.</b><p>${esc(err.message || err)}</p><button class="btn" data-act="goHome">Back to Home</button></div></div>`;
  }
  if (e === top()) { updateNav(); markPlaying(); if (e.vl) vRender(e, true); }
  if (keepScroll) window.scrollTo(0, e.scroll || 0);
}
function show(e, dir = 0) {
  for (const s of Object.values(stacks)) for (const x of s) if (x.el && x !== e) x.el.hidden = true;
  const el = ensureEl(e);
  if (e.stale) render(e);
  el.hidden = false;
  window.scrollTo(0, e.scroll || 0);
  updateNav(); markPlaying(); updateSelBar();
  if (e.vl) vRender(e, true);
  if (dir && !reduceMotion()) {
    el.animate(dir > 0 ? [{ transform: 'translateX(28%)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ transform: 'translateX(-14%)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
  } else if (dir === 0 && !reduceMotion()) {
    el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
  }
  PAGES[e.route]?.shown?.(el, e.p, e);
}
function saveScroll() { const e = top(); if (e) e.scroll = window.scrollY; }
export function go(route, p = {}) {
  if (!PAGES[route]) return;
  saveScroll();
  const e = { route, p: { ...p }, sub: true };
  stacks[tab].push(e);
  render(e);
  show(e, 1);
  closeNP();
}
function back() {
  const s = stacks[tab];
  if (s.length < 2) return;
  const gone = s.pop();
  gone.cleanup?.(); gone.el?.remove();
  show(top(), -1);
}
function switchTab(t) {
  if (!TABS.includes(t)) return;
  if (t === tab) {
    const s = stacks[tab];
    if (s.length > 1) { while (s.length > 1) { const g = s.pop(); g.cleanup?.(); g.el?.remove(); } show(top(), -1); }
    else window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    return;
  }
  saveScroll(); tab = t;
  $$('[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  show(top(), 0);
  if (t === 'search' && top().route === 'search' && !L.tracks.length) {}
}
function openFromSidebar(route, p) {
  // Desktop sidebar shortcuts live in the Library stack.
  const t = route === 'home' || route === 'search' ? route : 'library';
  if (tab !== t) switchTab(t);
  const s = stacks[tab];
  while (s.length > 1) { const g = s.pop(); g.cleanup?.(); g.el?.remove(); }
  if (route !== s[0].route) go(route, p); else show(top(), 0);
  closeNP();
}

// ---------- navbar ----------
const navbar = $('#navbar');
function updateNav() {
  const e = top(), s = stacks[tab], page = PAGES[e.route];
  const prev = s[s.length - 2];
  const backBtn = $('#navBack');
  backBtn.hidden = !prev;
  if (prev) { $('#navBackLabel').textContent = titleOf(prev); backBtn.setAttribute('aria-label', 'Back to ' + titleOf(prev)); }
  $('#navTitle').textContent = titleOf(e);
  $('#navActions').innerHTML = page?.actions?.(e.p, e) || '';
  navbar.classList.toggle('root', s.length === 1);
  document.title = (s.length > 1 || e.route !== 'home' ? titleOf(e) + ' · ' : '') + "Anthony's Music Box";
  onScroll();
}
const titleOf = e => { try { return PAGES[e.route]?.title(e.p, e) || ''; } catch { return ''; } };

let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY, e = top();
    const lt = e.el?.querySelector('.large-title');
    const threshold = lt ? lt.offsetTop + lt.offsetHeight - navbar.offsetHeight + 4 : 40;
    navbar.style.setProperty('--nav-o', Math.min(1, Math.max(0, y / 44)).toFixed(3));
    navbar.classList.toggle('titled', y > threshold);
    if (e.vl) vRender(e);
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { const e = top(); if (e.vl) vRender(e, true); onScroll(); });

// ---------- virtual track lists ----------
function trackList(e, ids, opts = {}) {
  const key = ctx(opts.key || e.route + ':' + JSON.stringify(e.p), ids);
  if (!ids.length) return '';
  if (ids.length > 80) {
    e.vl = { ids, key, opts, first: -1, last: -1 };
    return `<div class="vlist list" style="height:${ids.length * ROW}px"><div class="vwin"></div></div>`;
  }
  e.vl = null;
  return `<div class="list">${ids.map((id, i) => { const t = Lib.get(id); return t ? songRow(t, { ...opts, sub: opts.subFn?.(t), ctx: key, i, sel: e.sel, num: opts.num ? (opts.numOf ? opts.numOf(t, i) : i + 1) : undefined }) : ''; }).join('')}</div>`;
}
function vRender(e, force) {
  const v = e.vl; const box = e.el?.querySelector('.vlist'); if (!v || !box || e.el.hidden) return;
  const r = box.getBoundingClientRect();
  const first = Math.max(0, Math.floor(-r.top / ROW) - 12);
  const last = Math.min(v.ids.length, Math.ceil((innerHeight - r.top) / ROW) + 12);
  if (!force && first === v.first && last === v.last) return;
  v.first = first; v.last = last;
  const win = box.firstElementChild;
  win.style.transform = `translateY(${first * ROW}px)`;
  let h = '';
  for (let i = first; i < last; i++) { const t = Lib.get(v.ids[i]); if (t) h += songRow(t, { ...v.opts, sub: v.opts.subFn?.(t), ctx: v.key, i, sel: e.sel, num: v.opts.num ? i + 1 : undefined }); }
  win.innerHTML = h;
  markPlaying();
}

// ================= shared page pieces =================
function brandRow(extra = '') {
  return `<div class="brand-row">
    <img class="brand-wolf" src="${WOLF}" alt="" width="44" height="44">
    <div class="brand-text"><b>Anthony's Music Box</b><small>AMB</small></div>
    <div class="brand-actions">${extra}
      <button class="icon-btn glass-btn" data-act="addMusic" aria-label="Add music">${icon('plus')}</button>
      <button class="icon-btn glass-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
    </div>
  </div>`;
}
const largeTitle = (t, right = '') => `<div class="lt-row"><h1 class="large-title">${esc(t)}</h1>${right}</div>`;
function emptyState({ title = 'Your music lives here.', sub = 'Import your own music. Nothing is uploaded.' } = {}) {
  return `<div class="empty">
    <div class="empty-wolf"><img src="${WOLF}" alt="Anthony's Music Box wolf emblem"></div>
    <h2>${esc(title)}</h2><p>${esc(sub)}</p>
    <button class="btn glass-btn wide-ish" data-act="addMusic">Add Music</button>
    <small>MP3 · M4A · AAC · WAV · FLAC · OGG where supported</small>
  </div>`;
}
function storageNotice() {
  if (L.persistent && !L.tracks.some(t => t.sessionOnly)) return '';
  const msg = !L.persistent ? L.storageError : 'Some songs couldn’t be saved because storage is full. They’ll play until you close the app.';
  return `<div class="notice glass">${icon('warn')}<p>${esc(msg)}</p></div>`;
}
function playButtons(ids, extra = '') {
  if (!ids.length) return '';
  const k = ctx('pb:' + ids.length + ':' + ids[0], ids);
  return `<div class="play-row"><button class="btn glass-btn" data-act="playAll" data-ctx="${k}">${icon('play')}<span>Play</span></button><button class="btn glass-btn" data-act="shuffleAll" data-ctx="${k}">${icon('shuffle')}<span>Shuffle</span></button>${extra}</div>`;
}
function shelf(items) { return `<div class="shelf" role="list">${items.join('')}</div>`; }
function trackTile(t, list) {
  const k = ctx('tt:' + t.id, list || [t.id]);
  const i = list ? list.indexOf(t.id) : 0;
  return `<div class="tile" role="listitem"><button class="tile-art play-tile" data-play-ctx="${k}" data-i="${i}" data-id="${t.id}" aria-label="Play ${esc(Lib.trackTitle(t))}">${img(Lib.artOf(t))}<span class="tile-eq eq"><i></i><i></i><i></i></span></button>
    <button class="tile-meta" data-act="songMenu" data-id="${t.id}"><b>${esc(Lib.trackTitle(t))}</b><small>${esc(Lib.trackArtist(t))}</small></button></div>`;
}
function albumTile(a) { return tile({ art: img(Lib.artOf(Lib.get(a.artId || a.ids[0]))), title: a.title, sub: a.artist, go: 'album|' + a.key }); }
const albumsOf = ids => { const m = new Map(); for (const id of ids) { const t = Lib.get(id); if (t) { const a = L.albums.get(Lib.albumKeyOf(t)); if (a && !a.single) m.set(a.key, a); } } return [...m.values()]; };
const realAlbums = () => [...L.albums.values()].filter(a => !a.single);

// ================= pages =================
const SORTS = {
  songs: [['title', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['added', 'Date Added'], ['played', 'Recently Played'], ['plays', 'Play Count']],
  albums: [['title', 'Title'], ['artist', 'Artist'], ['year', 'Year'], ['added', 'Date Added']],
};
function sortTracks(ts, by) {
  const c = (a, b) => Lib.trackTitle(a).localeCompare(Lib.trackTitle(b), undefined, { sensitivity: 'base' });
  const s = [...ts];
  if (by === 'artist') s.sort((a, b) => Lib.trackArtist(a).localeCompare(Lib.trackArtist(b)) || (a.album || '').localeCompare(b.album || '') || (a.track || 0) - (b.track || 0) || c(a, b));
  else if (by === 'album') s.sort((a, b) => (a.album || '￿').localeCompare(b.album || '￿') || (a.track || 0) - (b.track || 0));
  else if (by === 'added') s.sort((a, b) => (b.added || 0) - (a.added || 0));
  else if (by === 'played') s.sort((a, b) => Lib.lastPlayed(b.id) - Lib.lastPlayed(a.id) || c(a, b));
  else if (by === 'plays') s.sort((a, b) => Lib.plays(b.id) - Lib.plays(a.id) || c(a, b));
  else s.sort(c);
  return s;
}
const LIB_ROWS = [
  ['playlists', 'playlist', 'Playlists', () => Object.keys(L.playlists).length],
  ['artists', 'artist', 'Artists', () => L.artists.size],
  ['albums', 'album', 'Albums', () => realAlbums().length],
  ['songs', 'song', 'Songs', () => L.tracks.filter(t => !t.video).length],
  ['videos', 'video', 'Videos', () => Lib.videos().length],
  ['genres', 'genre', 'Genres', () => L.genres.size],
  ['recent', 'clock', 'Recently Added', () => ''],
  ['favorites', 'heart', 'Favorites', () => L.favorites.size || ''],
  ['radio', 'radio', 'Live Radio', () => ''],
  ['files', 'folder', 'Local Files', () => L.tracks.length],
];

const PAGES = {
  // ---------- HOME ----------
  home: {
    title: () => 'Home',
    html: (p, e) => {
      let h = `<div class="page-pad">${brandRow()}${largeTitle('Home')}${storageNotice()}`;
      if (!L.ready) return h + `<div class="skeleton"></div></div>`;
      if (!L.tracks.length) return h + emptyState() + `<div class="center-link"><button class="link" data-go="radio">Or tune in to live radio</button></div></div>`;
      const rp = Lib.recentlyPlayed(12);
      if (rp.length) h += sectionHead('Recently Played', 'played') + shelf(rp.map(t => trackTile(t, rp.map(x => x.id))));
      const mx = Lib.mixes();
      if (mx.length) h += sectionHead('Made for Anthony') + `<div class="mix-list">${mx.map(m => `<button class="mix-card glass" data-go="mix|${m.id}">${collage(m.ids, 'mix-art')}<span class="mix-text"><b>${esc(m.title)}</b><small>${esc(m.sub)}</small></span>${icon('chev', 'chev')}</button>`).join('')}</div>`;
      const ra = Lib.recentlyAdded(12);
      h += sectionHead('Recently Added', 'recent') + shelf(ra.map(t => trackTile(t, ra.map(x => x.id))));
      const fav = Lib.favoriteTracks();
      if (fav.length) h += sectionHead('Favorites', fav.length > 4 ? 'favorites' : '') + trackList(e, fav.slice(0, 4).map(t => t.id), { key: 'home:fav' });
      const mp = Lib.mostPlayed(5);
      if (mp.length >= 3) { e.vl = null; h += sectionHead('Most Played') + `<div class="list">${mp.map((t, i) => songRow(t, { ctx: ctx('home:mp', mp.map(x => x.id)), i, num: i + 1 })).join('')}</div>`; }
      e.vl = null;
      return h + '</div>';
    },
    live: true,
  },
  // ---------- LIBRARY ----------
  library: {
    title: () => 'Library',
    actions: (p, e) => L.tracks.length ? `<button class="link nav-link" data-act="libEdit">${e.edit ? 'Done' : 'Edit'}</button>` : '',
    html: (p, e) => {
      let h = `<div class="page-pad">${brandRow()}${largeTitle('Library', L.tracks.length ? `<button class="link" data-act="libEdit">${e.edit ? 'Done' : 'Edit'}</button>` : '')}${storageNotice()}`;
      if (!L.ready) return h + '<div class="skeleton"></div></div>';
      if (!L.tracks.length && !e.edit) return h + emptyState() + `<div class="center-link"><button class="link" data-go="radio">Or tune in to live radio</button></div></div>`;
      const hidden = new Set(readLS('amb-lib-hidden', []));
      if (e.edit) {
        h += `<div class="group glass">${LIB_ROWS.map(([k, ic, label]) => `<button class="nav-row toggle" data-act="libToggle" data-k="${k}" aria-pressed="${!hidden.has(k)}"><span class="tick ${hidden.has(k) ? '' : 'on'}">${icon('check')}</span><span class="nr-icon">${icon(ic)}</span><span class="nr-label">${label}</span></button>`).join('')}</div><p class="hint">Choose what appears in your Library.</p>`;
        return h + '</div>';
      }
      h += `<div class="group glass">${LIB_ROWS.filter(r => !hidden.has(r[0]) && (r[0] !== 'videos' || Lib.videos().length)).map(([k, ic, label, n]) => navRow({ go: k, iconName: ic, label, count: n() })).join('')}</div>`;
      const ra = Lib.recentlyAdded(6);
      h += sectionHead('Recently Added', 'recent') + `<div class="grid3">${ra.map(t => trackTile(t, ra.map(x => x.id))).join('')}</div>`;
      const fav = Lib.favoriteTracks();
      if (fav.length) h += sectionHead('Favorites', 'favorites') + trackList(e, fav.slice(0, 5).map(t => t.id), { key: 'lib:fav' });
      e.vl = null;
      return h + '</div>';
    },
  },
  // ---------- SEARCH ----------
  search: {
    title: () => 'Search',
    html: (p, e) => `<div class="page-pad">${brandRow()}${largeTitle('Search')}
      <div class="search-wrap"><label class="search-field glass">${icon('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Artists, Albums, Songs, Playlists" value="${esc(p.q || '')}" aria-label="Search your library"><button class="clear-q" data-act="clearQ" aria-label="Clear search" ${p.q ? '' : 'hidden'}>${icon('x')}</button></label></div>
      <div id="searchBody">${searchBody(p.q || '', e)}</div></div>`,
    mount: (el, p, e) => {
      const input = $('#q', el);
      let t = 0;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { p.q = input.value; $('.clear-q', el).hidden = !p.q; $('#searchBody', el).innerHTML = searchBody(p.q, e); markPlaying(); }, 110);
      });
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { addRecent(input.value); input.blur(); } });
    },
    shown: (el, p) => { if (!p.q && matchMedia('(hover:hover)').matches) $('#q', el)?.focus({ preventScroll: true }); },
  },
  // ---------- LISTS ----------
  songs: {
    title: () => 'Songs',
    actions: (p, e) => L.tracks.length ? `<button class="icon-btn" data-act="sortMenu" data-kind="songs" aria-label="Sort songs">${icon('sort')}</button><button class="link nav-link" data-act="selectMode">${e.sel ? 'Done' : 'Select'}</button>` : '',
    html: (p, e) => {
      const by = readLS('amb-sort-songs', 'title');
      const ts = sortTracks(L.tracks.filter(t => !t.video), by);
      if (!ts.length) return `<div class="page-pad">${largeTitle('Songs')}${emptyState()}</div>`;
      const ids = ts.map(t => t.id);
      return `<div class="page-pad">${largeTitle('Songs')}<p class="meta-line">${plural(ids.length, 'song')} · sorted by ${SORTS.songs.find(s => s[0] === by)?.[1] || 'Title'}</p>${e.sel ? '' : playButtons(ids)}${trackList(e, ids, { key: 'songs', album: true })}</div>`;
    },
  },
  albums: {
    title: () => 'Albums',
    actions: () => `<button class="icon-btn" data-act="sortMenu" data-kind="albums" aria-label="Sort albums">${icon('sort')}</button>`,
    html: () => {
      const by = readLS('amb-sort-albums', 'title');
      let as = realAlbums();
      const c = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (by === 'artist') as.sort((a, b) => a.artist.localeCompare(b.artist) || c(a, b));
      else if (by === 'year') as.sort((a, b) => (b.year || 0) - (a.year || 0) || c(a, b));
      else if (by === 'added') as.sort((a, b) => b.added - a.added);
      else as.sort(c);
      return `<div class="page-pad">${largeTitle('Albums')}${as.length ? `<div class="grid2">${as.map(albumTile).join('')}</div>` : emptyState()}</div>`;
    },
  },
  artists: {
    title: () => 'Artists',
    html: () => {
      const ar = [...L.artists.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return `<div class="page-pad">${largeTitle('Artists')}${ar.length ? `<div class="list">${ar.map(a => {
        const t = Lib.get(a.ids[0]) || Lib.get(L.albums.get([...a.albums][0])?.ids[0]);
        return navRow({ go: 'artist|' + a.name, label: a.name, count: plural(a.ids.length, 'song'), art: img(Lib.artOf(t), 'avatar') });
      }).join('')}</div>` : emptyState()}</div>`;
    },
  },
  genres: {
    title: () => 'Genres',
    html: () => {
      const gs = [...L.genres.values()].sort((a, b) => a.name.localeCompare(b.name));
      const body = gs.length ? `<div class="list">${gs.map(g => navRow({ go: 'genre|' + g.name, label: g.name, count: plural(g.ids.length, 'song'), art: collage(g.ids, 'mini-collage') })).join('')}</div>`
        : `<div class="empty small"><p>No genre tags found yet. Add a genre from any song’s <b>Edit Details</b>.</p></div>`;
      return `<div class="page-pad">${largeTitle('Genres')}${body}</div>`;
    },
  },
  playlists: {
    title: () => 'Playlists',
    html: () => {
      const names = Object.keys(L.playlists);
      return `<div class="page-pad">${largeTitle('Playlists')}<div class="list">
        <button class="nav-row new-row" data-act="newPlaylist"><span class="nr-icon accent-bg">${icon('plus')}</span><span class="nr-label accent">New Playlist…</span></button>
        ${names.map(n => navRow({ go: 'playlist|' + n, label: n, count: plural(L.playlists[n].length, 'song'), art: collage(L.playlists[n], 'mini-collage') })).join('')}
      </div>${names.length ? '' : '<p class="hint">Playlists you make appear here. Add songs from any song’s menu.</p>'}</div>`;
    },
  },
  videos: {
    title: () => 'Videos',
    html: (p, e) => {
      const vs = Lib.videos(); const ids = vs.map(t => t.id);
      e.vl = null;
      if (!vs.length) return `<div class="page-pad">${largeTitle('Videos')}<div class="empty small">${icon('video', 'big-i')}<p>Add MP4, M4V, MOV or WebM videos with Add Music. They play here, full screen, or in Picture in Picture.</p><button class="btn glass-btn" data-act="addMusic">${icon('plus')}<span>Add Videos</span></button></div></div>`;
      const k = ctx('videos', ids);
      return `<div class="page-pad">${largeTitle('Videos')}<p class="meta-line">${plural(vs.length, 'video')} · ${fmtDur(Lib.totalDuration(ids))}</p>${playButtons(ids)}
        <div class="vgrid">${vs.map((t, i) => `<div class="vtile"><button class="tile-art play-tile video-art" data-play-ctx="${k}" data-i="${i}" data-id="${t.id}" aria-label="Play ${esc(Lib.trackTitle(t))}">${img(Lib.artOf(t, true))}<span class="vdur">${fmtTime(t.duration)}</span><span class="tile-eq eq"><i></i><i></i><i></i></span></button>
          <button class="tile-meta" data-act="songMenu" data-id="${t.id}"><b>${esc(Lib.trackTitle(t))}</b><small>${esc(Lib.trackArtist(t))}</small></button></div>`).join('')}</div></div>`;
    },
  },
  recent: {
    title: () => 'Recently Added',
    html: (p, e) => { const ids = Lib.recentlyAdded(300).map(t => t.id); return `<div class="page-pad">${largeTitle('Recently Added')}${ids.length ? playButtons(ids) + trackList(e, ids, { key: 'recent', album: true }) : emptyState()}</div>`; },
  },
  played: {
    title: () => 'Recently Played',
    actions: () => `<button class="link nav-link" data-act="clearHistory">Clear</button>`,
    html: (p, e) => { const ids = Lib.recentlyPlayed(200).map(t => t.id); return `<div class="page-pad">${largeTitle('Recently Played')}${ids.length ? playButtons(ids) + trackList(e, ids, { key: 'played', album: true }) : '<p class="hint">Nothing played yet.</p>'}</div>`; },
    live: true,
  },
  favorites: {
    title: () => 'Favorites',
    html: (p, e) => { const ids = Lib.favoriteTracks().map(t => t.id); return `<div class="page-pad">${largeTitle('Favorites')}${ids.length ? playButtons(ids) + trackList(e, ids, { key: 'favorites', album: true }) : `<div class="empty small">${icon('heart', 'big-i')}<p>Tap the heart on Now Playing or in any song’s menu to keep it here.</p></div>`}</div>`; },
  },
  files: {
    title: () => 'Local Files',
    actions: (p, e) => L.tracks.length ? `<button class="link nav-link" data-act="selectMode">${e.sel ? 'Done' : 'Select'}</button>` : '',
    html: (p, e) => {
      const ts = [...L.tracks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const total = ts.reduce((s, t) => s + (t.blob?.size || t.size || 0), 0);
      const ids = ts.map(t => t.id);
      return `<div class="page-pad">${largeTitle('Local Files')}<p class="meta-line">${plural(ts.length, 'file')} · ${fmtBytes(total)} stored in this browser</p>
        <div class="notice glass subtle">${icon('info')}<p>AMB keeps its own copy of each song. Removing it from AMB never deletes your original file.</p></div>
        ${trackList(e, ids, { key: 'files', subFn: t => [t.name, (t.format || '').toUpperCase(), fmtBytes(t.blob?.size || t.size || 0)].filter(Boolean).join(' · ') })}</div>`;
    },
  },
  // ---------- DETAIL ----------
  album: {
    title: p => L.albums.get(p.key)?.title || 'Album',
    actions: p => `<button class="icon-btn" data-act="albumMenu" data-key="${esc(p.key)}" aria-label="Album options">${icon('more')}</button>`,
    html: (p, e) => {
      const a = L.albums.get(p.key);
      if (!a) return `<div class="page-pad"><p class="hint">This album is no longer in your library.</p></div>`;
      const art = Lib.artOf(Lib.get(a.artId || a.ids[0]), true);
      const meta = [a.genre, a.year].filter(Boolean).join(' · ');
      const multiDisc = new Set(a.ids.map(id => Lib.get(id)?.disc || 1)).size > 1;
      e.vl = null;
      const k = ctx('album:' + a.key, a.ids);
      let lastDisc = 0;
      const rows = a.ids.map((id, i) => {
        const t = Lib.get(id); let pre = '';
        if (multiDisc && (t.disc || 1) !== lastDisc) { lastDisc = t.disc || 1; pre = `<div class="disc">Disc ${lastDisc}</div>`; }
        return pre + songRow(t, { ctx: k, i, num: t.track || i + 1, sub: a.artists.size > 1 ? Lib.trackArtist(t) : '' });
      }).join('');
      return `<div class="page-pad detail">
        <div class="hero"><div class="hero-art">${img(art, '', a.title + ' artwork')}</div>
        <h1 class="large-title center">${esc(a.title)}</h1>
        <button class="hero-sub link" data-go="artist|${esc(a.artist === 'Various Artists' ? [...a.artists][0] : a.artist)}">${esc(a.artist)}</button>
        <p class="hero-meta">${esc([meta, plural(a.ids.length, 'song'), fmtDur(Lib.totalDuration(a.ids))].filter(Boolean).join(' · ').toUpperCase())}</p></div>
        ${playButtons(a.ids)}<div class="list numbered">${rows}</div></div>`;
    },
  },
  artist: {
    title: p => p.name,
    html: (p, e) => {
      const a = L.artists.get(p.name);
      if (!a) return `<div class="page-pad"><p class="hint">This artist is no longer in your library.</p></div>`;
      const albums = [...a.albums].map(k => L.albums.get(k)).filter(x => x && !x.single).sort((x, y) => (y.year || 0) - (x.year || 0));
      const ids = a.ids.length ? a.ids : albums.flatMap(x => x.ids);
      const played = ids.filter(id => Lib.plays(id) > 0).sort((x, y) => Lib.plays(y) - Lib.plays(x));
      const top = (played.length ? [...played, ...ids.filter(id => !played.includes(id))] : sortTracks(ids.map(Lib.get), 'title').map(t => t.id)).slice(0, 10);
      const rep = Lib.get(albums.find(x => x.artId)?.artId || ids[0]);
      e.vl = null;
      return `<div class="page-pad detail">
        <div class="hero artist-hero"><div class="hero-art round">${img(Lib.artOf(rep, true), '', '')}</div><h1 class="large-title center">${esc(a.name)}</h1>
        <p class="hero-meta">${esc([plural(ids.length, 'song'), albums.length ? plural(albums.length, 'album') : ''].filter(Boolean).join(' · ').toUpperCase())}</p></div>
        ${playButtons(ids)}
        ${sectionHead(played.length ? 'Top Songs' : 'Songs')}<div class="list">${top.map((id, i) => songRow(Lib.get(id), { ctx: ctx('artist-top:' + a.name, top), i, sub: [Lib.get(id).album, played.length && Lib.plays(id) ? plural(Lib.plays(id), 'play') : ''].filter(Boolean).join(' · ') })).join('')}</div>
        ${ids.length > 10 ? `<button class="link more-link" data-act="artistAll" data-name="${esc(a.name)}">All ${ids.length} songs</button>` : ''}
        ${albums.length ? sectionHead('Albums') + shelf(albums.map(albumTile)) : ''}</div>`;
    },
    live: true,
  },
  artistSongs: {
    title: p => p.name,
    html: (p, e) => { const a = L.artists.get(p.name); const ids = a ? sortTracks(a.ids.map(Lib.get).filter(Boolean), 'album').map(t => t.id) : []; return `<div class="page-pad">${largeTitle(p.name)}${playButtons(ids)}${trackList(e, ids, { key: 'artist-all:' + p.name, album: true })}</div>`; },
  },
  genre: {
    title: p => p.name,
    html: (p, e) => {
      const g = L.genres.get(p.name);
      if (!g) return `<div class="page-pad"><p class="hint">No songs in this genre anymore.</p></div>`;
      const ids = sortTracks(g.ids.map(Lib.get), 'artist').map(t => t.id);
      const albums = albumsOf(ids);
      return `<div class="page-pad">${largeTitle(g.name)}<p class="meta-line">${plural(ids.length, 'song')} · ${fmtDur(Lib.totalDuration(ids))}</p>${playButtons(ids)}
        ${albums.length > 1 ? sectionHead('Albums') + shelf(albums.map(albumTile)) : ''}${sectionHead('Songs')}${trackList(e, ids, { key: 'genre:' + g.name, album: true })}</div>`;
    },
  },
  playlist: {
    title: p => p.name,
    actions: (p, e) => L.playlists[p.name] ? (e.edit ? `<button class="link nav-link strong" data-act="plDone">Done</button>` : `<button class="icon-btn" data-act="playlistMenu" aria-label="Playlist options">${icon('more')}</button>`) : '',
    html: (p, e) => {
      const ids = L.playlists[p.name];
      if (!ids) return `<div class="page-pad"><p class="hint">This playlist was deleted.</p></div>`;
      const live = ids.filter(id => Lib.get(id));
      e.vl = null;
      const k = ctx('pl:' + p.name, live);
      return `<div class="page-pad detail">
        <div class="hero"><div class="hero-art">${collage(live)}</div><h1 class="large-title center">${esc(p.name)}</h1>
        <p class="hero-meta">${esc([plural(live.length, 'song'), fmtDur(Lib.totalDuration(live))].filter(Boolean).join(' · ').toUpperCase())}</p></div>
        ${e.edit ? `<p class="hint">Drag ${icon('grip', 'inline-i')} to reorder. Tap ${icon('x', 'inline-i')} to remove from this playlist.</p>` : playButtons(live, `<button class="btn glass-btn icon-only" data-act="plAdd" aria-label="Add songs">${icon('plus')}</button>`)}
        ${live.length ? `<div class="list ${e.edit ? 'editing' : ''}" id="plList">${live.map((id, i) => songRow(Lib.get(id), { ctx: k, i, grip: e.edit, remove: e.edit })).join('')}</div>`
          : `<div class="empty small"><p>This playlist is empty.</p><button class="btn glass-btn" data-act="plAdd">${icon('plus')}<span>Add Songs</span></button></div>`}</div>`;
    },
    mount: (el, p, e) => { if (e.edit) enableReorder($('#plList', el), (from, to) => { const arr = L.playlists[p.name].filter(id => Lib.get(id)); const [x] = arr.splice(from, 1); arr.splice(to, 0, x); L.playlists[p.name] = arr; Lib.savePlaylists(); }); },
  },
  mix: {
    title: p => Lib.mixById(p.id)?.title || 'Mix',
    html: (p, e) => {
      const m = Lib.mixById(p.id);
      if (!m) return `<div class="page-pad"><p class="hint">This mix needs a few more songs in your library.</p></div>`;
      e.vl = null;
      return `<div class="page-pad detail"><div class="hero"><div class="hero-art">${collage(m.ids)}</div><h1 class="large-title center">${esc(m.title)}</h1>
        <p class="hero-sub plain">${esc(m.sub)}</p><p class="hero-meta">${esc([plural(m.ids.length, 'song'), fmtDur(Lib.totalDuration(m.ids))].join(' · ').toUpperCase())} · MADE ON THIS DEVICE</p></div>
        ${playButtons(m.ids, `<button class="btn glass-btn icon-only" data-act="saveMix" data-id="${m.id}" aria-label="Save as playlist">${icon('addList')}</button>`)}${trackList(e, m.ids, { key: 'mix:' + m.id, album: true })}</div>`;
    },
  },
  radio: radioPage({ go, toast, openSheet, closeSheet, actionSheet, formSheet, E, largeTitle, markPlaying: () => markPlaying() }),
};

// ---------- search body ----------
function searchBody(q, e) {
  if (!q.trim()) {
    const rec = readLS('amb-recent-searches', []);
    const tileFor = (label, go, ids) => `<button class="browse glass" data-go="${go}">${collage(ids.length ? ids : [], 'browse-art')}<span><b>${label}</b><small>${ids.length ? plural(ids.length, 'item') : 'Empty'}</small></span></button>`;
    const allIds = L.tracks.map(t => t.id);
    const albumIds = realAlbums().map(a => a.artId || a.ids[0]);
    const plIds = Object.values(L.playlists).flat();
    const genreIds = [...L.genres.values()].map(g => g.ids[0]);
    return `${sectionHead('Browse Your Library')}<div class="browse-grid">
      ${tileFor('Songs', 'songs', allIds)}${tileFor('Albums', 'albums', albumIds)}${tileFor('Artists', 'artists', [...L.artists.values()].map(a => a.ids[0]).filter(Boolean))}
      ${tileFor('Playlists', 'playlists', plIds)}${tileFor('Genres', 'genres', genreIds)}${tileFor('Recently Added', 'recent', Lib.recentlyAdded(8).map(t => t.id))}</div>
      ${rec.length ? `<div class="sec-head"><h2>Recent Searches</h2><button class="link" data-act="clearRecent">Clear</button></div><div class="recent-list">${rec.map((r, i) => `<div class="recent-item"><button class="recent-q" data-act="useRecent" data-q="${esc(r)}">${icon('clock')}<span>${esc(r)}</span></button><button class="icon-btn" data-act="dropRecent" data-i="${i}" aria-label="Remove ${esc(r)} from recent searches">${icon('x')}</button></div>`).join('')}</div>` : ''}`;
  }
  const r = Lib.search(q);
  if (!r || (!r.songs.length && !r.albums.length && !r.artists.length && !r.playlists.length && !r.genres.length))
    return `<div class="empty small">${icon('search', 'big-i')}<p>No results for “${esc(q)}” in your library.</p></div>`;
  let h = '';
  const topHit = r.artists.find(a => a.name.toLowerCase() === q.trim().toLowerCase()) ? { kind: 'artist', v: r.artists[0] } : null;
  if (topHit) h += sectionHead('Top Result') + `<button class="top-hit glass" data-go="artist|${esc(topHit.v.name)}" data-rq>${img(Lib.artOf(Lib.get(topHit.v.ids[0])), 'avatar lg')}<span><b>${esc(topHit.v.name)}</b><small>Artist · ${plural(topHit.v.ids.length, 'song')}</small></span></button>`;
  if (r.songs.length) {
    const ids = r.songs.slice(0, 40).map(t => t.id);
    h += sectionHead('Songs') + `<div class="list" data-rq>${ids.map((id, i) => songRow(Lib.get(id), { ctx: ctx('search', ids), i, album: true })).join('')}</div>`;
  }
  if (r.albums.length) h += sectionHead('Albums') + `<div data-rq>${shelf(r.albums.slice(0, 20).map(albumTile))}</div>`;
  if (r.artists.length) h += sectionHead('Artists') + `<div class="list" data-rq>${r.artists.slice(0, 12).map(a => navRow({ go: 'artist|' + a.name, label: a.name, count: plural(a.ids.length, 'song'), art: img(Lib.artOf(Lib.get(a.ids[0])), 'avatar') })).join('')}</div>`;
  if (r.playlists.length) h += sectionHead('Playlists') + `<div class="list" data-rq>${r.playlists.map(n => navRow({ go: 'playlist|' + n, label: n, count: plural(L.playlists[n].length, 'song'), art: collage(L.playlists[n], 'mini-collage') })).join('')}</div>`;
  if (r.genres.length) h += sectionHead('Genres') + `<div class="list" data-rq>${r.genres.map(g => navRow({ go: 'genre|' + g.name, label: g.name, count: plural(g.ids.length, 'song') })).join('')}</div>`;
  return h;
}
function addRecent(q) {
  q = (q || '').trim(); if (!q) return;
  const r = readLS('amb-recent-searches', []).filter(x => x.toLowerCase() !== q.toLowerCase());
  r.unshift(q); writeLS('amb-recent-searches', r.slice(0, 8));
}

// ================= actions =================
function parseGo(s) {
  const i = s.indexOf('|'); const route = i < 0 ? s : s.slice(0, i); const v = i < 0 ? '' : s.slice(i + 1);
  const key = { album: 'key', artist: 'name', genre: 'name', playlist: 'name', mix: 'id', artistSongs: 'name' }[route];
  return [route, key ? { [key]: v } : {}];
}

document.addEventListener('click', ev => {
  const t = ev.target;
  const tabBtn = t.closest('[data-tab]');
  if (tabBtn) { closeNP(); switchTab(tabBtn.dataset.tab); return; }
  const sb = t.closest('[data-side]');
  if (sb) { const [r, p] = parseGo(sb.dataset.side); openFromSidebar(r, p); return; }
  const g = t.closest('[data-go]');
  if (g && !t.closest('#np')) {
    if (g.closest('[data-rq]') || g.hasAttribute('data-rq')) addRecent($('#q')?.value);
    const [r, p] = parseGo(g.dataset.go); go(r, p); return;
  }
  const a = t.closest('[data-act]');
  if (a && ACTIONS[a.dataset.act]) { ev.preventDefault(); ACTIONS[a.dataset.act](a, ev); return; }
  const pt = t.closest('[data-play-ctx]');
  if (pt) { const ids = ctxs.get(pt.dataset.playCtx) || [pt.dataset.id]; playFrom(ids, +pt.dataset.i || 0, pt.dataset.id); return; }
  const row = t.closest('.row.song');
  if (row && !t.closest('button, .grip') && !row.closest('.editing')) { rowTap(row); }
});
document.addEventListener('keydown', ev => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList?.contains('song') && ev.target.classList.contains('row')) { ev.preventDefault(); rowTap(ev.target); }
});
function rowTap(row) {
  const e = top();
  if (e.sel && row.closest('.page')) { toggleSel(e, row.dataset.id); return; }
  if (row.closest('[data-rq]')) addRecent($('#q')?.value);
  const id = row.dataset.id, ids = ctxs.get(row.dataset.ctx) || [id];
  const i = row.dataset.i !== undefined ? +row.dataset.i : ids.indexOf(id);
  if (row.closest('#queueList')) { E.jumpTo(+row.dataset.qi); return; }
  if (row.closest('#historyList')) { E.enqueueNext([id]); E.next(); return; }
  playFrom(ids, i, id);
}
function playFrom(ids, i, id) {
  if (E.S.id === id && ids[i] === id && E.S.queue[E.S.index] === id) { if (!E.S.playing) E.play(); openNP(); return; }
  E.playList(ids, i >= 0 ? i : 0);
  if (Lib.get(ids[i >= 0 ? i : 0])?.video) openNP();
}

const ACTIONS = {
  goHome: () => switchTab('home'),
  addMusic: () => addMusic(),
  settings: () => settingsSheet(),
  playAll: a => { const ids = ctxs.get(a.dataset.ctx) || []; E.S.shuffle && E.toggleShuffle(); E.playList(ids, 0); },
  shuffleAll: a => E.playList(ctxs.get(a.dataset.ctx) || [], 0, { shuffle: true }),
  songMenu: a => songMenu(a.dataset.id),
  libEdit: () => { const e = top(); e.edit = !e.edit; render(e, true); },
  libToggle: a => { const h = new Set(readLS('amb-lib-hidden', [])); const k = a.dataset.k; h.has(k) ? h.delete(k) : h.add(k); writeLS('amb-lib-hidden', [...h]); render(top(), true); },
  clearQ: () => { const i = $('#q'); i.value = ''; i.dispatchEvent(new Event('input')); i.focus(); },
  useRecent: a => { const i = $('#q'); i.value = a.dataset.q; i.dispatchEvent(new Event('input')); },
  dropRecent: a => { const r = readLS('amb-recent-searches', []); r.splice(+a.dataset.i, 1); writeLS('amb-recent-searches', r); $('#searchBody').innerHTML = searchBody('', top()); },
  clearRecent: () => { writeLS('amb-recent-searches', []); $('#searchBody').innerHTML = searchBody('', top()); },
  sortMenu: a => {
    const kind = a.dataset.kind, cur = readLS('amb-sort-' + kind, 'title');
    actionSheet({ title: 'Sort ' + (kind === 'songs' ? 'Songs' : 'Albums') + ' By', items: SORTS[kind].map(([k, l]) => ({ label: l, icon: k === cur ? 'check' : '', run: () => { writeLS('amb-sort-' + kind, k); render(top()); window.scrollTo(0, 0); } })) });
  },
  selectMode: () => { const e = top(); e.sel = e.sel ? null : new Set(); render(e, true); updateSelBar(); },
  newPlaylist: () => newPlaylist(),
  playlistMenu: () => playlistMenu(top().p.name),
  plDone: () => { const e = top(); e.edit = false; render(e, true); },
  plAdd: () => pickSongs(top().p.name),
  rowRemove: a => { const e = top(); const n = e.p.name; const live = L.playlists[n].filter(id => Lib.get(id)); live.splice(+a.dataset.i, 1); L.playlists[n] = live; Lib.savePlaylists(); },
  albumMenu: a => albumMenu(a.dataset.key),
  artistAll: a => go('artistSongs', { name: a.dataset.name }),
  saveMix: a => { const m = Lib.mixById(a.dataset.id); if (!m) return; const n = Lib.createPlaylist(m.title, m.ids); toast(`Saved as “${n}”`, { action: 'Open', onAction: () => go('playlist', { name: n }) }); },
  clearHistory: async () => { if (await confirmSheet({ title: 'Clear listening history?', msg: 'Play counts, Recently Played and history-based mixes reset. Your music and playlists stay.', ok: 'Clear History', danger: true })) { Lib.clearHistory(); toast('Listening history cleared'); } },
  selFav: () => bulk('fav'), selAdd: () => bulk('add'), selNext: () => bulk('next'), selRemove: () => bulk('remove'), selAll: () => bulk('all'),
  relink: a => relinkTrack(a.dataset.id),
  radioCustom: () => PAGES.radio.customStream(),
};

// ---------- selection mode ----------
function toggleSel(e, id) {
  e.sel.has(id) ? e.sel.delete(id) : e.sel.add(id);
  $$(`.row.song[data-id="${CSS.escape(id)}"]`, e.el).forEach(r => r.classList.toggle('selected', e.sel.has(id)));
  updateSelBar();
}
function updateSelBar() {
  const e = top(), bar = $('#selbar');
  const on = !!e.sel;
  document.body.classList.toggle('selecting', on);
  bar.hidden = !on;
  if (on) $('#selCount').textContent = e.sel.size ? `${e.sel.size} selected` : 'Select songs';
  $$('#selbar button[data-act]:not([data-act=selAll])').forEach(b => b.disabled = !e.sel?.size);
}
async function bulk(kind) {
  const e = top(); if (!e.sel) return;
  const ids = [...e.sel];
  if (kind === 'all') { const all = e.vl?.ids || $$('.row.song', e.el).map(r => r.dataset.id); const every = all.every(id => e.sel.has(id)); e.sel = every ? new Set() : new Set(all); render(e, true); updateSelBar(); return; }
  if (!ids.length) return;
  if (kind === 'fav') { const allFav = ids.every(Lib.isFav); ids.forEach(id => Lib.toggleFav(id, !allFav)); toast(allFav ? `Removed ${plural(ids.length, 'song')} from Favorites` : `Added ${plural(ids.length, 'song')} to Favorites`); }
  if (kind === 'next') { E.enqueueNext(ids); toast(`${plural(ids.length, 'song')} will play next`); }
  if (kind === 'add') return addToPlaylistSheet(ids, () => { e.sel = null; render(e, true); updateSelBar(); });
  if (kind === 'remove') {
    if (!await confirmSheet({ title: `Remove ${plural(ids.length, 'song')} from AMB?`, msg: 'They leave your AMB library and playlists. Your original files are not deleted.', ok: 'Remove from AMB', danger: true })) return;
    await Lib.removeTracks(ids); E.prune(); toast(`Removed ${plural(ids.length, 'song')}`);
  }
  e.sel = null; render(e, true); updateSelBar();
}

// ---------- reorder (drag handle) ----------
function enableReorder(list, onMove, rowSel = '.row') {
  if (!list) return;
  list.addEventListener('pointerdown', ev => {
    const grip = ev.target.closest('.grip'); if (!grip) return;
    ev.preventDefault();
    const row = grip.closest(rowSel); const rows = $$(rowSel, list); const from = rows.indexOf(row);
    const h = row.offsetHeight; const y0 = ev.clientY; let to = from;
    row.classList.add('dragging'); grip.setPointerCapture(ev.pointerId);
    const move = e2 => {
      const dy = e2.clientY - y0; row.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      rows.forEach((r, i) => { if (r === row) return; let s = 0; if (from < to && i > from && i <= to) s = -h; if (from > to && i < from && i >= to) s = h; r.style.transform = s ? `translateY(${s}px)` : ''; });
      // Auto-scroll near edges.
      const sc = row.closest('.sheet-body');
      if (sc) { const r = sc.getBoundingClientRect(); if (e2.clientY < r.top + 50) sc.scrollTop -= 8; else if (e2.clientY > r.bottom - 50) sc.scrollTop += 8; }
      else if (e2.clientY < 110) window.scrollBy(0, -8); else if (e2.clientY > innerHeight - 170) window.scrollBy(0, 8);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      rows.forEach(r => { r.style.transform = ''; }); row.classList.remove('dragging');
      if (to !== from) onMove(from, to);
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
}

// ================= menus =================
function songMenu(id) {
  const t = Lib.get(id); if (!t) return;
  const fav = Lib.isFav(id);
  const a = L.albums.get(Lib.albumKeyOf(t));
  const e = top();
  const inPlaylist = e.route === 'playlist' && L.playlists[e.p.name]?.includes(id) ? e.p.name : null;
  actionSheet({
    title: Lib.trackTitle(t), sub: [Lib.trackArtist(t), t.album].filter(Boolean).join(' · '), art: Lib.artOf(t),
    items: [
      { label: fav ? 'Remove from Favorites' : 'Favorite', icon: fav ? 'heartFill' : 'heart', run: () => { const on = Lib.toggleFav(id); toast(on ? 'Added to Favorites' : 'Removed from Favorites'); } },
      { label: 'Add to a Playlist…', icon: 'addList', run: () => addToPlaylistSheet([id]) },
      { label: 'Play Next', icon: 'playNext', run: () => { E.enqueueNext([id]); toast('Playing next'); } },
      { label: 'Play Last', icon: 'playLast', run: () => { E.enqueueLast([id]); toast('Added to the end of the queue'); } },
      { sep: true },
      a && !a.single ? { label: 'Go to Album', icon: 'album', run: () => go('album', { key: a.key }) } : null,
      { label: 'Go to Artist', icon: 'artist', run: () => go('artist', { name: Lib.trackArtist(t) }) },
      { label: 'Song Info', icon: 'info', run: () => songInfo(id) },
      { label: 'Edit Details', icon: 'edit', run: () => editSong(id) },
      (t.unavailable || !t.blob) ? { label: 'Re-link File…', icon: 'link', run: () => relinkTrack(id) } : null,
      { sep: true },
      inPlaylist ? { label: 'Remove from This Playlist', icon: 'x', run: () => { L.playlists[inPlaylist] = L.playlists[inPlaylist].filter(x => x !== id); Lib.savePlaylists(); } } : null,
      { label: 'Remove from AMB', icon: 'trash', danger: true, run: () => removeSong(id) },
    ],
  });
}
async function removeSong(id) {
  const t = Lib.get(id); if (!t) return;
  if (!await confirmSheet({ title: `Remove “${Lib.trackTitle(t)}” from AMB?`, msg: 'It leaves your AMB library, playlists and queue. Your original file is not deleted.', ok: 'Remove from AMB', danger: true })) return;
  await Lib.removeTracks([id]); E.prune(); toast('Removed from AMB');
}
function albumMenu(key) {
  const a = L.albums.get(key); if (!a) return;
  actionSheet({ title: a.title, sub: a.artist, art: Lib.artOf(Lib.get(a.artId || a.ids[0])), items: [
    { label: 'Play Next', icon: 'playNext', run: () => { E.enqueueNext(a.ids); toast('Album will play next'); } },
    { label: 'Play Last', icon: 'playLast', run: () => { E.enqueueLast(a.ids); toast('Album added to queue'); } },
    { label: 'Add to a Playlist…', icon: 'addList', run: () => addToPlaylistSheet(a.ids) },
    { label: 'Favorite All Songs', icon: 'heart', run: () => { a.ids.forEach(id => Lib.toggleFav(id, true)); toast('Album added to Favorites'); } },
    { label: 'Set Album Artwork…', icon: 'album', run: () => setAlbumArt(a) },
    { label: 'Go to Artist', icon: 'artist', run: () => go('artist', { name: a.artist === 'Various Artists' ? [...a.artists][0] : a.artist }) },
  ] });
}
function playlistMenu(name) {
  const ids = L.playlists[name]; if (!ids) return;
  actionSheet({ title: name, sub: plural(ids.length, 'song'), items: [
    { label: 'Add Songs…', icon: 'plus', run: () => pickSongs(name) },
    { label: 'Edit Order & Remove', icon: 'grip', disabled: !ids.length, run: () => { const e = top(); e.edit = true; render(e, true); } },
    { label: 'Play Next', icon: 'playNext', disabled: !ids.length, run: () => { E.enqueueNext(ids); toast('Playlist will play next'); } },
    { label: 'Play Last', icon: 'playLast', disabled: !ids.length, run: () => { E.enqueueLast(ids); toast('Playlist added to queue'); } },
    { label: 'Rename…', icon: 'edit', run: async () => { const v = await formSheet({ title: 'Rename Playlist', fields: [{ name: 'name', label: 'Name', value: name }] }); if (v?.name) { const n = Lib.renamePlaylist(name, v.name); const e = top(); e.p.name = n; render(e, true); updateNav(); } } },
    { sep: true },
    { label: 'Delete Playlist', icon: 'trash', danger: true, run: async () => { if (await confirmSheet({ title: `Delete “${name}”?`, msg: 'The songs stay in your library.', ok: 'Delete Playlist', danger: true })) { Lib.deletePlaylist(name); back(); toast('Playlist deleted'); } } },
  ] });
}
async function newPlaylist(ids = [], then) {
  const v = await formSheet({ title: 'New Playlist', fields: [{ name: 'name', label: 'Name', placeholder: 'Playlist name', value: '' }], ok: 'Create' });
  if (!v) return;
  const n = Lib.createPlaylist(v.name || 'New Playlist', ids);
  toast(ids.length ? `Added to “${n}”` : `Created “${n}”`, { action: 'Open', onAction: () => go('playlist', { name: n }) });
  then?.(n);
  if (!ids.length && top().route === 'playlists') go('playlist', { name: n });
}
function addToPlaylistSheet(ids, then) {
  const names = Object.keys(L.playlists);
  openSheet({ title: 'Add to Playlist', html: `<div class="list">
    <button class="nav-row new-row" data-pl-new><span class="nr-icon accent-bg">${icon('plus')}</span><span class="nr-label accent">New Playlist…</span></button>
    ${names.map(n => `<button class="nav-row" data-pl="${esc(n)}">${collage(L.playlists[n], 'mini-collage')}<span class="nr-label">${esc(n)}</span><span class="nr-count">${L.playlists[n].length}</span></button>`).join('')}</div>`,
    onMount: b => {
      b.querySelector('[data-pl-new]').onclick = () => { closeSheet(); setTimeout(() => newPlaylist(ids, then), 30); };
      b.querySelectorAll('[data-pl]').forEach(btn => btn.onclick = () => {
        const n = btn.dataset.pl; const have = new Set(L.playlists[n]); const add = ids.filter(id => !have.has(id));
        closeSheet();
        if (add.length) { Lib.addToPlaylist(n, add); toast(`Added to “${n}”`); } else toast(`Already in “${n}”`);
        then?.(n);
      });
    } });
}
function pickSongs(name) {
  const chosen = new Set();
  const list = ts => ts.slice(0, 300).map(t => `<button class="pick-row ${chosen.has(t.id) ? 'on' : ''}" data-id="${t.id}">${img(Lib.artOf(t), 'thumb')}<span class="rt"><b>${esc(Lib.trackTitle(t))}</b><small>${esc(Lib.trackArtist(t))}</small></span><span class="tick">${icon('check')}</span></button>`).join('');
  const have = new Set(L.playlists[name] || []);
  const pool = () => sortTracks(L.tracks.filter(t => !have.has(t.id)), 'title');
  openSheet({ title: `Add to “${esc(name)}”`, cls: 'tall', headerRight: `<button class="link strong" data-pick-done>Add</button>`,
    html: `<label class="search-field glass small">${icon('search')}<input type="search" placeholder="Search your songs" data-pick-q autocomplete="off"></label><div class="pick-list">${list(pool())}</div>`,
    onMount: (b, sheet) => {
      const q = b.querySelector('[data-pick-q]'), box = b.querySelector('.pick-list');
      q.oninput = () => { const r = Lib.search(q.value); box.innerHTML = list(r ? r.songs.filter(t => !have.has(t.id)) : pool()); };
      box.onclick = ev => { const r = ev.target.closest('.pick-row'); if (!r) return; const id = r.dataset.id; chosen.has(id) ? chosen.delete(id) : chosen.add(id); r.classList.toggle('on', chosen.has(id)); sheet.querySelector('[data-pick-done]').textContent = chosen.size ? `Add ${chosen.size}` : 'Add'; };
      sheet.querySelector('[data-pick-done]').onclick = () => { closeSheet(); if (chosen.size) { Lib.addToPlaylist(name, [...chosen]); toast(`Added ${plural(chosen.size, 'song')}`); } };
    } });
}
function songInfo(id) {
  const t = Lib.get(id); if (!t) return;
  const rows = [
    ['Title', Lib.trackTitle(t)], ['Artist', Lib.trackArtist(t)], ['Album', t.album], ['Album Artist', t.albumArtist], ['Genre', t.genre], ['Year', t.year || ''],
    ['Track', t.track ? t.track + (t.disc ? ` · Disc ${t.disc}` : '') : ''], ['Duration', t.duration ? fmtTime(t.duration) : ''],
    ['File', t.name], ['Format', (t.format || '').toUpperCase()], ['Size', fmtBytes(t.blob?.size || t.size || 0)],
    ['Bit rate', t.duration && (t.blob?.size || t.size) ? Math.round((t.blob?.size || t.size) * 8 / t.duration / 1000) + ' kbps (avg)' : ''],
    ['Added', t.added ? new Date(t.added).toLocaleString() : ''], ['Plays', String(Lib.plays(id))], ['Last played', Lib.lastPlayed(id) ? new Date(Lib.lastPlayed(id)).toLocaleString() : 'Never'],
    ['Lyrics', t.lyrics ? (parseLRC(t.lyrics) ? 'Synced' : 'Plain text') : 'None'], ['Status', t.unavailable || !t.blob ? 'Unavailable — re-link the file' : t.sessionOnly ? 'This session only' : 'Stored in AMB'],
  ].filter(r => r[1] !== '' && r[1] != null);
  openSheet({ title: 'Song Info', html: `<div class="info-art">${img(Lib.artOf(t, true))}</div><dl class="info">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="play-row"><button class="btn glass-btn" data-edit>${icon('edit')}<span>Edit Details</span></button></div>`,
    onMount: b => { b.querySelector('[data-edit]').onclick = () => { closeSheet(); setTimeout(() => editSong(id), 30); }; } });
}
async function editSong(id) {
  const t = Lib.get(id); if (!t) return;
  const v = await formSheet({ title: 'Edit Details', ok: 'Save', note: 'Changes apply inside AMB only. Your original file is not modified.', fields: [
    { name: 'title', label: 'Display Title', value: t.title }, { name: 'artist', label: 'Artist', value: t.artist }, { name: 'album', label: 'Album', value: t.album },
    { name: 'albumArtist', label: 'Album Artist', value: t.albumArtist }, { name: 'genre', label: 'Genre', value: t.genre },
    { name: 'year', label: 'Year', value: t.year || '', inputmode: 'numeric' }, { name: 'track', label: 'Track Number', value: t.track || '', inputmode: 'numeric' },
    { name: 'art', label: 'Artwork', type: 'file', accept: 'image/*' },
    { name: 'lyrics', label: 'Lyrics (plain text or synced LRC)', type: 'textarea', value: t.lyrics, placeholder: '[00:12.00] First line…' },
  ] });
  if (!v) return;
  Object.assign(t, { title: v.title || t.title, artist: v.artist, album: v.album, albumArtist: v.albumArtist, genre: v.genre, year: parseInt(v.year) || 0, track: parseInt(v.track) || 0, lyrics: v.lyrics });
  if (v.art) { const { makeThumb } = await import('./meta.js'); t.art = v.art; t.thumb = await makeThumb(v.art); }
  try { await Lib.saveTrack(t); toast('Details saved'); } catch { toast('Couldn’t save changes to storage', { kind: 'warn' }); }
  if (E.S.id === id) { E.updateMediaSession(); paintTrack(); }
}
async function setAlbumArt(a) {
  const v = await formSheet({ title: 'Album Artwork', ok: 'Apply to Album', fields: [{ name: 'art', label: 'Choose an image', type: 'file', accept: 'image/*' }] });
  if (!v?.art) return;
  const { makeThumb } = await import('./meta.js');
  const th = await makeThumb(v.art);
  for (const id of a.ids) { const t = Lib.get(id); t.art = v.art; t.thumb = th; try { await Lib.saveTrack(t); } catch {} }
  toast('Artwork updated'); if (a.ids.includes(E.S.id)) { E.updateMediaSession(); paintTrack(); }
}
function relinkTrack(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; await Lib.relink(id, f); toast('File re-linked'); if (E.S.id === id) E.load(id); };
  inp.click();
}

// ================= import =================
const fileInput = $('#fileInput'), folderInput = $('#folderInput');
const folderOK = 'webkitdirectory' in folderInput && !/iPhone|iPad|iPod/.test(navigator.userAgent) && matchMedia('(hover:hover)').matches;
function addMusic() {
  if (!folderOK) { fileInput.click(); return; }
  actionSheet({ title: 'Add Music', sub: 'Songs are copied into AMB on this device. Nothing is uploaded.', items: [
    { label: 'Choose Files…', icon: 'song', run: () => fileInput.click() },
    { label: 'Choose a Folder…', icon: 'folder', run: () => folderInput.click() },
  ] });
}
let importing = false;
async function runImport(files) {
  if (!files?.length) return;
  if (importing) { toast('An import is already running'); return; }
  importing = true;
  const bar = $('#importBar'); bar.hidden = false; document.body.classList.add('importing');
  const set = (i, n, name) => { $('#importText').textContent = `Importing ${i} of ${n}`; $('#importName').textContent = name; $('#importFill').style.transform = `scaleX(${i / n})`; };
  set(0, files.length, '');
  try {
    const r = await Lib.importFiles(files, set);
    const parts = [];
    if (r.added) { const v = r.videos || 0, n = r.added - v; parts.push([n ? plural(n, 'song') : '', v ? plural(v, 'video') : ''].filter(Boolean).join(' and ') + ' added'); }
    if (r.dup) parts.push(`${r.dup} already in AMB`);
    if (r.unsupported) parts.push(`${r.unsupported} can’t play here`);
    if (r.failed) parts.push(`${r.failed} failed`);
    if (r.skipped) parts.push(`${r.skipped} not audio`);
    toast(parts.join(' · ') || 'No audio files found', { kind: r.added ? '' : 'warn', action: r.added ? 'View' : '', onAction: () => { switchTab('library'); go('recent'); } });
    if (r.sessionOnly) toast(`${plural(r.sessionOnly, 'song')} couldn’t be saved (storage full). They’ll play this session only.`, { kind: 'warn', ms: 7000 });
  } catch (e) { console.error(e); toast('Import stopped. Your existing library is unchanged.', { kind: 'warn' }); }
  finally { importing = false; bar.hidden = true; document.body.classList.remove('importing'); fileInput.value = ''; folderInput.value = ''; }
}
fileInput.onchange = () => runImport([...fileInput.files]);
folderInput.onchange = () => runImport([...folderInput.files]);
// Desktop drag & drop.
window.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('drop'); } });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drop'); });
window.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop'); runImport([...(e.dataTransfer?.files || [])]); });

// ================= settings =================
async function settingsSheet() {
  const s = await Lib.storageInfo();
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const pct = s.quota ? Math.min(100, (s.usage / s.quota) * 100) : 0;
  openSheet({ title: 'Settings', cls: 'tall', html: `
    <div class="set-brand"><img src="${WOLF}" alt=""><div><b>Anthony's Music Box</b><small>Private local library · v2.3.1</small></div></div>
    <h3 class="set-h">Library</h3>
    <div class="group glass">
      <div class="set-row"><span>Songs</span><b>${L.tracks.length.toLocaleString()}</b></div>
      <div class="set-row"><span>Albums · Artists</span><b>${realAlbums().length} · ${L.artists.size}</b></div>
      <div class="set-row"><span>Playlists</span><b>${Object.keys(L.playlists).length}</b></div>
      <div class="set-row col"><span>Storage used</span><b>${fmtBytes(s.usage)}${s.quota ? ` of ${fmtBytes(s.quota)}` : ''}</b><div class="meter"><i style="width:${pct.toFixed(1)}%"></i></div></div>
      <div class="set-row"><span>Protected from cleanup</span><b>${!L.persistent ? 'Unavailable' : s.persisted ? 'Yes' : 'Not yet'}</b></div>
      ${L.persistent && !s.persisted && navigator.storage?.persist ? `<button class="set-row btnrow" data-s="persist"><span class="accent">Ask the browser to keep my library</span></button>` : ''}
    </div>
    <h3 class="set-h">Backup</h3>
    <div class="group glass">
      <button class="set-row btnrow" data-s="export"><span>Export playlists & favorites</span>${icon('download')}</button>
      <button class="set-row btnrow" data-s="import"><span>Restore from a backup file</span>${icon('upload')}</button>
    </div>
    <p class="set-note">A backup holds playlists, favorites and play history, not the songs themselves. Keep your original music files: clearing website data, or the browser freeing up space, can remove AMB’s copies.</p>
    <h3 class="set-h">Playback on ${iOS ? 'iPhone' : 'this device'}</h3>
    <div class="set-note glass-note">
      ${iOS ? `<p>${standalone ? 'Running as a Home Screen app.' : 'For the best experience, open this page in Safari, tap <b>Share → Add to Home Screen</b>, then import music inside the installed app. Each has its own library.'}</p>
      <p>Lock-screen controls and background playback work while iOS keeps the app alive. iOS may pause web audio if the app is closed from the app switcher, during calls, or when memory is low. Use the device buttons for volume, and Control Center to choose speakers or headphones.</p>`
      : `<p>Keyboard: <b>Space</b> play/pause · <b>←/→</b> seek 10s · <b>Shift+←/→</b> previous/next · <b>/</b> search.</p><p>Media keys and system media controls are supported where your browser provides them.</p>`}
      <p>Music, file names and listening history stay on this device. Only Live Radio uses the internet, and only when you open it.</p>
    </div>
    ${E.pipSupported ? `<h3 class="set-h">Video</h3>
    <div class="group glass"><button class="set-row btnrow" data-s="autopip" role="switch" aria-checked="${readLS('amb-auto-pip', true)}"><span>Picture in Picture when leaving a video</span><span class="switch ${readLS('amb-auto-pip', true) ? 'on' : ''}"><i></i></span></button></div>` : ''}
    <h3 class="set-h">Danger zone</h3>
    <div class="group glass">
      <button class="set-row btnrow" data-s="history"><span>Clear listening history</span></button>
      <button class="set-row btnrow danger" data-s="wipe"><span>Remove all songs from AMB</span></button>
    </div>`,
    onMount: b => {
      b.onclick = async ev => {
        const k = ev.target.closest('[data-s]')?.dataset.s; if (!k) return;
        if (k === 'persist') { const ok = await navigator.storage.persist().catch(() => false); toast(ok ? 'Your library is protected from automatic cleanup' : 'The browser declined. Adding AMB to your Home Screen usually helps.'); closeSheet(); }
        if (k === 'export') exportBackup();
        if (k === 'import') importBackup();
        if (k === 'history') { closeSheet(); ACTIONS.clearHistory(); }
        if (k === 'autopip') { const v = !readLS('amb-auto-pip', true); writeLS('amb-auto-pip', v); const b2 = ev.target.closest('[data-s]'); b2.setAttribute('aria-checked', v); b2.querySelector('.switch').classList.toggle('on', v); }
        if (k === 'wipe') {
          closeSheet();
          if (await confirmSheet({ title: 'Remove every song from AMB?', msg: 'Your AMB library, queue and playlist contents are cleared on this device. Your original files are not deleted.', ok: 'Remove All', danger: true })) {
            E.stop(); await Lib.removeTracks(L.tracks.map(t => t.id)); toast('Library cleared');
          }
        }
      };
    } });
}
function exportBackup() {
  const sig = id => { const t = Lib.get(id); return t ? { sig: t.sig || '', name: t.name, title: t.title, artist: t.artist } : null; };
  const data = { app: 'AMB', version: 2, exported: new Date().toISOString(),
    playlists: Object.fromEntries(Object.entries(L.playlists).map(([n, ids]) => [n, ids.map(sig).filter(Boolean)])),
    favorites: [...L.favorites].map(sig).filter(Boolean),
    stats: Object.fromEntries(Object.entries(L.stats).map(([id, s]) => [JSON.stringify(sig(id)), s]).filter(([k]) => k !== 'null')) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `AMB-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup saved');
}
function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (d.app !== 'AMB') throw new Error('Not an AMB backup');
      const find = ref => ref && (L.tracks.find(t => ref.sig && t.sig === ref.sig) || L.tracks.find(t => t.name === ref.name) || L.tracks.find(t => t.title === ref.title && t.artist === ref.artist));
      let pl = 0, missing = 0;
      for (const [n, refs] of Object.entries(d.playlists || {})) {
        const ids = refs.map(find).filter(Boolean).map(t => t.id); missing += refs.length - ids.length;
        const name = L.playlists[n] ? Lib.uniqueName(n) : n; L.playlists[name] = ids; pl++;
      }
      Lib.savePlaylists();
      (d.favorites || []).map(find).filter(Boolean).forEach(t => L.favorites.add(t.id)); Lib.saveFavorites();
      for (const [k, s] of Object.entries(d.stats || {})) { try { const t = find(JSON.parse(k)); if (t) L.stats[t.id] = s; } catch {} }
      Lib.saveStats();
      closeSheet(); toast(`Restored ${plural(pl, 'playlist')}${missing ? ` · ${missing} songs not in this library` : ''}`);
    } catch (e) { toast('That file isn’t a valid AMB backup', { kind: 'warn' }); }
  };
  inp.click();
}

// ================= mini-player & Now Playing =================
const np = $('#np'), mini = $('#mini');
let npOpen = false;
function openNP() {
  if (npOpen || (!E.S.id && !E.S.station)) return;
  npOpen = true; saveScroll();
  np.hidden = false; np.setAttribute('aria-hidden', 'false');
  document.body.classList.add('np-open');
  requestAnimationFrame(() => np.classList.add('open'));
  setTimeout(() => $('#npClose').focus({ preventScroll: true }), 50);
  history.pushState({ np: 1 }, '');
}
function closeNP(fromPop) {
  if (!npOpen) return;
  npOpen = false;
  np.classList.remove('open'); np.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('np-open');
  np.style.transform = '';
  setTimeout(() => { if (!npOpen) np.hidden = true; }, reduceMotion() ? 0 : 400);
  if (lyricsOn) toggleLyrics(false);
  // Leaving a playing video keeps it on screen in Picture in Picture.
  if (E.isVideo() && E.S.playing && E.pipSupported && !E.inPip() && readLS('amb-auto-pip', true)) E.togglePip(true);
  if (!fromPop && history.state?.np) history.back();
  mini.querySelector('.mini-open')?.focus({ preventScroll: true });
}
window.addEventListener('popstate', () => { if (sheetOpen()) closeSheet(); if (npOpen) closeNP(true); });

// Drag-down to dismiss Now Playing.
(() => {
  let y0 = null, dy = 0, t0 = 0;
  np.addEventListener('pointerdown', e => {
    if (e.target.closest('button, .rail, #lyricsView, input') || lyricsOn) return;
    y0 = e.clientY; dy = 0; t0 = Date.now();
  });
  window.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); if (dy > 8) { np.style.transition = 'none'; np.style.transform = `translateY(${dy}px)`; } });
  const end = () => { if (y0 === null) return; y0 = null; np.style.transition = ''; const v = dy / Math.max(1, Date.now() - t0); if (dy > 150 || (v > 0.9 && dy > 50)) closeNP(); else np.style.transform = ''; };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
})();

$('#npClose').onclick = () => closeNP();
mini.querySelector('.mini-open').onclick = () => openNP();
$('#miniPlay').onclick = () => E.toggle();
$('#miniNext').onclick = () => E.next();
$('#npPlay').onclick = () => E.toggle();
$('#npNext').onclick = () => E.next();
$('#npPrev').onclick = () => E.prev();
$('#npFav').onclick = () => { if (!E.S.id) return; const on = Lib.toggleFav(E.S.id); paintFav(); toast(on ? 'Added to Favorites' : 'Removed from Favorites'); };
$('#npArtist').onclick = () => { const t = Lib.get(E.S.id); if (!t) return; closeNP(); go('artist', { name: Lib.trackArtist(t) }); };
$('#npQueue').onclick = () => queueSheet();
$('#npLyrics').onclick = () => toggleLyrics();
$('#npOutput').onclick = () => E.showOutputPicker();
$('#npPip').onclick = () => E.togglePip();
$('#miniPip').onclick = () => E.togglePip();
E.videoEl.addEventListener('dblclick', () => E.fullscreen());
$('#npModes').onclick = () => queueSheet();
$('#npMore').onclick = () => {
  if (E.S.station) return radioStationMenu();
  const id = E.S.id; const t = Lib.get(id); if (!t) return;
  const fav = Lib.isFav(id); const a = L.albums.get(Lib.albumKeyOf(t));
  const sl = E.S.sleepAt;
  actionSheet({ title: Lib.trackTitle(t), sub: Lib.trackArtist(t), art: Lib.artOf(t), items: [
    { label: fav ? 'Remove from Favorites' : 'Favorite', icon: fav ? 'heartFill' : 'heart', run: () => { Lib.toggleFav(id); paintFav(); } },
    { label: 'Add to a Playlist…', icon: 'addList', run: () => addToPlaylistSheet([id]) },
    { label: 'Play Next', icon: 'playNext', run: () => { E.enqueueNext([id]); toast('Playing next'); } },
    { label: 'Play Last', icon: 'playLast', run: () => { E.enqueueLast([id]); toast('Added to the end of the queue'); } },
    { sep: true },
    t.video && E.pipSupported ? { label: E.inPip() ? 'Exit Picture in Picture' : 'Picture in Picture', icon: 'pip', run: () => E.togglePip() } : null,
    t.video ? { label: 'Full Screen', icon: 'expand', run: () => E.fullscreen() } : null,
    a && !a.single ? { label: 'Go to Album', icon: 'album', run: () => { closeNP(); go('album', { key: a.key }); } } : null,
    { label: 'Go to Artist', icon: 'artist', run: () => { closeNP(); go('artist', { name: Lib.trackArtist(t) }); } },
    { label: 'Song Info', icon: 'info', run: () => songInfo(id) },
    { label: 'Rename / Edit Details', icon: 'edit', run: () => editSong(id) },
    { label: sl ? 'Sleep Timer: ' + (sl === -1 ? 'End of Song' : 'On') : 'Sleep Timer', icon: 'moon', run: sleepSheet },
    { sep: true },
    { label: 'Remove from AMB', icon: 'trash', danger: true, run: () => removeSong(id) },
  ] });
};
function radioStationMenu() {
  const st = E.S.station;
  actionSheet({ title: st.name, sub: 'Live Radio', items: [
    { label: 'Sleep Timer', icon: 'moon', run: sleepSheet },
    st.homepage ? { label: 'Open Station Website', icon: 'globe', run: () => window.open(st.homepage, '_blank', 'noopener') } : null,
    { label: 'Stop Radio', icon: 'x', danger: true, run: () => { E.stop(); closeNP(); } },
  ] });
}
function sleepSheet() {
  const opts = [[0, 'Off'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [-1, 'End of current song']];
  actionSheet({ title: 'Sleep Timer', sub: 'Pauses playback. Timing depends on the browser staying active.', items: opts.map(([m, l]) => ({ label: l, icon: (m === 0 && !E.S.sleepAt) || (m === -1 && E.S.sleepAt === -1) ? 'check' : '', run: () => { E.setSleep(m); toast(m ? `Sleep timer: ${l}` : 'Sleep timer off'); } })) });
}

// seek & volume sliders
let scrubbing = false;
const seekCtl = slider($('#seekRail'), {
  label: 'Playback position', step: 0.02,
  get: () => (E.S.duration ? E.S.time / E.S.duration : 0),
  onInput: v => { scrubbing = true; const d = E.S.duration; $('#npElapsed').textContent = fmtTime(v * d); $('#npRemain').textContent = '-' + fmtTime(d - v * d); },
  onCommit: v => { scrubbing = false; E.seek(v * E.S.duration); },
});
const volCtl = slider($('#volRail'), { label: 'Volume', step: 0.05, get: () => E.S.volume, onInput: v => E.setVolume(v), onCommit: v => E.setVolume(v) });

// Lyrics
let lyricsOn = false, lrc = null, lrcIdx = -1;
function toggleLyrics(force) {
  lyricsOn = force ?? !lyricsOn;
  np.classList.toggle('lyrics-on', lyricsOn);
  $('#npLyrics').classList.toggle('on', lyricsOn);
  $('#npLyrics').setAttribute('aria-pressed', lyricsOn);
  $('#lyricsView').hidden = !lyricsOn;
  if (lyricsOn) paintLyrics();
}
function paintLyrics() {
  const box = $('#lyricsView'); const t = Lib.get(E.S.id);
  lrc = t?.lyrics ? parseLRC(t.lyrics) : null; lrcIdx = -1;
  if (!t?.lyrics) {
    box.innerHTML = `<div class="no-lyrics">${icon('lyrics', 'big-i')}<b>No lyrics for this song</b><p>Lyrics embedded in your files show here automatically. You can also paste them, synced or plain, in Edit Details.</p><button class="btn glass-btn" data-lyr-edit>${icon('edit')}<span>Add Lyrics</span></button></div>`;
    box.querySelector('[data-lyr-edit]').onclick = () => editSong(t.id);
    return;
  }
  box.innerHTML = lrc ? `<div class="lrc">${lrc.map((l, i) => `<p data-t="${l.t}" data-i="${i}">${esc(l.text) || '♪'}</p>`).join('')}</div>`
    : `<div class="lrc plain">${t.lyrics.split(/\n/).map(l => `<p>${esc(l) || '&nbsp;'}</p>`).join('')}</div>`;
  if (lrc) box.querySelectorAll('p').forEach(p => p.onclick = () => E.seek(+p.dataset.t));
  syncLyrics(true);
}
function syncLyrics(force) {
  if (!lyricsOn || !lrc) return;
  const t = E.S.time + 0.15; let i = -1;
  for (let k = 0; k < lrc.length; k++) { if (lrc[k].t <= t) i = k; else break; }
  if (i === lrcIdx && !force) return;
  lrcIdx = i;
  const box = $('#lyricsView');
  box.querySelectorAll('p.on').forEach(p => p.classList.remove('on'));
  const cur = box.querySelector(`p[data-i="${i}"]`);
  if (cur) { cur.classList.add('on'); cur.scrollIntoView({ block: 'center', behavior: reduceMotion() || force ? 'auto' : 'smooth' }); }
}

// Queue sheet
function queueSheet() {
  if (E.S.station) return;
  const draw = body => {
    const S = E.S, cur = Lib.get(S.id);
    const up = S.queue.slice(S.index + 1);
    const hist = [...new Set(S.history.slice(-12).reverse())].filter(id => id !== S.id).slice(0, 8);
    body.innerHTML = `
      ${cur ? `<div class="q-now">${img(Lib.artOf(cur), 'thumb')}<span class="rt"><b>${esc(Lib.trackTitle(cur))}</b><small>${esc([Lib.trackArtist(cur), 'Now Playing'].join(' · '))}</small></span><span class="eq on"><i></i><i></i><i></i></span></div>` : ''}
      <div class="q-modes">
        <button class="mode ${S.shuffle ? 'on' : ''}" data-q="shuffle" aria-pressed="${S.shuffle}" aria-label="Shuffle ${S.shuffle ? 'on' : 'off'}">${icon('shuffle')}<span>Shuffle</span></button>
        <button class="mode ${S.repeat ? 'on' : ''}" data-q="repeat" aria-pressed="${!!S.repeat}" aria-label="Repeat ${['off', 'all', 'one'][S.repeat]}">${icon(S.repeat === 2 ? 'repeat1' : 'repeat')}<span>${['Repeat', 'Repeat All', 'Repeat One'][S.repeat]}</span></button>
      </div>
      <div class="q-head"><h3>Up Next <small>${up.length ? plural(up.length, 'song') + ' · ' + fmtDur(Lib.totalDuration(up)) : ''}</small></h3></div>
      ${up.length ? `<div class="list q-list" id="queueList">${up.map((id, k) => { const t = Lib.get(id); return t ? `<div class="row song q-row" data-id="${id}" data-qi="${S.index + 1 + k}" tabindex="0">
          <span class="lead">${img(Lib.artOf(t), 'thumb')}</span><span class="rt"><b>${esc(Lib.trackTitle(t))}</b><small>${esc(Lib.trackArtist(t))}</small></span>
          <button class="icon-btn q-del" data-qdel="${S.index + 1 + k}" aria-label="Remove ${esc(Lib.trackTitle(t))} from queue">${icon('x')}</button>
          <span class="grip" aria-label="Drag to reorder">${icon('grip')}</span></div>` : ''; }).join('')}</div>`
        : `<p class="hint">${S.repeat === 1 ? 'Repeat All is on. The queue starts over after this song.' : 'Nothing queued. Use Play Next or Play Last on any song.'}</p>`}
      ${hist.length ? `<div class="q-head"><h3>History</h3></div><div class="list q-list hist" id="historyList">${hist.map(id => { const t = Lib.get(id); return `<div class="row song q-row" data-id="${id}" tabindex="0"><span class="lead">${img(Lib.artOf(t), 'thumb')}</span><span class="rt"><b>${esc(Lib.trackTitle(t))}</b><small>${esc(Lib.trackArtist(t))}</small></span></div>`; }).join('')}</div>` : ''}`;
    enableReorder($('#queueList', body), (from, to) => E.move(S.index + 1 + from, S.index + 1 + to));
    markPlaying();
  };
  const body = openSheet({ title: 'Playing Next', cls: 'tall queue', headerRight: `<button class="link" data-qclear>Clear</button>`,
    onMount: (b, sheet) => {
      draw(b);
      sheet.querySelector('[data-qclear]').onclick = () => { E.clearUpNext(); toast('Up Next cleared'); };
      b.onclick = ev => {
        const m = ev.target.closest('[data-q]'); if (m) { m.dataset.q === 'shuffle' ? E.toggleShuffle() : E.cycleRepeat(); return; }
        const d = ev.target.closest('[data-qdel]'); if (d) { const row = d.closest('.row'); row.classList.add('leaving'); setTimeout(() => E.removeAt(+d.dataset.qdel), 160); }
      };
      // Swipe left on a queue row to remove it.
      let sx = null, row = null;
      b.addEventListener('pointerdown', ev => { const r = ev.target.closest('#queueList .row'); if (!r || ev.target.closest('.grip, button')) return; sx = ev.clientX; row = r; });
      b.addEventListener('pointermove', ev => { if (sx === null) return; const dx = Math.min(0, ev.clientX - sx); if (dx < -10) { row.style.transform = `translateX(${dx}px)`; row.classList.add('swiping'); } });
      const up = ev => { if (sx === null) return; const dx = ev.clientX - sx; const r = row; sx = null; row = null; if (dx < -110) { r.classList.add('leaving'); setTimeout(() => E.removeAt(+r.dataset.qi), 160); } else { r.style.transform = ''; setTimeout(() => r.classList.remove('swiping'), 50); } };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      const unsub = E.subscribe((S, kind) => { if (kind === 'queue' || kind === 'track') draw(b); });
      queueUnsub = unsub;
    },
    onClose: () => { queueUnsub?.(); queueUnsub = null; } });
  return body;
}
let queueUnsub = null;

// ---------- painting ----------
let lastArt = '', bgFlip = false;
function paintTrack() {
  const S = E.S, t = Lib.get(S.id), st = S.station;
  const has = !!(t || st);
  document.body.classList.toggle('has-mini', has);
  mini.hidden = !has;
  if (!has) { if (npOpen) closeNP(); return; }
  const title = st ? st.name : Lib.trackTitle(t);
  const artist = st ? 'Live Radio' + (st.tags ? ' · ' + st.tags.split(',').slice(0, 2).join(', ') : '') : Lib.trackArtist(t);
  const art = st ? (st.favicon || 'assets/default-cover.webp') : Lib.artOf(t, true);
  const small = st ? art : Lib.artOf(t);
  $('#miniArt').src = small; $('#miniTitle').textContent = title; $('#miniArtist').textContent = artist;
  $('#npTitle').textContent = title; $('#npArtist').textContent = artist;
  $('#npArtist').disabled = !!st;
  $('#npContext').textContent = st ? 'LIVE RADIO' : t.video ? 'VIDEO' : (t.album || '').toUpperCase();
  np.classList.toggle('radio', !!st);
  if (art !== lastArt) {
    lastArt = art;
    const im = $('#npArt');
    if (!reduceMotion() && npOpen) { im.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' }); }
    im.src = art;
    im.alt = `${title} artwork`;
    const layers = $$('.np-bgimg');
    bgFlip = !bgFlip;
    const a = layers[bgFlip ? 0 : 1], b = layers[bgFlip ? 1 : 0];
    a.src = small; a.classList.add('on'); b.classList.remove('on');
    colorOf(small).then(([r, g, b2]) => {
      const dim = (v, k) => Math.round(v * k);
      document.documentElement.style.setProperty('--tint', `${r}, ${g}, ${b2}`);
      document.documentElement.style.setProperty('--tint-deep', `${dim(r, 0.32)}, ${dim(g, 0.32)}, ${dim(b2, 0.36)}`);
    });
  }
  paintFav(); paintState(); paintModes();
  if (lyricsOn) paintLyrics();
  const dockOK = !st, vid = !!t?.video;
  np.classList.toggle('video', vid);
  if (vid) np.style.setProperty('--arn', t.width && t.height ? (t.width / t.height).toFixed(4) : '1.7778');
  if (vid && lyricsOn) toggleLyrics(false);
  $('#npQueue').hidden = !dockOK; $('#npLyrics').hidden = !dockOK || vid;
  $('#npPip').hidden = !(vid && E.pipSupported);
  $('#miniPip').hidden = !(vid && E.pipSupported);
  paintPip();
  $('#npOutput').hidden = !E.S.outputPicker;
  $('#npVolRow').hidden = !E.S.volumeSupported;
  volCtl.set(E.S.volume);
}
function paintPip() {
  const on = E.inPip();
  np.classList.toggle('pip', on);
  // Chromium draws its own placeholder in the video box; Safari leaves it blank.
  $('.pip-note').hidden = !on || !!document.pictureInPictureElement;
  for (const b of [$('#npPip'), $('#miniPip')]) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Exit Picture in Picture' : 'Picture in Picture'); }
}
function paintFav() {
  const on = E.S.id && Lib.isFav(E.S.id);
  const b = $('#npFav'); b.innerHTML = icon(on ? 'heartFill' : 'heart'); b.classList.toggle('on', !!on);
  b.setAttribute('aria-pressed', !!on); b.setAttribute('aria-label', on ? 'Remove from Favorites' : 'Add to Favorites');
  b.hidden = !!E.S.station;
}
function paintState() {
  const S = E.S, playing = S.playing;
  const ic = icon(playing ? 'pause' : 'play');
  $('#miniPlay').innerHTML = ic; $('#npPlay').innerHTML = ic;
  const lbl = playing ? 'Pause' : 'Play';
  $('#miniPlay').setAttribute('aria-label', lbl); $('#npPlay').setAttribute('aria-label', lbl);
  np.classList.toggle('paused', !playing);
  document.body.classList.toggle('is-playing', playing);
  np.classList.toggle('loading', S.loading && !S.error);
  $('#npError').hidden = !S.error;
  if (S.error) $('#npErrorText').textContent = S.error;
  $('#npNext').disabled = !!S.station; $('#npPrev').disabled = !!S.station;
  $('#miniNext').hidden = !!S.station;
  if ('mediaSession' in navigator === false) return;
}
function paintTime() {
  const S = E.S, d = S.duration || 0;
  const v = d ? Math.min(1, S.time / d) : 0;
  $('#miniProg').style.transform = `scaleX(${S.station ? 0 : v})`;
  if (!scrubbing && npOpen) {
    seekCtl.set(v);
    $('#npElapsed').textContent = fmtTime(S.time);
    $('#npRemain').textContent = d ? '-' + fmtTime(d - S.time) : '--:--';
  }
  if (lyricsOn) syncLyrics();
}
function paintModes() {
  const S = E.S;
  const bits = [];
  if (S.shuffle) bits.push(icon('shuffle') + '<span>Shuffle</span>');
  if (S.repeat) bits.push(icon(S.repeat === 2 ? 'repeat1' : 'repeat') + `<span>${S.repeat === 2 ? 'Repeat One' : 'Repeat'}</span>`);
  if (S.sleepAt) bits.push(icon('moon') + '<span>Sleep</span>');
  const m = $('#npModes'); m.innerHTML = bits.join(''); m.hidden = !bits.length || !!S.station;
}
function markPlaying() {
  const id = E.S.id;
  $$('.row.song.playing, .tile-art.playing').forEach(r => { if (r.dataset.id !== id) r.classList.remove('playing'); });
  if (id) $$(`[data-id="${CSS.escape(id)}"]`).forEach(r => { if (r.classList.contains('song') || r.classList.contains('tile-art')) r.classList.add('playing'); });
  document.querySelectorAll('[data-station-id]').forEach(r => r.classList.toggle('playing', r.dataset.stationId === E.S.station?.id));
}

E.subscribe((S, kind) => {
  if (kind === 'init' || kind === 'track') { paintTrack(); markPlaying(); paintTime(); }
  else if (kind === 'state' || kind === 'error') { paintState(); if (kind === 'error' && S.error) toast(S.error, { kind: 'warn', action: S.queue.length > 1 && !S.station ? 'Skip' : '', onAction: () => E.next() }); }
  else if (kind === 'time') paintTime();
  else if (kind === 'queue' || kind === 'sleep') paintModes();
  else if (kind === 'volume') volCtl.set(S.volume);
  else if (kind === 'pip') paintPip();
  else if (kind === 'element') paintTrack();
});
$('#npErrSkip').onclick = () => E.next();

// ---------- library changes ----------
Lib.on(kind => {
  for (const s of Object.values(stacks)) for (const e of s) {
    if (kind === 'stats' && !PAGES[e.route]?.live) continue;
    e.stale = true;
  }
  const e = top();
  if (e.stale) {
    // Don't clobber the search field while someone is typing.
    if (e.route === 'search' && document.activeElement?.id === 'q') { $('#searchBody', e.el).innerHTML = searchBody(e.p.q || '', e); e.stale = false; }
    else { const y = window.scrollY; render(e); window.scrollTo(0, y); }
  }
  if (kind !== 'stats') { E.prune(); paintTrack(); renderSidebar(); }
});

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') { if (sheetOpen()) closeSheet(); else if (npOpen) closeNP(); else back(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest('button, [role=slider], .row')) { e.preventDefault(); E.toggle(); }
  else if (e.key === 'ArrowRight' && !e.target.closest('[role=slider]')) { e.shiftKey ? E.next() : E.seekBy(10); }
  else if (e.key === 'ArrowLeft' && !e.target.closest('[role=slider]')) { e.shiftKey ? E.prev() : E.seekBy(-10); }
  else if (e.key === '/') { e.preventDefault(); closeNP(); switchTab('search'); setTimeout(() => $('#q')?.focus(), 50); }
});

// ---------- desktop sidebar ----------
function renderSidebar() {
  const sb = $('#sidebarLinks'); if (!sb) return;
  const pl = Object.keys(L.playlists);
  sb.innerHTML = `<p class="sb-h">Library</p>${[['recent', 'clock', 'Recently Added'], ['artists', 'artist', 'Artists'], ['albums', 'album', 'Albums'], ['songs', 'song', 'Songs'], ['videos', 'video', 'Videos'], ['genres', 'genre', 'Genres'], ['favorites', 'heart', 'Favorites'], ['radio', 'radio', 'Live Radio'], ['files', 'folder', 'Local Files']]
    .map(([r, ic, l]) => `<button class="sb-link" data-side="${r}">${icon(ic)}<span>${l}</span></button>`).join('')}
    <p class="sb-h">Playlists <button class="icon-btn sm" data-act="newPlaylist" aria-label="New playlist">${icon('plus')}</button></p>
    ${pl.map(n => `<button class="sb-link" data-side="playlist|${esc(n)}">${icon('playlist')}<span>${esc(n)}</span></button>`).join('') || '<p class="sb-empty">No playlists yet</p>'}`;
}

// Broken artwork falls back to the AMB cover; broken station logos just disappear.
document.addEventListener('error', e => {
  const el = e.target;
  if (el?.tagName !== 'IMG') return;
  if (el.closest('.st-icon')) { el.remove(); return; }
  if (!el.dataset.fallback && !el.src.endsWith(Lib.DEFAULT_ART)) { el.dataset.fallback = '1'; el.src = Lib.DEFAULT_ART; }
}, true);

// ================= boot =================
$('#navBack').onclick = () => back();
initSheetGestures();
renderSidebar();
show(top(), 0);
(async () => {
  await Lib.load();
  E.restore();
  paintTrack(); renderSidebar();
  document.body.classList.add('ready');
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      reg.update().catch(() => {});
      // Home Screen apps resume instead of relaunching, so look for a new deploy each time AMB comes back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      let had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!had) { had = true; return; }
        // Never reload under the listener; offer it instead.
        if (E.S.playing) toast('A new version of AMB is ready', { action: 'Reload', onAction: () => location.reload() });
        else location.reload();
      });
    } catch (e) { console.warn('SW registration failed', e); }
  });
}

export { toast };
