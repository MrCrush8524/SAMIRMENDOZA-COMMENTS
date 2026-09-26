// M3U / M3U8 channel-list parser. Malformed entries are skipped, never fatal.
// Unknown #EXTINF attributes are kept in `extra`.

export const CHANNEL_CATEGORIES = ["Movies", "Entertainment", "News", "Documentary", "Music", "Sports", "Kids", "International", "Local", "Other"];
const RULES = [
  ["Movies", /movie|film|cine|kino|pel[ií]cula|series|drama|classic/i],
  ["News", /news|noticias|notizie|nachrichten|info|business|weather|legislat|public|government|parliament/i],
  ["Sports", /sport|deporte|football|soccer|nba|nfl|racing|fight|wrestl|golf|tennis/i],
  ["Kids", /kid|child|cartoon|anim|infantil|family|junior/i],
  ["Music", /music|m[uú]sica|radio|hits|mtv|concert/i],
  ["Documentary", /doc|nature|science|history|discovery|education|learn|travel|outdoor/i],
  ["Local", /local|regional|city|community/i],
  ["International", /international|world|foreign|intl/i],
  ["Entertainment", /entertain|general|comedy|lifestyle|reality|show|variety|culture|cooking|shop|auto|religio/i],
];
export function categorize(...labels) {
  const s = labels.filter(Boolean).join(" ");
  for (const [cat, re] of RULES) if (re.test(s)) return cat;
  return "Other";
}
export const ADULT_RE = /\b(xxx|adult|18\s*\+|porn|erotic|nsfw)\b/i;

/** Returns { channels, isStream, epgUrl } */
export function parseM3U(text) {
  text = String(text || "").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.some(l => /^#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/.test(l))) return { isStream: true, channels: [], epgUrl: "" };
  const head = lines.find(l => l.startsWith("#EXTM3U")) || "";
  const epgUrl = (head.match(/(?:url-tvg|x-tvg-url)="([^"]+)"/i) || [])[1]?.split(",")[0].trim() || "";
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (l.startsWith("#EXTINF")) {
      try {
        const attrs = {};
        for (const m of l.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1].toLowerCase()] = m[2];
        const name = l.replace(/([\w-]+)="[^"]*"/g, "").replace(/^#EXTINF:[^,]*,/, "").trim();
        cur = { name: name || attrs["tvg-name"] || "", attrs };
      } catch { cur = null; }
    } else if (l.startsWith("#EXTGRP:")) { if (cur) cur.attrs["group-title"] ||= l.slice(8).trim(); }
    else if (/^#EXTVLCOPT:http-(referrer|user-agent)/i.test(l)) { if (cur) cur.headers = true; }
    else if (!l.startsWith("#")) {
      let url;
      try { url = new URL(l).href; } catch { cur = null; continue; }          // malformed: skip
      if (!/^https?:/i.test(url)) { cur = null; continue; }
      const a = cur?.attrs || {};
      const group = (a["group-title"] || "").split(";")[0].trim();
      const known = ["tvg-id", "tvg-name", "tvg-logo", "group-title", "tvg-country", "tvg-language"];
      out.push({
        name: cur?.name || a["tvg-name"] || new URL(url).hostname, url, urls: [url],
        tvgId: a["tvg-id"] || "", tvgName: a["tvg-name"] || "", logo: a["tvg-logo"] || "",
        group: group || "Other", category: categorize(group, cur?.name),
        country: (a["tvg-country"] || "").split(/[;,]/)[0].trim().toUpperCase().slice(0, 2),
        languages: a["tvg-language"] ? a["tvg-language"].split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 3) : [],
        needsHeaders: !!cur?.headers, adult: ADULT_RE.test(group) || ADULT_RE.test(cur?.name || ""),
        extra: Object.fromEntries(Object.entries(a).filter(([k]) => !known.includes(k))),
      });
      cur = null;
    }
  }
  return { channels: out, isStream: false, epgUrl };
}

/** Small stable hash for channel ids (keeps edits across playlist refreshes). */
export function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
