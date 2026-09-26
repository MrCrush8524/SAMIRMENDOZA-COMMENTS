// Eporner API v2 — built-in adult provider (Discover › Adult only).
// Documented endpoint, GET, JSON. Uses the returned official `embed` URL for
// playback and `url` for "Open in Eporner". No HTML scraping, no stream
// extraction. Requests go directly from the browser; if the browser blocks
// them (CORS), LunaTV shows a provider error — it never routes through a proxy.
import { tr, trn } from "../i18n.js";
import { Provider, ProviderError, looksUnderage } from "./provider-base.js";
import * as db from "../database.js";

const API = "https://www.eporner.com/api/v2/video/search/";
export const EPORNER_TABS = [
  { id: "foryou", label: tr("For You"), order: "top-weekly" },
  { id: "gay", label: tr("Gay"), order: "top-weekly" },
  { id: "latest", label: tr("Latest"), order: "latest" },
  { id: "popular", label: tr("Popular"), order: "most-popular" },
  { id: "week", label: tr("This Week"), order: "top-weekly" },
  { id: "month", label: tr("This Month"), order: "top-monthly" },
  { id: "rated", label: tr("Top Rated"), order: "top-rated" },
  { id: "long", label: tr("Long"), order: "longest" },
  { id: "short", label: tr("Short"), order: "shortest" },
];

export function epornerParams({ tab = "foryou", query = "", page = 1, gayOnly = true, lowQuality = false, big = true }) {
  const t = EPORNER_TABS.find(x => x.id === tab) || EPORNER_TABS[0];
  return new URLSearchParams({
    query: query || "all", per_page: "24", page: String(page), thumbsize: big ? "big" : "medium",
    order: t.order, gay: gayOnly ? "2" : "0", lq: lowQuality ? "1" : "0", format: "json",
  });
}
export function normaliseEporner(v) {
  if (!v || typeof v !== "object" || !v.id) return null;
  const thumbs = Array.isArray(v.thumbs) ? v.thumbs.map(t => t?.src).filter(Boolean) : [];
  return {
    id: v.id, title: v.title || tr("Untitled"), creator: "Eporner",
    thumbnail: v.default_thumb?.src || thumbs[0] || "", thumbnails: thumbs,
    embedUrl: v.embed || "", sourceUrl: v.url || "",
    duration: v.length_sec || 0, views: v.views || 0, rating: parseFloat(v.rate) || 0,
    tags: typeof v.keywords === "string" ? v.keywords.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10) : [],
    addedAt: v.added || "", adult: true, kind: "embed",
  };
}

export const epornerProvider = new (class extends Provider {
  constructor() { super({ id: "eporner", name: tr("Eporner"), adult: true, tabs: EPORNER_TABS, search: true }); }
  async page({ tab, query, page, signal }) {
    const params = epornerParams({ tab, query, page, gayOnly: tab === "gay" || tab === "foryou" || db.setting("content.epornerGay") !== false, lowQuality: db.setting("content.epornerLowQuality"), big: innerWidth > 500 });
    let r;
    try { r = await fetch(`${API}?${params}`, { signal, credentials: "omit", referrerPolicy: "no-referrer" }); }
    catch (e) {
      if (e.name === "AbortError") throw e;
      throw new ProviderError(tr("LunaTV couldn’t reach Eporner right now. Your connection may be offline, or this browser blocked the request from this site."));
    }
    if (!r.ok) throw new ProviderError(tr("Eporner answered HTTP {p0}.", { p0: r.status }));
    const d = await r.json().catch(() => null);
    if (!d || !Array.isArray(d.videos)) throw new ProviderError(tr("Eporner sent a response LunaTV couldn’t read."));
    const items = d.videos.map(normaliseEporner).filter(x => x && x.embedUrl && !looksUnderage(x.title, ...x.tags));
    const total = +d.total_pages || 0;
    return { items, hasMore: total ? page < total : d.videos.length >= 24 };
  }
})();
