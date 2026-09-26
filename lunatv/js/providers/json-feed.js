// Configurable JSON feed + direct video feed. The JSON is data only — nothing
// in it is ever executed, and every URL is checked to be http(s).
import { tr, trn } from "../i18n.js";
import { Provider, ProviderError, looksUnderage } from "./provider-base.js";
import * as db from "../database.js";

export function validateFeed(json) {
  const items = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : null;
  if (!items) throw new Error(tr("The feed must be a JSON object with an \"items\" array."));
  const ok = items.filter(x => x && typeof x === "object" && (x.videoUrl || x.embedUrl) && (x.title || x.id));
  if (!ok.length) throw new Error(tr("No items with a videoUrl or embedUrl were found."));
  return ok.map((x, i) => ({ ...x, id: String(x.id ?? i) }));
}
export async function feeds() { return (await db.get("discoverState", "feeds"))?.list || []; }
export async function saveFeeds(list) { await db.put("discoverState", { id: "feeds", list }); }

export const jsonProvider = new (class extends Provider {
  constructor() { super({ id: "json", name: tr("My Feeds"), tabs: [{ id: "all", label: tr("All Feeds") }] }); }
  async page({ page, adult = false }) {
    if (page > 1) return { items: [], hasMore: false };
    const list = (await feeds()).filter(f => !!f.adult === adult);
    if (!list.length) throw new ProviderError(tr("No feeds yet. Add a JSON feed URL or file in Settings › Discover."), { retry: false });
    const out = [];
    for (const f of list) {
      try {
        const data = f.items || validateFeed(await (await fetch(f.url)).json());
        for (const x of data) {
          if (!!x.adult !== adult && !f.adult) continue;                 // adult items never leak into ordinary feeds
          if (f.adult && looksUnderage(x.title, ...(x.tags || []))) continue;
          out.push({ ...x, id: `${f.id}:${x.id}`, adult: adult, kind: x.videoUrl ? "video" : "embed" });
        }
      } catch { /* one broken feed doesn't sink the others */ }
    }
    if (!out.length) throw new ProviderError(tr("Your feeds didn’t return anything playable right now."));
    return { items: out, hasMore: false };
  }
})();

// Direct video URLs you've added one by one.
export async function directList() { return (await db.get("discoverState", "direct"))?.list || []; }
export async function addDirectVideo(url, title) { const list = await directList(); list.unshift({ id: Date.now().toString(36), videoUrl: url, title, sourceUrl: url }); await db.put("discoverState", { id: "direct", list }); }
export const directProvider = new (class extends Provider {
  constructor() { super({ id: "direct", name: tr("Direct Videos") }); }
  async page({ page }) {
    if (page > 1) return { items: [], hasMore: false };
    return { items: (await directList()).map(x => ({ ...x, kind: "video" })), hasMore: false };
  }
})();
