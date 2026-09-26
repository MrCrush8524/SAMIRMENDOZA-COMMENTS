// Local metadata reader: ID3v2.2/2.3/2.4 + ID3v1 (MP3), MP4/M4A ilst atoms,
// FLAC Vorbis comments + PICTURE, Ogg Vorbis/Opus comments, WAV LIST/INFO.
// Nothing leaves the device.

const GENRES = ['Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance','Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise','AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop','Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta','Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave','Psychedelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock'];

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');
let utf16le, utf16be;
try { utf16le = new TextDecoder('utf-16le'); utf16be = new TextDecoder('utf-16be'); } catch { /* old engines */ }

const ascii = (u, s = 0, e = u.length) => latin1.decode(u.subarray(s, e));
const clean = s => String(s || '').replace(/\u0000+$/g, '').replace(/\u0000/g, ', ').trim();
const buf = async (file, start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());

function num(v) { const n = parseInt(String(v || ''), 10); return Number.isFinite(n) && n > 0 ? n : 0; }
function year(v) { const m = String(v || '').match(/(1[89]\d\d|20\d\d)/); return m ? +m[1] : 0; }
function genre(v) {
  let g = clean(v);
  const m = g.match(/^\((\d+)\)(.*)$/);
  if (m) g = m[2].trim() || GENRES[+m[1]] || '';
  else if (/^\d+$/.test(g)) g = GENRES[+g] || '';
  return g;
}

function syncsafe(u, o) { return ((u[o] & 0x7f) << 21) | ((u[o + 1] & 0x7f) << 14) | ((u[o + 2] & 0x7f) << 7) | (u[o + 3] & 0x7f); }
function be32(u, o) { return ((u[o] << 24) >>> 0) + (u[o + 1] << 16) + (u[o + 2] << 8) + u[o + 3]; }
function le32(u, o) { return (u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) >>> 0; }
function unsync(u) {
  const out = new Uint8Array(u.length); let j = 0;
  for (let i = 0; i < u.length; i++) { out[j++] = u[i]; if (u[i] === 0xff && u[i + 1] === 0x00) i++; }
  return out.subarray(0, j);
}

function decodeText(enc, u) {
  if (!u.length) return '';
  if (enc === 0) return latin1.decode(u);
  if (enc === 3) return utf8.decode(u);
  if (!utf16le) return '';
  if (enc === 1) {
    if (u[0] === 0xfe && u[1] === 0xff) return utf16be.decode(u.subarray(2));
    if (u[0] === 0xff && u[1] === 0xfe) return utf16le.decode(u.subarray(2));
    return utf16le.decode(u);
  }
  if (enc === 2) return utf16be.decode(u);
  return latin1.decode(u);
}
// Find end of a null-terminated string for the given encoding.
function termEnd(u, start, enc) {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < u.length; i += 2) if (u[i] === 0 && u[i + 1] === 0) return i;
    return u.length;
  }
  const i = u.indexOf(0, start); return i < 0 ? u.length : i;
}
const termLen = enc => (enc === 1 || enc === 2 ? 2 : 1);

// ---------- ID3v2 ----------
async function readID3v2(file, out) {
  const h = await buf(file, 0, 10);
  if (ascii(h, 0, 3) !== 'ID3') return false;
  const ver = h[3], flags = h[5];
  if (ver < 2 || ver > 4) return false;
  const size = syncsafe(h, 6);
  let u = await buf(file, 10, 10 + size);
  if ((flags & 0x80) && ver < 4) u = unsync(u);
  let p = 0;
  if (flags & 0x40) {
    if (ver === 3) p = 4 + be32(u, 0);
    else if (ver === 4) p = syncsafe(u, 0);
  }
  const idLen = ver === 2 ? 3 : 4, hdrLen = ver === 2 ? 6 : 10;
  let pics = [];
  while (p + hdrLen <= u.length) {
    const id = ascii(u, p, p + idLen);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    let fsize;
    if (ver === 2) fsize = (u[p + 3] << 16) | (u[p + 4] << 8) | u[p + 5];
    else if (ver === 4) {
      fsize = syncsafe(u, p + 4);
      // Some writers store plain 32-bit sizes in v2.4.
      const alt = be32(u, p + 4), nx = p + hdrLen + fsize, nxAlt = p + hdrLen + alt;
      const okId = q => q + 4 <= u.length && /^[A-Z0-9]{4}$/.test(ascii(u, q, q + 4));
      if (alt !== fsize && !okId(nx) && okId(nxAlt)) fsize = alt;
    } else fsize = be32(u, p + 4);
    const fflags = ver === 2 ? 0 : u[p + 9];
    let d = u.subarray(p + hdrLen, p + hdrLen + fsize);
    p += hdrLen + fsize;
    if (fsize <= 0) continue;
    if (ver === 4) {
      if (fflags & 0x01) d = d.subarray(4); // data length indicator
      if (fflags & 0x02) d = unsync(d);
      if (fflags & 0x0c) continue; // compressed / encrypted
    } else if (ver === 3 && (fflags & 0xc0)) continue;
    try { id3Frame(id, d, out, pics); } catch { /* skip malformed frame */ }
  }
  if (pics.length) {
    const front = pics.find(x => x.type === 3) || pics[0];
    out.art = new Blob([front.data], { type: front.mime });
  }
  return true;
}

function id3Frame(id, d, out, pics) {
  const text = () => clean(decodeText(d[0], d.subarray(1)));
  switch (id) {
    case 'TIT2': case 'TT2': out.title = text(); break;
    case 'TPE1': case 'TP1': out.artist = text(); break;
    case 'TALB': case 'TAL': out.album = text(); break;
    case 'TPE2': case 'TP2': out.albumArtist = text(); break;
    case 'TRCK': case 'TRK': out.track = num(text()); break;
    case 'TPOS': case 'TPA': out.disc = num(text()); break;
    case 'TYER': case 'TYE': case 'TDRC': case 'TDRL': case 'TDOR': if (!out.year) out.year = year(text()); break;
    case 'TCON': case 'TCO': out.genre = genre(text()); break;
    case 'TLEN': case 'TLE': { const ms = num(text()); if (ms > 1000) out.duration = ms / 1000; break; }
    case 'USLT': case 'ULT': {
      const enc = d[0]; const e = termEnd(d, 4, enc);
      const lyr = decodeText(enc, d.subarray(e + termLen(enc))).trim();
      if (lyr && !out.lyrics) out.lyrics = lyr;
      break;
    }
    case 'SYLT': {
      const enc = d[0], fmt = d[4];
      if (fmt !== 2) break; // only millisecond timestamps
      let q = termEnd(d, 6, enc) + termLen(enc); const lines = [];
      while (q < d.length) {
        const e = termEnd(d, q, enc); const t = decodeText(enc, d.subarray(q, e)).replace(/^\n/, '');
        q = e + termLen(enc); if (q + 4 > d.length) break;
        const ms = be32(d, q); q += 4;
        lines.push(`[${lrcTime(ms / 1000)}]${t}`);
      }
      if (lines.length) out.lyrics = lines.join('\n');
      break;
    }
    case 'APIC': {
      const enc = d[0]; const me = d.indexOf(0, 1); const mime = ascii(d, 1, me) || 'image/jpeg';
      const type = d[me + 1]; const de = termEnd(d, me + 2, enc);
      pics.push({ type, mime: mime.includes('/') ? mime : 'image/' + mime.toLowerCase(), data: d.slice(de + termLen(enc)) });
      break;
    }
    case 'PIC': {
      const enc = d[0]; const fmt = ascii(d, 1, 4).toLowerCase(); const type = d[4]; const de = termEnd(d, 5, enc);
      pics.push({ type, mime: fmt === 'png' ? 'image/png' : 'image/jpeg', data: d.slice(de + termLen(enc)) });
      break;
    }
  }
}

export function lrcTime(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0');
}

async function readID3v1(file, out) {
  if (file.size < 128) return;
  const u = await buf(file, file.size - 128, file.size);
  if (ascii(u, 0, 3) !== 'TAG') return;
  const f = (s, e) => clean(latin1.decode(u.subarray(s, e)));
  out.title ||= f(3, 33); out.artist ||= f(33, 63); out.album ||= f(63, 93);
  out.year ||= year(f(93, 97));
  if (u[125] === 0 && u[126]) out.track ||= u[126];
  if (!out.genre && GENRES[u[127]]) out.genre = GENRES[u[127]];
}

// ---------- MP4 / M4A ----------
async function readMP4(file, out) {
  let pos = 0, moov = null, guard = 0;
  while (pos + 8 <= file.size && guard++ < 64) {
    const h = await buf(file, pos, pos + 16);
    let size = be32(h, 0); const type = ascii(h, 4, 8); let hl = 8;
    if (size === 1) { size = be32(h, 8) * 4294967296 + be32(h, 12); hl = 16; }
    else if (size === 0) size = file.size - pos;
    if (size < 8) break;
    if (type === 'moov') { if (size < 64 * 1024 * 1024) moov = await buf(file, pos + hl, pos + size); break; }
    pos += size;
  }
  if (!moov) return false;
  const walk = (u, s, e, fn) => {
    let p = s;
    while (p + 8 <= e) {
      const size = be32(u, p); const type = ascii(u, p + 4, p + 8);
      if (size < 8 || p + size > e) break;
      fn(type, p + 8, p + size);
      p += size;
    }
  };
  walk(moov, 0, moov.length, (t, s, e) => {
    if (t === 'mvhd') {
      const v = moov[s];
      const ts = v === 1 ? be32(moov, s + 20) : be32(moov, s + 12);
      const du = v === 1 ? be32(moov, s + 24) * 4294967296 + be32(moov, s + 28) : be32(moov, s + 16);
      if (ts) out.duration = du / ts;
    }
    if (t !== 'udta') return;
    walk(moov, s, e, (t2, s2, e2) => {
      if (t2 !== 'meta') return;
      walk(moov, s2 + 4, e2, (t3, s3, e3) => {
        if (t3 !== 'ilst') return;
        walk(moov, s3, e3, (key, s4, e4) => {
          walk(moov, s4, e4, (dt, s5, e5) => {
            if (dt !== 'data') return;
            const kind = be32(moov, s5) & 0xffffff; const v = moov.subarray(s5 + 8, e5);
            const str = () => clean(utf8.decode(v));
            switch (key) {
              case '\xa9nam': out.title = str(); break;
              case '\xa9ART': out.artist = str(); break;
              case '\xa9alb': out.album = str(); break;
              case 'aART': out.albumArtist = str(); break;
              case '\xa9gen': out.genre = str(); break;
              case 'gnre': if (v.length >= 2) out.genre ||= GENRES[((v[0] << 8) | v[1]) - 1] || ''; break;
              case '\xa9day': out.year = year(str()); break;
              case 'trkn': if (v.length >= 4) out.track = (v[2] << 8) | v[3]; break;
              case 'disk': if (v.length >= 4) out.disc = (v[2] << 8) | v[3]; break;
              case '\xa9lyr': out.lyrics = utf8.decode(v).trim(); break;
              case 'covr': if (!out.art) out.art = new Blob([v.slice()], { type: kind === 14 ? 'image/png' : 'image/jpeg' }); break;
            }
          });
        });
      });
    });
  });
  return true;
}

// ---------- Vorbis comments (FLAC / Ogg) ----------
function vorbisComments(u, p, out) {
  const vlen = le32(u, p); p += 4 + vlen;
  const n = le32(u, p); p += 4;
  for (let i = 0; i < n && p + 4 <= u.length; i++) {
    const len = le32(u, p); p += 4;
    const s = utf8.decode(u.subarray(p, p + len)); p += len;
    const eq = s.indexOf('='); if (eq < 0) continue;
    const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1);
    switch (k) {
      case 'TITLE': out.title ||= clean(v); break;
      case 'ARTIST': out.artist ||= clean(v); break;
      case 'ALBUM': out.album ||= clean(v); break;
      case 'ALBUMARTIST': case 'ALBUM ARTIST': out.albumArtist ||= clean(v); break;
      case 'GENRE': out.genre ||= clean(v); break;
      case 'DATE': case 'YEAR': out.year ||= year(v); break;
      case 'TRACKNUMBER': out.track ||= num(v); break;
      case 'DISCNUMBER': out.disc ||= num(v); break;
      case 'LYRICS': case 'UNSYNCEDLYRICS': out.lyrics ||= v.trim(); break;
      case 'METADATA_BLOCK_PICTURE':
        if (!out.art) try { const b = Uint8Array.from(atob(v.trim()), c => c.charCodeAt(0)); flacPicture(b, out); } catch { /* bad base64 */ }
        break;
    }
  }
}
function flacPicture(u, out) {
  let p = 4; const ml = be32(u, p); p += 4; const mime = ascii(u, p, p + ml) || 'image/jpeg'; p += ml;
  const dl = be32(u, p); p += 4 + dl + 16; const len = be32(u, p); p += 4;
  out.art = new Blob([u.slice(p, p + len)], { type: mime });
}

async function readFLAC(file, out) {
  let p = 4, last = false, guard = 0;
  while (!last && p + 4 <= file.size && guard++ < 128) {
    const h = await buf(file, p, p + 4);
    last = !!(h[0] & 0x80); const type = h[0] & 0x7f; const len = (h[1] << 16) | (h[2] << 8) | h[3];
    p += 4;
    if (type === 0 || type === 4 || (type === 6 && !out.art)) {
      const d = await buf(file, p, p + len);
      if (type === 0) {
        const rate = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4);
        const total = (d[13] & 0x0f) * 4294967296 + be32(d, 14);
        if (rate && total) out.duration = total / rate;
      } else if (type === 4) vorbisComments(d, 0, out);
      else flacPicture(d, out);
    }
    p += len;
  }
  return true;
}

async function readOgg(file, out) {
  const u = await buf(file, 0, Math.min(file.size, 4 * 1024 * 1024));
  const packets = []; let cur = []; let p = 0;
  while (p + 27 <= u.length && packets.length < 2) {
    if (ascii(u, p, p + 4) !== 'OggS') break;
    const segs = u[p + 26]; const table = u.subarray(p + 27, p + 27 + segs);
    let q = p + 27 + segs;
    for (const s of table) {
      cur.push(u.subarray(q, q + s)); q += s;
      if (s < 255) { const tot = cur.reduce((a, b) => a + b.length, 0); const pk = new Uint8Array(tot); let o = 0; for (const c of cur) { pk.set(c, o); o += c.length; } packets.push(pk); cur = []; if (packets.length >= 2) break; }
    }
    p = q;
  }
  if (packets.length < 2) return false;
  const [id, com] = packets;
  let rate = 0, preskip = 0;
  if (ascii(id, 1, 7) === 'vorbis') rate = le32(id, 12);
  else if (ascii(id, 0, 8) === 'OpusHead') { rate = 48000; preskip = id[10] | (id[11] << 8); }
  if (ascii(com, 1, 7) === 'vorbis') vorbisComments(com, 7, out);
  else if (ascii(com, 0, 8) === 'OpusTags') vorbisComments(com, 8, out);
  if (rate) {
    const tail = await buf(file, Math.max(0, file.size - 65536), file.size);
    for (let i = tail.length - 14; i >= 0; i--) {
      if (tail[i] === 0x4f && ascii(tail, i, i + 4) === 'OggS') {
        const g = le32(tail, i + 6) + le32(tail, i + 10) * 4294967296;
        if (g > 0) out.duration = (g - preskip) / rate;
        break;
      }
    }
  }
  return true;
}

async function readWAV(file, out) {
  const u = await buf(file, 0, Math.min(file.size, 512 * 1024));
  let p = 12, byteRate = 0, dataLen = 0;
  while (p + 8 <= u.length) {
    const id = ascii(u, p, p + 4), len = le32(u, p + 4), s = p + 8;
    if (id === 'fmt ') byteRate = le32(u, s + 8);
    else if (id === 'data') { dataLen = len; if (s + len > u.length) break; }
    else if (id === 'LIST' && ascii(u, s, s + 4) === 'INFO') {
      let q = s + 4;
      while (q + 8 <= s + len) {
        const k = ascii(u, q, q + 4), l = le32(u, q + 4); const v = clean(utf8.decode(u.subarray(q + 8, q + 8 + l)));
        if (k === 'INAM') out.title = v; else if (k === 'IART') out.artist = v; else if (k === 'IPRD') out.album = v;
        else if (k === 'IGNR') out.genre = v; else if (k === 'ICRD') out.year = year(v); else if (k === 'ITRK') out.track = num(v);
        q += 8 + l + (l & 1);
      }
    }
    p = s + len + (len & 1);
  }
  if (byteRate && dataLen) out.duration = dataLen / byteRate;
  return true;
}

// Derive a readable title/artist/track from a filename when tags are missing.
export function fromFilename(name) {
  let base = String(name || 'Untitled').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const r = {};
  const tn = base.match(/^(\d{1,3})\s*[-.)]?\s+(.+)$/);
  if (tn) { r.track = +tn[1]; base = tn[2]; }
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) { r.artist = parts[0].trim(); r.title = parts.slice(1).join(' - ').trim(); }
  else r.title = base;
  return r;
}

export function formatOf(file) {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext) return ext;
  const t = file.type || '';
  return t.includes('mpeg') ? 'mp3' : t === 'video/mp4' ? 'mp4' : t.includes('quicktime') ? 'mov' : t.includes('mp4') ? 'm4a' : t.includes('flac') ? 'flac' : t.includes('ogg') ? 'ogg' : t.includes('wav') ? 'wav' : 'audio';
}

export async function readMetadata(file) {
  const out = {};
  try {
    const head = await buf(file, 0, 12);
    const sig = ascii(head, 0, 4);
    if (ascii(head, 0, 3) === 'ID3') await readID3v2(file, out);
    else if (sig === 'fLaC') await readFLAC(file, out);
    else if (sig === 'OggS') await readOgg(file, out);
    else if (sig === 'RIFF' && ascii(head, 8, 12) === 'WAVE') await readWAV(file, out);
    else if (ascii(head, 4, 8) === 'ftyp') await readMP4(file, out);
    if (!out.title || !out.artist) await readID3v1(file, out);
  } catch (e) { console.warn('metadata', file.name, e); }
  if (out.art && out.art.size < 64) delete out.art;
  return out;
}

// Stable content signature: size + first/last 64 KB.
export async function signature(file) {
  const a = await buf(file, 0, Math.min(file.size, 65536));
  const b = file.size > 131072 ? await buf(file, file.size - 65536, file.size) : new Uint8Array(0);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ file.size;
  const mix = u => { for (let i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 16777619); h2 = Math.imul(h2 ^ u[i], 2246822519) ^ (h2 >>> 13); } };
  mix(a); mix(b);
  return (file.size.toString(36) + '-' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36));
}

// Downscale artwork into a practical thumbnail so lists never decode full-size art.
export async function makeThumb(blob, size = 320) {
  try {
    if (!blob || !('createImageBitmap' in window)) return null;
    const bmp = await createImageBitmap(blob);
    const s = Math.min(bmp.width, bmp.height); if (!s) return null;
    const c = document.createElement('canvas'); c.width = c.height = Math.min(size, s);
    const g = c.getContext('2d');
    g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, c.width, c.height);
    bmp.close?.();
    return await new Promise(r => c.toBlob(b => r(b), 'image/jpeg', 0.84));
  } catch { return null; }
}

// Parse LRC text into timed lines, or return null for plain lyrics.
export function parseLRC(text) {
  if (!text) return null;
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!tags.length) continue;
    const words = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const t of tags) lines.push({ t: +t[1] * 60 + parseFloat(t[2].replace(':', '.')), text: words });
  }
  if (lines.length < 2) return null;
  return lines.sort((a, b) => a.t - b.t);
}
