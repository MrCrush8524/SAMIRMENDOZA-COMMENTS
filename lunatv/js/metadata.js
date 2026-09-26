// Movie metadata providers. Optional: nothing here runs unless the user has
// added their own key in Settings › Providers (stored on this device only —
// a key in browser storage is visible to whoever uses this browser).
//
// Provider interface:
//   searchMovie(title, year) → { id, title, year, overview, rating, poster, backdrop } | null
//   getMovie(id), getPoster(id), getBackdrop(id), getCredits(id) → { director[], cast[] }
import * as db from "./database.js";
import { norm } from "./util.js";

const TTL_HIT = 30 * 86400e3, TTL_MISS = 7 * 86400e3;

const tmdb = {
  id: "tmdb", name: "TMDB",
  key: () => (db.setting("providers.tmdbKey") || "").trim(),
  async call(path, params = {}) {
    const k = this.key(); if (!k) throw new Error("no key");
    const bearer = k.length > 40;                                   // v4 read token vs v3 api key
    const q = new URLSearchParams(bearer ? params : { ...params, api_key: k });
    const r = await fetch(`https://api.themoviedb.org/3/${path}?${q}`, bearer ? { headers: { Authorization: `Bearer ${k}` } } : {});
    if (!r.ok) throw new Error(`TMDB ${r.status}`);
    return r.json();
  },
  img: (p, size) => (p ? `https://image.tmdb.org/t/p/${size}${p}` : ""),
  async searchMovie(title, year) {
    const d = await this.call("search/movie", { query: title, ...(year ? { year } : {}), include_adult: "false" });
    const m = d.results?.[0]; if (!m) return null;
    return { id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4), overview: m.overview, rating: m.vote_average, poster: this.img(m.poster_path, "w342"), backdrop: this.img(m.backdrop_path, "w780") };
  },
  async getMovie(id) { const m = await this.call(`movie/${id}`); return { id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4), overview: m.overview, runtime: m.runtime, genres: (m.genres || []).map(g => g.name), poster: this.img(m.poster_path, "w342"), backdrop: this.img(m.backdrop_path, "w780") }; },
  async getPoster(id) { return (await this.getMovie(id)).poster; },
  async getBackdrop(id) { return (await this.getMovie(id)).backdrop; },
  async getCredits(id) { const c = await this.call(`movie/${id}/credits`); return { director: (c.crew || []).filter(x => x.job === "Director").map(x => x.name).slice(0, 2), cast: (c.cast || []).slice(0, 8).map(x => x.name) }; },
};
export const PROVIDERS = [tmdb];
export const active = () => PROVIDERS.find(p => p.key());

let inflight = 0; const waiting = [];
const slot = () => new Promise(r => { if (inflight < 2) { inflight++; r(); } else waiting.push(r); });
const release = () => { inflight--; const n = waiting.shift(); if (n) { inflight++; n(); } };

/** Cached lookup; returns null when no provider is configured or nothing matched. */
export async function lookupMovie(title, year) {
  const p = active(); if (!p || !title) return null;
  const id = `movie:${norm(title)}|${year || ""}`;
  const hit = await db.get("metadataCache", id);
  if (hit && Date.now() - hit.at < (hit.data ? TTL_HIT : TTL_MISS)) return hit.data;
  await slot();
  try {
    const data = await p.searchMovie(title, year);
    await db.put("metadataCache", { id, at: Date.now(), data });
    return data;
  } catch { return null; } finally { release(); }
}
export async function credits(movieId) {
  const p = active(); if (!p || !movieId) return null;
  const id = `credits:${p.id}:${movieId}`, hit = await db.get("metadataCache", id);
  if (hit && Date.now() - hit.at < TTL_HIT) return hit.data;
  try { const data = await p.getCredits(movieId); await db.put("metadataCache", { id, at: Date.now(), data }); return data; } catch { return null; }
}
export async function clearMetadataCache() { await db.clear("metadataCache"); }
