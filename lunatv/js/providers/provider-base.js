// Luna Feed provider contract. Every adapter returns normalised items:
// { id, provider, title, creator, thumbnail, thumbnails, previewUrl, videoUrl,
//   embedUrl, sourceUrl, duration, views, rating, tags, categories, addedAt,
//   adult, kind: "local"|"video"|"embed"|"youtube", ytId? }
// Any optional field may be missing; the feed renderer tolerates that.
import { safeURL } from "../util.js";

export class Provider {
  constructor({ id, name, adult = false, tabs = [{ id: "all", label: "All" }], search = false }) {
    Object.assign(this, { id, name, adult, tabs, search });
  }
  /** → { items, hasMore } — throw ProviderError for user-facing failures. */
  async page(/* { tab, query, page, signal } */) { return { items: [], hasMore: false }; }
  available() { return true; }
}
export class ProviderError extends Error { constructor(msg, { retry = true } = {}) { super(msg); this.retry = retry; } }

/** Drop anything that isn't a plain http(s) URL; clamp numbers; never trust types. */
export function normalise(p, raw) {
  const n = (x, d = 0) => (Number.isFinite(+x) ? +x : d);
  const str = x => (typeof x === "string" ? x : x == null ? "" : String(x)).slice(0, 400);
  return {
    id: `${p}:${str(raw.id)}`, provider: p, title: str(raw.title) || "Untitled", creator: str(raw.creator),
    thumbnail: safeURL(raw.thumbnail), thumbnails: (Array.isArray(raw.thumbnails) ? raw.thumbnails : []).map(safeURL).filter(Boolean).slice(0, 12),
    previewUrl: safeURL(raw.previewUrl), videoUrl: raw.videoUrl?.startsWith?.("blob:") ? raw.videoUrl : safeURL(raw.videoUrl), embedUrl: safeURL(raw.embedUrl), sourceUrl: safeURL(raw.sourceUrl),
    duration: n(raw.duration), views: n(raw.views), rating: n(raw.rating), tags: (Array.isArray(raw.tags) ? raw.tags : []).map(str).slice(0, 12),
    categories: (Array.isArray(raw.categories) ? raw.categories : []).map(str).slice(0, 8), addedAt: str(raw.addedAt), adult: !!raw.adult,
    kind: raw.kind || (raw.videoUrl ? "video" : raw.embedUrl ? "embed" : "video"), ytId: raw.ytId || "", localId: raw.localId || "",
  };
}

// Anything that indicates minors is dropped before it can reach the screen.
const UNDERAGE = /\b(under\s?age|underage|minor|minors|child|children|kid|kids|pre-?teen|loli|lolita|shota|jail\s?bait|school\s?girl|school\s?boy|young\s?teen)\b|\b(1[0-7]|[1-9])\s?(yo|y\/o|yrs?\s?old|years?\s?old)\b/i;
export const looksUnderage = (...s) => UNDERAGE.test(s.filter(Boolean).join(" "));
