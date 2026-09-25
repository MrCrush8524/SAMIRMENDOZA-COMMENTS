// Live Radio: optional, online-only. Uses the public Radio Browser directory;
// streams play directly from each broadcaster. HTTPS streams only.
import { icon } from './icons.js';
import { readLS, writeLS } from './db.js';
import { esc } from './ui.js';

const BOOT = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Classical', 'Electronic', 'Country', 'Latin', 'R&B', 'Lo-Fi', 'News', 'Talk'];
const COUNTRIES = [['', 'Any country'], ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BR', 'Brazil'], ['JP', 'Japan'], ['PR', 'Puerto Rico'], ['DO', 'Dominican Republic'], ['CO', 'Colombia']];

const R = { mode: 'discover', results: [], busy: false, error: '', loaded: false, server: '', f: { name: '', country: readLS('amb-radio-country', 'US'), tag: '' }, serial: 0 };
let saved = readLS('amb-radio-favorites', []);
const httpsURL = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
const validMirror = s => /^https:\/\/[a-z0-9-]+\.api\.radio-browser\.info$/.test(s);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function fetchJSON(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 7000);
  try { const r = await fetch(url, { signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function mirrors() {
  const c = readLS('amb-radio-mirrors', null);
  if (c && Date.now() - c.time < 864e5 && Array.isArray(c.servers)) { const l = c.servers.filter(validMirror); if (l.length) return shuffle(l); }
  for (const h of shuffle(BOOT)) {
    try { const d = await fetchJSON(h + '/json/servers'); const s = [...new Set(d.map(x => 'https://' + x.name).filter(validMirror))]; if (s.length) { writeLS('amb-radio-mirrors', { time: Date.now(), servers: s }); return shuffle(s); } } catch {}
  }
  return shuffle(BOOT);
}
async function api(path) {
  const list = [...new Set([R.server, ...(await mirrors())].filter(validMirror))].slice(0, 3);
  for (const h of list) { try { const d = await fetchJSON(h + path); R.server = h; return d; } catch {} }
  throw new Error('Couldn’t reach the station directory. Check your connection and try again. Saved stations still work.');
}
function normalize(s) {
  const url = httpsURL(s.url_resolved || s.url);
  if (!url || !s.stationuuid || !s.name) return null;
  return { id: String(s.stationuuid), name: String(s.name).trim(), url, homepage: httpsURL(s.homepage), favicon: httpsURL(s.favicon), country: String(s.countrycode || ''), state: String(s.state || ''), tags: String(s.tags || ''), codec: String(s.codec || ''), bitrate: +s.bitrate || 0, hls: !!+s.hls };
}

async function load(rerender) {
  const my = ++R.serial; R.busy = true; R.error = ''; rerender();
  const q = new URLSearchParams({ hidebroken: 'true', order: R.f.name || R.f.tag ? 'votes' : 'clickcount', reverse: 'true', limit: '60' });
  if (R.f.name) q.set('name', R.f.name);
  if (R.f.tag) q.set('tag', R.f.tag.toLowerCase());
  if (R.f.country) q.set('countrycode', R.f.country);
  try {
    const d = await api('/json/stations/search?' + q);
    if (my !== R.serial) return;
    const seen = new Set();
    R.results = d.map(normalize).filter(s => s && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()));
    R.loaded = true;
  } catch (e) { if (my === R.serial) R.error = e.message; }
  if (my === R.serial) { R.busy = false; rerender(); }
}
function saveStations() { writeLS('amb-radio-favorites', saved); }
const isSaved = id => saved.some(s => s.id === id);

export function radioStationRow(s) {
  const meta = [s.country, s.state, s.tags.split(',').slice(0, 2).join(', '), s.codec, s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
  return `<div class="row station" data-station-id="${esc(s.id)}">
    <span class="lead"><span class="st-icon">${s.favicon ? `<img src="${esc(s.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}${icon('radio')}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
    <button class="rt st-play" data-st-play="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc(meta || 'Live stream')}</small></button>
    <button class="icon-btn ${isSaved(s.id) ? 'on' : ''}" data-st-fav="${esc(s.id)}" aria-pressed="${isSaved(s.id)}" aria-label="${isSaved(s.id) ? 'Remove' : 'Save'} ${esc(s.name)}">${icon(isSaved(s.id) ? 'heartFill' : 'heart')}</button>
    <button class="icon-btn more" data-st-more="${esc(s.id)}" aria-label="More about ${esc(s.name)}">${icon('more')}</button>
  </div>`;
}

export function radioPage({ toast, actionSheet, formSheet, E, largeTitle, markPlaying }) {
  let el = null;
  const find = id => saved.find(s => s.id === id) || R.results.find(s => s.id === id);
  const paint = () => { if (!el) return; const b = el.querySelector('#radioBody'); if (b) { b.innerHTML = body(); markPlaying(); } };
  function body() {
    const list = R.mode === 'saved' ? saved : R.results;
    if (R.mode === 'discover' && R.busy && !R.results.length) return `<div class="radio-loading"><span class="spinner"></span><p>Finding stations…</p></div>`;
    if (R.mode === 'discover' && R.error) return `<div class="notice glass">${icon('warn')}<p>${esc(R.error)}</p></div><div class="center-link"><button class="btn glass-btn" data-radio="retry">Try Again</button></div>`;
    if (!list.length) return R.mode === 'saved' ? `<div class="empty small">${icon('radio', 'big-i')}<p>Tap the heart on any station to keep it here, or add your own stream.</p></div>` : `<div class="empty small"><p>No stations matched. Try another name, genre or country.</p></div>`;
    return `<div class="list ${R.busy ? 'dim' : ''}">${list.map(radioStationRow).join('')}</div>`;
  }
  const PAGE = {
    title: () => 'Live Radio',
    actions: () => `<button class="icon-btn" data-act="radioCustom" aria-label="Add a stream URL">${icon('plus')}</button>`,
    html: () => `<div class="page-pad">${largeTitle('Live Radio')}
      <p class="meta-line">Broadcasts from around the world. Needs an internet connection.</p>
      <div class="seg glass" role="tablist"><button role="tab" data-radio="mode" data-v="discover" aria-selected="${R.mode === 'discover'}" class="${R.mode === 'discover' ? 'on' : ''}">Discover</button><button role="tab" data-radio="mode" data-v="saved" aria-selected="${R.mode === 'saved'}" class="${R.mode === 'saved' ? 'on' : ''}">Saved${saved.length ? ` (${saved.length})` : ''}</button></div>
      ${R.mode === 'discover' ? `<form class="radio-form" data-radio-form>
        <label class="search-field glass">${icon('search')}<input name="name" type="search" placeholder="Station name or call sign" value="${esc(R.f.name)}" enterkeyhint="search" autocomplete="off"></label>
        <select name="country" class="glass select" aria-label="Country">${COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === R.f.country ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </form>
        <div class="chips">${GENRES.map(g => `<button class="chip ${R.f.tag === g ? 'on' : ''}" data-radio="tag" data-v="${esc(g)}" aria-pressed="${R.f.tag === g}">${esc(g)}</button>`).join('')}</div>` : ''}
      <div id="radioBody">${body()}</div></div>`,
    mount: (root) => {
      el = root;
      if (!R.loaded && !R.busy && R.mode === 'discover') load(paint);
      const form = root.querySelector('[data-radio-form]');
      if (form) {
        let t = 0;
        form.onsubmit = e => { e.preventDefault(); form.name.blur(); R.f.name = form.name.value.trim(); load(paint); };
        form.name.oninput = () => { clearTimeout(t); t = setTimeout(() => { R.f.name = form.name.value.trim(); load(paint); }, 450); };
        form.country.onchange = () => { R.f.country = form.country.value; writeLS('amb-radio-country', R.f.country); load(paint); };
      }
      root.onclick = async e => {
        const b = e.target.closest('[data-radio],[data-st-play],[data-st-fav],[data-st-more]'); if (!b) return;
        e.stopPropagation();
        const k = b.dataset.radio;
        if (k === 'mode') { R.mode = b.dataset.v; root.innerHTML = PAGE.html(); PAGE.mount(root); return; }
        if (k === 'tag') { R.f.tag = R.f.tag === b.dataset.v ? '' : b.dataset.v; root.querySelectorAll('.chip').forEach(c => { c.classList.toggle('on', c.dataset.v === R.f.tag); c.setAttribute('aria-pressed', c.dataset.v === R.f.tag); }); load(paint); return; }
        if (k === 'retry') { load(paint); return; }
        if (b.dataset.stPlay) { const s = find(b.dataset.stPlay); if (s) { E.playStation(s); toast(`Tuning in to ${s.name}…`); } return; }
        if (b.dataset.stFav) {
          const s = find(b.dataset.stFav); if (!s) return;
          if (isSaved(s.id)) saved = saved.filter(x => x.id !== s.id); else saved.unshift(s);
          saveStations(); paint();
          const seg = root.querySelector('[data-v="saved"]'); if (seg) seg.textContent = `Saved${saved.length ? ` (${saved.length})` : ''}`;
          return;
        }
        if (b.dataset.stMore) {
          const s = find(b.dataset.stMore); if (!s) return;
          actionSheet({ title: s.name, sub: [s.country, s.state, s.codec, s.bitrate ? s.bitrate + ' kbps' : '', s.hls ? 'HLS' : ''].filter(Boolean).join(' · ') || 'Live stream', items: [
            { label: 'Play', icon: 'play', run: () => E.playStation(s) },
            { label: isSaved(s.id) ? 'Remove from Saved' : 'Save Station', icon: 'heart', run: () => { if (isSaved(s.id)) saved = saved.filter(x => x.id !== s.id); else saved.unshift(s); saveStations(); paint(); } },
            s.homepage ? { label: 'Open Station Website', icon: 'globe', run: () => window.open(s.homepage, '_blank', 'noopener') } : null,
          ] });
        }
      };
    },
    customStream: () => customStream(),
  };
  return PAGE;
  async function customStream() {
    const v = await formSheet({ title: 'Add a Stream', ok: 'Save Station', note: 'Use a secure (https://) stream address from the station’s website. MP3, AAC and, in Safari, HLS (.m3u8) streams are supported.', fields: [{ name: 'name', label: 'Station name', placeholder: 'My Station' }, { name: 'url', label: 'Stream URL', type: 'url', placeholder: 'https://', inputmode: 'url' }] });
    if (!v) return;
    const url = httpsURL(v.url);
    if (!url) { toast('Enter a secure https:// stream address', { kind: 'warn' }); return; }
    const s = { id: 'custom-' + Date.now().toString(36), name: v.name || new URL(url).hostname, url, homepage: '', favicon: '', country: '', state: '', tags: 'custom', codec: '', bitrate: 0, hls: /\.m3u8/i.test(url) };
    saved.unshift(s); saveStations(); R.mode = 'saved';
    if (el) { el.innerHTML = PAGE.html(); PAGE.mount(el); }
    toast('Station saved');
  }
}
