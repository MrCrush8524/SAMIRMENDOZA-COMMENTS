// Subtitles: SRT → VTT conversion, VTT parsing, and a renderer LunaTV draws
// itself (so size, colour, background, position, line height and ±10 s sync
// all work the same in every browser). Cue text is escaped; only <i>, <b>, <u>
// survive as formatting.
import * as db from "./database.js";
import { esc } from "./util.js";

export function toVTT(text) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^WEBVTT/.test(text)) return text;
  return "WEBVTT\n\n" + text.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2").replace(/^\d+\n(?=\d{1,2}:\d{2})/gm, "");
}
const ts = s => { const p = s.trim().split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
export function parseVTT(text) {
  const cues = [];
  for (const block of toVTT(text).split(/\n{2,}/)) {
    const lines = block.split("\n"), i = lines.findIndex(l => l.includes("-->"));
    if (i < 0) continue;
    const m = lines[i].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!m) continue;
    const body = lines.slice(i + 1).join("\n").trim();
    if (body) cues.push({ start: ts(m[1]), end: ts(m[2]), text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}
const fmt = t => esc(t).replace(/&lt;(\/?)(i|b|u)&gt;/g, "<$1$2>").replace(/&lt;[^&]*?&gt;/g, "").replace(/\n/g, "<br>");

export class SubtitleRenderer {
  constructor(layer) { this.layer = layer; this.cues = []; this.offset = 0; this.last = ""; this.applyStyle(); }
  load(cues) { this.cues = cues || []; this.last = null; this.render(0); }
  clear() { this.cues = []; this.layer.innerHTML = ""; this.last = ""; }
  get active() { return this.cues.length > 0; }
  render(t) {
    const at = t - this.offset;
    const on = this.cues.filter(c => c.start <= at && c.end > at).map(c => c.text).join("\n");
    if (on === this.last) return;
    this.last = on;
    this.layer.innerHTML = on ? `<span>${fmt(on)}</span>` : "";
  }
  applyStyle() {
    const s = k => db.setting(`subs.${k}`), st = this.layer.style;
    const hex = s("bg").replace("#", ""), [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) || 0);
    st.setProperty("--sub-size", `${(s("size") / 100 * 2.6).toFixed(2)}vmin`);
    st.setProperty("--sub-weight", s("weight"));
    st.setProperty("--sub-color", s("color"));
    st.setProperty("--sub-bg", `rgba(${r},${g},${b},${s("bgOpacity")})`);
    st.setProperty("--sub-bottom", `${s("position")}%`);
    st.setProperty("--sub-lh", s("lineHeight"));
  }
}
