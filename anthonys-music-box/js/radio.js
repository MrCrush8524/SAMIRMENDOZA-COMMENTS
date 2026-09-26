// Worldwide Radio: optional, online-only. Uses the public Radio Browser
// directory; streams play directly from each broadcaster. HTTPS streams only.
import { icon } from './icons.js';
import { readLS, writeLS } from './db.js';
import { esc, plural } from './ui.js';
import { t as tr, locale } from './i18n.js';

const BOOT = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
const TOP_GENRES = ['pop', 'rock', 'hip hop', 'jazz', 'classical', 'electronic', 'country', 'latin', 'rnb', 'reggaeton', 'salsa', 'news', 'talk', 'oldies', 'dance', 'chillout', 'ambient', 'lofi', 'blues', 'soul', 'metal', 'christian', 'sports', 'kpop'];
const PAGE_SIZE = 60;

let server = '';
let saved = readLS('amb-radio-favorites', []);
let recent = readLS('amb-radio-recent', []);
const known = new Map(); // station id -> station, for rows on screen
[...saved, ...recent].forEach(s => known.set(s.id, s));

const httpsURL = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
const validMirror = s => /^https:\/\/[a-z0-9-]+\.api\.radio-browser\.info$/.test(s);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase());
const regionNamesFor = new Map();
function regionNames() {
  const l = locale();
  if (!regionNamesFor.has(l)) { try { regionNamesFor.set(l, new Intl.DisplayNames([l], { type: 'region' })); } catch { regionNamesFor.set(l, null); } }
  return regionNamesFor.get(l);
}
export const countryName = (code, fallback = '') => { try { return (code && regionNames()?.of(code.toUpperCase())) || fallback || code; } catch { return fallback || code; } };

// The listener's country from their device language/region settings (no location access needed).
export function homeCountry() {
  for (const l of [...(navigator.languages || []), navigator.language, Intl.DateTimeFormat().resolvedOptions().locale]) {
    const m = String(l || '').match(/[-_]([A-Za-z]{2})\b/);
    if (m) return m[1].toUpperCase();
  }
  return 'US';
}

async function fetchJSON(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
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
  const list = [...new Set([server, ...(await mirrors())].filter(validMirror))].slice(0, 3);
  for (const h of list) { try { const d = await fetchJSON(h + path); server = h; return d; } catch {} }
  throw new Error(tr('Couldn’t reach the station directory. Check your internet connection and try again. Your favorite stations still work.'));
}
// Countries and genres change slowly: keep them for a day.
async function cachedApi(key, path) {
  const c = readLS(key, null);
  if (c && Date.now() - c.time < 864e5 && Array.isArray(c.data)) return c.data;
  const data = await api(path);
  writeLS(key, { time: Date.now(), data });
  return data;
}
function normalize(s) {
  const url = httpsURL(s.url_resolved || s.url);
  if (!url || !s.stationuuid || !s.name) return null;
  const st = { id: String(s.stationuuid), name: String(s.name).trim(), url, homepage: httpsURL(s.homepage), favicon: httpsURL(s.favicon), country: String(s.countrycode || ''), state: String(s.state || '').trim(), tags: String(s.tags || ''), codec: String(s.codec || ''), bitrate: +s.bitrate || 0, hls: !!+s.hls };
  known.set(st.id, st);
  return st;
}
function dedupe(list) { const seen = new Set(); return list.filter(s => s && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase())); }
async function stations(params, offset = 0) {
  const q = new URLSearchParams({ hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: String(PAGE_SIZE), offset: String(offset), ...params });
  return dedupe((await api('/json/stations/search?' + q)).map(normalize));
}

const isSaved = id => saved.some(s => s.id === id);
function toggleSaved(s) {
  if (isSaved(s.id)) saved = saved.filter(x => x.id !== s.id); else saved.unshift(s);
  writeLS('amb-radio-favorites', saved);
  return isSaved(s.id);
}
function markRecent(s) {
  recent = [s, ...recent.filter(x => x.id !== s.id)].slice(0, 30);
  writeLS('amb-radio-recent', recent);
}

export function stationRow(s) {
  const where = [countryName(s.country, ''), s.state].filter(Boolean).join(' · ');
  const meta = [where, cap(s.tags.split(',').slice(0, 2).join(', ')), s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
  const on = isSaved(s.id);
  return `<div class="row station" data-station-id="${esc(s.id)}">
    <span class="lead"><span class="st-icon">${s.favicon ? `<img src="${esc(s.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}${icon('radio')}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
    <button class="rt st-play" data-st-play="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc(meta || tr('Live stream'))}</small></button>
    <button class="icon-btn ${on ? 'on' : ''}" data-st-fav="${esc(s.id)}" aria-pressed="${on}" aria-label="${esc(tr(on ? 'Remove {name} from favorites' : 'Save {name} to favorites', { name: s.name }))}">${icon(on ? 'heartFill' : 'heart')}</button>
    <button class="icon-btn more" data-st-more="${esc(s.id)}" aria-label="${esc(tr('More about {name}', { name: s.name }))}">${icon('more')}</button>
  </div>`;
}

export function createRadio({ go, toast, actionSheet, formSheet, E, largeTitle, brandRow, navRow, sectionHead, markPlaying, rerender }) {
  const list = arr => `<div class="list">${arr.map(stationRow).join('')}</div>`;
  const loading = label => `<div class="radio-loading"><span class="spinner"></span><p>${esc(tr(label || 'Finding stations…'))}</p></div>`;
  const failed = msg => `<div class="notice glass">${icon('warn')}<p>${esc(msg)}</p></div><div class="center-link"><button class="btn glass-btn" data-radio-retry>${tr('Try Again')}</button></div>`;
  const emptyMsg = msg => `<div class="empty small">${icon('radio', 'big-i')}<p>${esc(tr(msg))}</p></div>`;

  // Generic async loader for a page entry: e.data holds results so re-renders don't refetch.
  async function fill(el, e, loader) {
    e.data = { busy: true }; paintBody(el, e);
    try { e.data = { items: await loader(0), offset: 0, more: true }; e.data.more = e.data.items.length >= PAGE_SIZE * 0.8; }
    catch (err) { e.data = { error: err.message }; }
    paintBody(el, e);
  }
  function paintBody(el, e) {
    const b = el.querySelector('.radio-body'); if (!b) return;
    b.innerHTML = bodyFor(e); markPlaying();
  }
  function bodyFor(e) {
    const d = e.data;
    if (!d || d.busy) return loading();
    if (d.error) return failed(d.error);
    return e.bodyHTML(d);
  }

  function play(s) {
    markRecent(s);
    E.playStation(s);
    toast(tr('Tuning in to {name}…', { name: s.name }));
  }

  // One delegated handler for every radio control on any screen.
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-st-play],[data-st-fav],[data-st-more],[data-radio-retry],[data-radio-more],[data-radio-near],[data-radio-state]');
    if (!b) return;
    ev.stopPropagation();
    const page = b.closest('.page');
    if (b.dataset.stPlay) { const s = known.get(b.dataset.stPlay); if (s) play(s); return; }
    if (b.dataset.stFav) {
      const s = known.get(b.dataset.stFav); if (!s) return;
      const on = toggleSaved(s);
      document.querySelectorAll(`[data-st-fav="${CSS.escape(s.id)}"]`).forEach(x => { x.classList.toggle('on', on); x.innerHTML = icon(on ? 'heartFill' : 'heart'); x.setAttribute('aria-pressed', on); });
      toast(on ? 'Added to Radio Favorites' : 'Removed from Radio Favorites');
      rerender('radio');
      return;
    }
    if (b.dataset.stMore) { stationMenu(known.get(b.dataset.stMore)); return; }
    const entry = page?._entry;
    if (!entry) return;
    if (b.hasAttribute('data-radio-retry')) { PAGES[entry.route].mount(page, entry.p, entry); return; }
    if (b.hasAttribute('data-radio-more')) { loadMore(page, entry); return; }
    if (b.hasAttribute('data-radio-near')) { nearMe(page, entry); return; }
    if (b.dataset.radioState !== undefined) { entry.p.state = entry.p.state === b.dataset.radioState ? '' : b.dataset.radioState; paintBody(page, entry); }
  }, true);

  async function loadMore(el, e) {
    const d = e.data; if (!d?.items || !e.loader) return;
    const btn = el.querySelector('[data-radio-more]'); if (btn) { btn.disabled = true; btn.textContent = tr('Loading…'); }
    try {
      const next = await e.loader(d.offset + PAGE_SIZE);
      d.offset += PAGE_SIZE; d.items = dedupe([...d.items, ...next]); d.more = next.length >= PAGE_SIZE * 0.8;
    } catch (err) { toast(err.message, { kind: 'warn' }); }
    paintBody(el, e);
  }

  function nearMe(el, e) {
    if (!navigator.geolocation) { toast('Location isn’t available here. Showing stations in your country.'); return; }
    const btn = el.querySelector('[data-radio-near]'); if (btn) { btn.disabled = true; btn.textContent = tr('Finding your location…'); }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      e.p.near = true;
      e.loader = off => stations({ geo_lat: latitude.toFixed(3), geo_long: longitude.toFixed(3), geo_distance: '80000', order: 'clickcount' }, off);
      fill(el, e, e.loader);
    }, () => {
      if (btn) { btn.disabled = false; btn.textContent = tr('Use My Location'); }
      toast('Couldn’t get your location, so these are stations in your country.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 6e5 });
  }

  function stationMenu(s) {
    if (!s) return;
    const on = isSaved(s.id);
    actionSheet({ title: s.name, sub: [countryName(s.country, ''), s.state, s.codec, s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · ') || tr('Live stream'), items: [
      { label: 'Play', icon: 'play', run: () => play(s) },
      { label: on ? 'Remove from Favorites' : 'Add to Favorites', icon: on ? 'heartFill' : 'heart', run: () => { toggleSaved(s); rerender('radio'); } },
      s.country ? { label: tr('More from {country}', { country: countryName(s.country) }), icon: 'globe', run: () => go('radioList', { kind: 'country', value: s.country }) } : null,
      s.homepage ? { label: 'Open Station Website', icon: 'link', run: () => window.open(s.homepage, '_blank', 'noopener') } : null,
      recent.some(x => x.id === s.id) ? { label: 'Remove from Recently Played', icon: 'x', run: () => { recent = recent.filter(x => x.id !== s.id); writeLS('amb-radio-recent', recent); rerender('radio'); } } : null,
    ] });
  }

  async function customStream() {
    const v = await formSheet({ title: 'Add a Stream', ok: 'Save Station', note: 'Paste a secure (https://) stream address from a station’s website. MP3, AAC and, on Apple devices, HLS (.m3u8) streams work.', fields: [{ name: 'name', label: 'Station name', placeholder: 'My Station' }, { name: 'url', label: 'Stream address', type: 'url', placeholder: 'https://', inputmode: 'url' }] });
    if (!v) return;
    const url = httpsURL(v.url);
    if (!url) { toast('Enter a secure https:// stream address', { kind: 'warn' }); return; }
    const s = { id: 'custom-' + Date.now().toString(36), name: v.name || new URL(url).hostname, url, homepage: '', favicon: '', country: '', state: '', tags: 'my stream', codec: '', bitrate: 0, hls: /\.m3u8/i.test(url) };
    known.set(s.id, s); saved.unshift(s); writeLS('amb-radio-favorites', saved);
    toast('Saved to Radio Favorites'); rerender('radio');
  }

  const LIST_TITLES = { world: 'Around the World', favorites: 'Favorites', recent: 'Recently Played', local: 'Local Stations', search: 'Search' };
  const genreName = g => tr(cap(g));
  const listTitle = p => p.kind === 'country' ? countryName(p.value, p.label) : p.kind === 'tag' ? genreName(p.value) : p.kind === 'search' ? `“${p.value}”` : tr(LIST_TITLES[p.kind] || 'Radio');

  const PAGES = {
    radio: {
      title: () => tr('Radio'),
      actions: () => `<button class="icon-btn" data-act="radioCustom" aria-label="${tr('Add a stream')}">${icon('plus')}</button>`,
      html: () => {
        const hc = homeCountry();
        return `<div class="page-pad">${brandRow()}${largeTitle(tr('Radio'))}
        <p class="meta-line">${tr('Live stations from around the world. Radio uses your internet connection.')}</p>
        <form class="radio-search" data-radio-search><label class="search-field glass">${icon('search')}<input name="q" type="search" placeholder="${tr('Station name or call letters')}" enterkeyhint="search" autocomplete="off" aria-label="${tr('Search radio stations')}"></label></form>
        <div class="group glass radio-hub">
          ${navRow({ go: 'radioList|world', iconName: 'globe', label: tr('Around the World'), count: '' })}
          ${navRow({ go: 'radioCountries', iconName: 'map', label: tr('Countries'), count: '' })}
          ${navRow({ go: 'radioGenres', iconName: 'genre', label: tr('Genres'), count: '' })}
          ${navRow({ go: 'radioList|favorites', iconName: 'heart', label: tr('Favorites'), count: saved.length || '' })}
          ${navRow({ go: 'radioList|recent', iconName: 'clock', label: tr('Recently Played'), count: recent.length || '' })}
          ${navRow({ go: 'radioList|local', iconName: 'pin', label: tr('Local Stations'), count: countryName(hc) })}
        </div>
        ${saved.length ? sectionHead('Your Favorites', saved.length > 5 ? 'radioList|favorites' : '') + list(saved.slice(0, 5)) : ''}
        ${recent.length ? sectionHead('Recently Played', recent.length > 5 ? 'radioList|recent' : '') + list(recent.slice(0, 5)) : ''}
        ${sectionHead('Popular Genres')}
        <div class="chips wrap">${TOP_GENRES.slice(0, 12).map(g => `<button class="chip" data-go="radioList|tag|${esc(g)}">${esc(genreName(g))}</button>`).join('')}</div>
        <div class="center-link"><button class="btn glass-btn" data-act="radioCustom">${icon('plus')}<span>${tr('Add a Stream')}</span></button></div>
      </div>`;
      },
      mount: el => {
        const f = el.querySelector('[data-radio-search]');
        f.onsubmit = ev => { ev.preventDefault(); const q = f.q.value.trim(); if (q) { f.q.blur(); go('radioList', { kind: 'search', value: q }); } };
        markPlaying();
      },
    },

    radioList: {
      title: p => listTitle(p),
      html: (p, e) => {
        e.bodyHTML = d => {
          let items = d.items;
          let chips = '';
          if (p.kind === 'country' && items.length) {
            const counts = new Map();
            for (const s of items) if (s.state) counts.set(s.state, (counts.get(s.state) || 0) + 1);
            const states = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(x => x[0]);
            if (states.length > 1) chips = `<p class="chip-label">${tr('Cities & regions')}</p><div class="chips">${states.map(s => `<button class="chip ${p.state === s ? 'on' : ''}" data-radio-state="${esc(s)}" aria-pressed="${p.state === s}">${esc(s)}</button>`).join('')}</div>`;
            if (p.state) items = items.filter(s => s.state === p.state);
          }
          if (!items.length) return chips + emptyMsg(p.kind === 'favorites' ? 'Tap the heart on any station to keep it here.' : p.kind === 'recent' ? 'Stations you play show up here.' : 'No stations found. Try another search, country or genre.');
          return chips + list(items) + (d.more && !p.state && e.loader ? `<div class="center-link"><button class="btn glass-btn" data-radio-more>${tr('Show More Stations')}</button></div>` : '');
        };
        const sub = p.kind === 'world' ? tr('The most-played stations on Earth right now.')
          : p.kind === 'local' ? (p.near ? tr('Stations near you.') : tr('Stations in {country}, from your device’s region setting.', { country: countryName(homeCountry()) }))
          : p.kind === 'tag' ? tr('Stations playing this genre worldwide.')
          : p.kind === 'country' ? tr('The most-played stations in this country.') : '';
        const nearBtn = p.kind === 'local' && !p.near && navigator.geolocation && !window.ambDesktop
          ? `<button class="btn glass-btn near-btn" data-radio-near>${icon('pin')}<span>${tr('Use My Location')}</span></button>` : '';
        return `<div class="page-pad">${largeTitle(listTitle(p))}${sub ? `<p class="meta-line">${esc(sub)}</p>` : ''}${nearBtn}<div class="radio-body">${bodyFor(e)}</div></div>`;
      },
      mount: (el, p, e) => {
        el._entry = e;
        if (p.kind === 'favorites') { e.loader = null; e.data = { items: saved }; return paintBody(el, e); }
        if (p.kind === 'recent') { e.loader = null; e.data = { items: recent }; return paintBody(el, e); }
        if (e.data && !e.data.busy && !e.data.error) return; // re-render: keep what we have
        e.loader = e.loader || (off =>
          p.kind === 'world' ? stations({}, off)
          : p.kind === 'country' ? stations({ countrycode: p.value }, off)
          : p.kind === 'tag' ? stations({ tag: p.value, order: 'votes' }, off)
          : p.kind === 'local' ? stations({ countrycode: homeCountry() }, off)
          : stations({ name: p.value, order: 'votes' }, off));
        fill(el, e, e.loader);
      },
    },

    radioCountries: {
      title: () => tr('Countries'),
      html: (p, e) => {
        e.bodyHTML = d => {
          const q = (p.q || '').toLowerCase();
          const rows = d.items.filter(c => !q || countryName(c.code, c.label).toLowerCase().includes(q) || c.code.toLowerCase() === q);
          return rows.length ? `<div class="list">${rows.map(c => navRow({ go: `radioList|country|${c.code}`, label: countryName(c.code, c.label), count: plural(c.count, 'station'), art: `<span class="cc">${esc(c.code)}</span>` })).join('')}</div>` : emptyMsg('No countries match.');
        };
        return `<div class="page-pad">${largeTitle(tr('Countries'))}<label class="search-field glass small">${icon('search')}<input type="search" data-cq placeholder="${tr('Find a country')}" autocomplete="off" value="${esc(p.q || '')}" aria-label="${tr('Find a country')}"></label><div class="radio-body">${bodyFor(e)}</div></div>`;
      },
      mount: (el, p, e) => {
        el._entry = e;
        const inp = el.querySelector('[data-cq]');
        inp.oninput = () => { p.q = inp.value; if (e.data?.items) paintBody(el, e); };
        if (e.data?.items) return;
        fill(el, e, async () => {
          const d = await cachedApi('amb-radio-countries', '/json/countries?hidebroken=true&order=stationcount&reverse=true');
          const byCode = new Map();
          for (const c of d) {
            const code = String(c.iso_3166_1 || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(code) || !c.stationcount) continue;
            const prev = byCode.get(code);
            byCode.set(code, { code, label: countryName(code, c.name), count: (prev?.count || 0) + (+c.stationcount || 0) });
          }
          return [...byCode.values()].sort((a, b) => b.count - a.count);
        });
      },
    },

    radioGenres: {
      title: () => tr('Genres'),
      html: (p, e) => {
        e.bodyHTML = d => `${sectionHead('Popular')}<div class="chips wrap">${TOP_GENRES.map(g => `<button class="chip" data-go="radioList|tag|${esc(g)}">${esc(genreName(g))}</button>`).join('')}</div>
          ${sectionHead('All Genres')}<div class="list">${d.items.map(t => navRow({ go: `radioList|tag|${t.name}`, label: genreName(t.name), count: plural(t.count, 'station') })).join('')}</div>`;
        return `<div class="page-pad">${largeTitle(tr('Genres'))}<div class="radio-body">${bodyFor(e)}</div></div>`;
      },
      mount: (el, p, e) => {
        el._entry = e;
        if (e.data?.items) return;
        fill(el, e, async () => {
          const d = await cachedApi('amb-radio-tags', '/json/tags?order=stationcount&reverse=true&hidebroken=true&limit=200');
          return d.filter(t => t.name && +t.stationcount >= 25 && t.name.length <= 24).map(t => ({ name: String(t.name).toLowerCase(), count: +t.stationcount }));
        });
      },
    },
  };
  return { pages: PAGES, customStream, countryName };
}
