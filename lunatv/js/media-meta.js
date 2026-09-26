// Filename → title / series metadata. Pure functions, no DOM.

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|ogv|3gp|ts|m2ts|mpg|mpeg|wmv|flv)$/i;
export const isVideoFile = f => (f.type || "").startsWith("video/") || VIDEO_EXT.test(f.name || "");

const tidy = s => s.replace(/[._]+/g, " ").replace(/\s*[-–]\s*$/, "").replace(/\s{2,}/g, " ").trim();

/** "Show.Name.S01E04.720p" / "Show Name - 1x04" / "Show Season 2 Episode 3" → {series, season, episode} */
export function parseEpisode(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  let m = base.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})/);
  if (!m) m = base.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})\b/);
  if (!m) { const n = base.match(/^(.*?)[\s._-]*season[\s._-]*(\d{1,2}).*?episode[\s._-]*(\d{1,3})/i); if (n) m = n; }
  if (!m) return null;
  return { series: tidy(m[1]) || "Unknown Series", season: +m[2], episode: +m[3] };
}

/** Display title from a filename: strip extension and common release noise. */
export function cleanTitle(filename) {
  let s = filename.replace(/\.[^.]+$/, "");
  s = s.replace(/[._]+/g, " ");
  s = s.replace(/\b(2160p|1080p|720p|480p|4k|uhd|hdr10?|dv|x26[45]|h\.?26[45]|hevc|web-?dl|webrip|bluray|brrip|dvdrip|aac\d?(\.\d)?|ac3|dts|yify|rarbg)\b.*$/i, "");
  s = s.replace(/\s*[\[(]\s*[\])]\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  return s || filename;
}

export const epLabel = m => m.category === "tv" && m.season ? `S${m.season} E${m.episode}` : "";
