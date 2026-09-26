// XMLTV parser, off the main thread so large guides never freeze the UI.
// Accepts an ArrayBuffer (plain or gzip) or a URL to fetch. Workers have no
// DOMParser, so this is a tolerant tag scanner. Only a window around "now"
// (6 h back, 72 h ahead) is kept.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m).trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")); return m ? dec(m[2] ?? m[3]) : ""; };
const all = (body, tag) => [...body.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi"))];
const first = (body, tag) => { const m = body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i")); return m ? dec(m[1]) : ""; };

function time(s) {
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?\s*([+-]\d{4}|Z)?/);
  if (!m) return NaN;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (m[7] && m[7] !== "Z") { const sign = m[7][0] === "-" ? -1 : 1, hh = +m[7].slice(1, 3), mm = +m[7].slice(3, 5); t -= sign * (hh * 60 + mm) * 60000; }
  return t;
}
function episode(body) {
  let season = 0, ep = 0;
  for (const [, a, v] of all(body, "episode-num")) {
    const sys = attr(a, "system"), val = dec(v);
    if (sys === "xmltv_ns") { const p = val.split("."); if (p[0]?.trim()) season = parseInt(p[0], 10) + 1; if (p[1]?.trim()) ep = parseInt(p[1], 10) + 1; }
    else { const m = val.match(/S(\d+)\s*E(\d+)/i); if (m) { season = +m[1]; ep = +m[2]; } }
  }
  return { season: season || 0, episode: ep || 0 };
}

async function toText(input) {
  if (typeof input === "string") {
    const r = await fetch(input);
    if (!r.ok) throw new Error(`The guide server answered HTTP ${r.status}.`);
    input = await r.arrayBuffer();
  }
  const u8 = new Uint8Array(input);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser can’t unzip .gz guides. Use an uncompressed XMLTV file.");
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(s).text();
  }
  return new TextDecoder("utf-8").decode(u8);
}

self.onmessage = async e => {
  try {
    const text = await toText(e.data.input);
    if (!/<tv[\s>]/i.test(text)) throw new Error("That file isn’t XMLTV (no <tv> element).");
    const now = Date.now(), from = now - 6 * 3600e3, to = now + 72 * 3600e3;
    const channels = [];
    for (const m of text.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)) {
      const id = attr(m[1], "id"); if (!id) continue;
      const icon = (m[2].match(/<icon\b[^>]*src\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
      channels.push({ id, names: all(m[2], "display-name").map(x => dec(x[2])).filter(Boolean), icon: dec(icon) });
    }
    const programmes = {}; let count = 0, skipped = 0;
    for (const m of text.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
      const a = m[1], b = m[2];
      const s = time(attr(a, "start")), en = time(attr(a, "stop")), c = attr(a, "channel");
      if (!c || isNaN(s)) { skipped++; continue; }
      const end = isNaN(en) ? s + 30 * 60000 : en;
      if (end < from || s > to) continue;
      const credits = (b.match(/<credits>([\s\S]*?)<\/credits>/i) || [])[1] || "";
      const img = (b.match(/<icon\b[^>]*src\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
      const rating = (b.match(/<rating\b[^>]*>[\s\S]*?<value>([\s\S]*?)<\/value>/i) || [])[1] || "";
      const p = {
        s, e: end, t: first(b, "title") || "Untitled", st: first(b, "sub-title"), d: first(b, "desc"),
        cat: all(b, "category").map(x => dec(x[2])).filter(Boolean).slice(0, 4),
        y: (first(b, "date").match(/\d{4}/) || [""])[0], r: dec(rating), img: dec(img),
        dir: all(credits, "director").map(x => dec(x[2])).slice(0, 3), cast: all(credits, "actor").map(x => dec(x[2])).slice(0, 8),
        ...episode(b),
      };
      (programmes[c] ||= []).push(p); count++;
    }
    for (const k in programmes) programmes[k].sort((x, y) => x.s - y.s);
    self.postMessage({ ok: true, data: { channels, programmes, count, skipped } });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof TypeError ? "LunaTV couldn’t download that guide. The server may not allow browsers to read it (CORS), or it’s unreachable." : String(err.message || err) });
  }
};
