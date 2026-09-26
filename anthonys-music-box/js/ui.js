// Shared UI helpers: escaping, formatting, toasts, sheets, sliders, row renderers.
import { icon } from './icons.js';
import * as Lib from './library.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plural = (n, w, p = w + 's') => `${n.toLocaleString()} ${n === 1 ? w : p}`;
export function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
export function fmtDur(s) {
  s = Math.round(s || 0); if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${Math.max(1, m)} min`;
}
export function fmtBytes(b) {
  if (!b) return '0 KB';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; }
  return `${b.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- context registry: rows point at a list so a tap plays in context ----------
export const ctxs = new Map();
export function ctx(key, ids) { ctxs.set(key, ids); return key; }

// ---------- toasts ----------
export function toast(msg, { action, onAction, ms = 3200, kind = '' } = {}) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast glass ' + kind;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action)}</button>` : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); };
  if (action) el.querySelector('button').onclick = () => { kill(); onAction?.(); };
  setTimeout(kill, action ? Math.max(ms, 5200) : ms);
  while (host.children.length > 3) host.firstChild.remove();
}

// ---------- sheets ----------
let sheetState = null;
export function closeSheet(result) {
  const s = sheetState; if (!s) return;
  sheetState = null;
  const layer = $('#sheetLayer'), sheet = $('.sheet', layer);
  layer.classList.remove('open');
  sheet.style.transform = '';
  s.onClose?.(result);
  setTimeout(() => { if (!sheetState) { layer.hidden = true; $('.sheet-body', layer).innerHTML = ''; } }, reduceMotion() ? 0 : 330);
  s.restoreFocus?.focus?.({ preventScroll: true });
}
export function openSheet({ title = '', html = '', cls = '', onMount, onClose, header = true, headerRight = '' }) {
  if (sheetState) { const prev = sheetState; sheetState = null; prev.onClose?.(undefined); }
  const layer = $('#sheetLayer'), sheet = $('.sheet', layer);
  sheet.className = 'sheet glass ' + cls;
  $('.sheet-head', layer).hidden = !header;
  $('.sheet-title', layer).innerHTML = title;
  $('.sheet-right', layer).innerHTML = headerRight;
  const body = $('.sheet-body', layer);
  body.innerHTML = html; body.scrollTop = 0;
  layer.hidden = false;
  sheetState = { onClose, restoreFocus: document.activeElement };
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  onMount?.(body, sheet);
  setTimeout(() => { const f = body.querySelector('[autofocus]') || sheet.querySelector('.sheet-close'); f?.focus({ preventScroll: true }); }, 60);
  return body;
}
export const sheetOpen = () => !!sheetState;

export function actionSheet({ title = '', sub = '', art = '', items = [] }) {
  const head = title ? `<div class="as-head">${art ? `<img src="${esc(art)}" alt="">` : ''}<div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>` : '';
  const html = head + `<div class="as-list">${items.filter(Boolean).map((it, i) => it.sep ? '<div class="as-sep"></div>' :
    `<button class="as-item ${it.danger ? 'danger' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}><span>${esc(it.label)}</span>${it.icon ? icon(it.icon) : ''}</button>`).join('')}</div>`;
  const list = items.filter(Boolean);
  openSheet({ header: false, cls: 'action', html, onMount: body => {
    body.querySelectorAll('.as-item').forEach(b => b.onclick = () => { const it = list[+b.dataset.i]; closeSheet(); setTimeout(() => it.run?.(), 10); });
  } });
}

export function confirmSheet({ title, msg = '', ok = 'OK', danger = false }) {
  return new Promise(resolve => {
    openSheet({ header: false, cls: 'action', html: `<div class="confirm"><b>${esc(title)}</b>${msg ? `<p>${esc(msg)}</p>` : ''}</div>
      <div class="as-list"><button class="as-item ${danger ? 'danger' : 'accent'}" data-ok><span>${esc(ok)}</span></button><button class="as-item" data-no><span>Cancel</span></button></div>`,
      onMount: b => { b.querySelector('[data-ok]').onclick = () => closeSheet(true); b.querySelector('[data-no]').onclick = () => closeSheet(false); },
      onClose: r => resolve(r === true) });
  });
}

export function formSheet({ title, fields, ok = 'Save', note = '' }) {
  return new Promise(resolve => {
    const html = `<form class="form" novalidate>${fields.map((f, i) => {
      const id = 'ff' + i;
      if (f.type === 'textarea') return `<label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.name}" rows="${f.rows || 6}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`;
      if (f.type === 'file') return `<label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.name}" type="file" accept="${f.accept || ''}">`;
      return `<label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${i === 0 ? 'autofocus' : ''} autocomplete="off" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}>`;
    }).join('')}${note ? `<p class="note">${esc(note)}</p>` : ''}<button class="btn primary wide" type="submit">${esc(ok)}</button></form>`;
    openSheet({ title: esc(title), html, cls: 'form-sheet', headerRight: '',
      onMount: b => {
        const form = b.querySelector('form');
        form.onsubmit = e => {
          e.preventDefault();
          const v = {};
          for (const f of fields) { const el = form.elements[f.name]; v[f.name] = f.type === 'file' ? el.files[0] || null : el.value.trim(); }
          closeSheet(v);
        };
      },
      onClose: r => resolve(r && typeof r === 'object' ? r : null) });
  });
}

// Swipe-down to dismiss for the sheet.
export function initSheetGestures() {
  const layer = $('#sheetLayer'), sheet = $('.sheet', layer);
  $('.scrim', layer).onclick = () => closeSheet();
  $('.sheet-close', layer).onclick = () => closeSheet();
  let y0 = null, dy = 0, t0 = 0;
  const start = e => {
    const body = $('.sheet-body', layer);
    if (e.target.closest('.grip, input, textarea, .rail, button:not(.sheet-grab)')) return;
    if (!e.target.closest('.sheet-grab, .sheet-head') && body.scrollTop > 0) return;
    y0 = e.clientY; dy = 0; t0 = Date.now();
  };
  sheet.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    if (dy > 6) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; }
  });
  const end = () => {
    if (y0 === null) return;
    const v = dy / Math.max(1, Date.now() - t0);
    y0 = null; sheet.style.transition = '';
    if (dy > 130 || (v > 0.8 && dy > 40)) closeSheet(); else sheet.style.transform = '';
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

// ---------- slider (seek / volume) ----------
export function slider(rail, { get, onInput, onCommit, step = 0.02, label }) {
  let dragging = false;
  const fill = rail.querySelector('.fill');
  const set = v => { v = Math.max(0, Math.min(1, v)); fill.style.transform = `scaleX(${v})`; rail.style.setProperty('--v', v); rail.setAttribute('aria-valuenow', Math.round(v * 100)); };
  const at = e => { const r = rail.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  rail.setAttribute('role', 'slider'); rail.tabIndex = 0; rail.setAttribute('aria-valuemin', 0); rail.setAttribute('aria-valuemax', 100);
  if (label) rail.setAttribute('aria-label', label);
  rail.addEventListener('pointerdown', e => { dragging = true; rail.setPointerCapture(e.pointerId); rail.classList.add('drag'); const v = at(e); set(v); onInput?.(v); e.preventDefault(); });
  rail.addEventListener('pointermove', e => { if (!dragging) return; const v = Math.max(0, Math.min(1, at(e))); set(v); onInput?.(v); });
  const up = e => { if (!dragging) return; dragging = false; rail.classList.remove('drag'); const v = Math.max(0, Math.min(1, at(e))); set(v); onCommit?.(v); };
  rail.addEventListener('pointerup', up);
  rail.addEventListener('pointercancel', () => { dragging = false; rail.classList.remove('drag'); set(get()); });
  rail.addEventListener('keydown', e => {
    let v = get();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step; else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
    else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = 1; else return;
    e.preventDefault(); v = Math.max(0, Math.min(1, v)); set(v); onCommit?.(v);
  });
  return { set: v => { if (!dragging) set(v); }, get dragging() { return dragging; } };
}

// ---------- renderers ----------
export function img(src, cls = '', alt = '') { return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" draggable="false">`; }

export function collage(ids, cls = '') {
  const seen = new Set(), arts = [];
  for (const id of ids) {
    const t = Lib.get(id); if (!t || !Lib.hasArt(t)) continue;
    const k = Lib.albumKeyOf(t); if (seen.has(k)) continue;
    seen.add(k); arts.push(Lib.artOf(t)); if (arts.length === 4) break;
  }
  if (arts.length >= 4) return `<div class="collage ${cls}">${arts.map(a => img(a)).join('')}</div>`;
  const one = arts[0] || Lib.artOf(Lib.get(ids[0]));
  return `<div class="collage one ${cls}">${img(one)}</div>`;
}

export function songRow(t, { ctx: c, i, num, album = false, sel, grip, remove, sub } = {}) {
  const fav = Lib.isFav(t.id);
  const lead = num !== undefined ? `<span class="num">${num || ''}</span>` : img(Lib.artOf(t), 'thumb');
  const second = sub ?? (album ? [Lib.trackArtist(t), t.album].filter(Boolean).join(' · ') : Lib.trackArtist(t));
  const bad = t.unavailable || !t.blob;
  return `<div class="row song ${bad ? 'bad' : ''} ${sel ? 'selectable' : ''} ${sel?.has?.(t.id) ? 'selected' : ''}" data-id="${t.id}" ${c ? `data-ctx="${esc(c)}"` : ''} ${i !== undefined ? `data-i="${i}"` : ''} tabindex="0">
    ${sel ? `<span class="check" aria-hidden="true">${icon('check')}</span>` : ''}
    <span class="lead">${lead}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
    <span class="rt"><b>${esc(Lib.trackTitle(t))}</b><small>${fav ? `<span class="fav-dot" aria-label="Favorite">${icon('heartFill')}</span>` : ''}${bad ? `<span class="warn-dot" aria-label="Unavailable">${icon('warn')}</span>` : ''}${esc(second)}</small></span>
    ${remove ? `<button class="icon-btn row-remove" data-act="rowRemove" data-i="${i}" aria-label="Remove ${esc(Lib.trackTitle(t))}">${icon('x')}</button>` : ''}
    ${grip ? `<span class="grip" data-grip="${i}" aria-label="Reorder" role="button" tabindex="-1">${icon('grip')}</span>` : ''}
    ${!sel && !grip ? `<button class="icon-btn more" data-act="songMenu" data-id="${t.id}" aria-label="More options for ${esc(Lib.trackTitle(t))}">${icon('more')}</button>` : ''}
  </div>`;
}

export function tile({ art, title, sub = '', go, round = false, playIds }) {
  return `<div class="tile ${round ? 'round' : ''}">
    <button class="tile-art" data-go="${esc(go)}" aria-label="${esc(title)}">${art}</button>
    ${playIds ? '' : ''}
    <button class="tile-meta" data-go="${esc(go)}" tabindex="-1"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>
  </div>`;
}

export function navRow({ go, act, iconName, label, count = '', art = '' }) {
  return `<button class="nav-row" ${go ? `data-go="${esc(go)}"` : ''} ${act ? `data-act="${esc(act)}"` : ''}>
    ${art || (iconName ? `<span class="nr-icon">${icon(iconName)}</span>` : '')}
    <span class="nr-label">${esc(label)}</span>
    <span class="nr-count">${count === '' ? '' : esc(count)}</span>
    ${icon('chev', 'chev')}
  </button>`;
}

export function sectionHead(title, go, label = 'See All') {
  return `<div class="sec-head"><h2>${esc(title)}</h2>${go ? `<button class="link" data-go="${esc(go)}">${esc(label)}</button>` : ''}</div>`;
}

export function colorOf(src) {
  return new Promise(resolve => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 20;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 20, 20);
        const d = g.getImageData(0, 0, 20, 20).data;
        let r = 0, gg = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx ? (mx - mn) / mx : 0, lum = (mx + mn) / 510;
          const wt = 0.15 + sat * 1.6 * (lum > 0.08 && lum < 0.92 ? 1 : 0.2);
          r += R * wt; gg += G * wt; b += B * wt; w += wt;
        }
        resolve([r / w, gg / w, b / w].map(Math.round));
      } catch { resolve([40, 40, 40]); }
    };
    im.onerror = () => resolve([40, 40, 40]);
    im.src = src;
  });
}
