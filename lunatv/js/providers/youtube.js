// YouTube in the feed: official IFrame player only. Items come from what you've
// played or favourited in LunaTV, or — with your own API key — search.
import { Provider, ProviderError } from "./provider-base.js";
import { history, favorites } from "../collections.js";
import { canSearch, searchYouTube, thumb, watchURL } from "../youtube.js";

export const youtubeProvider = new (class extends Provider {
  constructor() { super({ id: "youtube", name: "YouTube", tabs: [{ id: "mine", label: "My YouTube" }, { id: "shorts", label: "Shorts" }], search: true }); this.tokens = {}; }
  async page({ tab, query, page }) {
    const toItem = s => ({ id: s.id, title: s.title, creator: s.creator || "YouTube", thumbnail: s.thumb || thumb(s.id), sourceUrl: watchURL(s.id), kind: "youtube", ytId: s.id });
    if (!query && tab === "mine") {
      if (page > 1) return { items: [], hasMore: false };
      const seen = new Set(), out = [];
      for (const r of [...await favorites({ type: "youtube" }), ...await history({ type: "youtube" })]) {
        const s = r.snapshot; if (!s?.id || seen.has(s.id)) continue; seen.add(s.id); out.push(toItem(s));
      }
      return { items: out, hasMore: false };
    }
    if (!canSearch()) throw new ProviderError("To browse Shorts or search YouTube here, add your own YouTube Data API key in Settings › Content › Providers. Pasted YouTube links always work without one.", { retry: false });
    const key = `${tab}|${query}`;
    if (page === 1) this.tokens[key] = "";
    else if (!this.tokens[key]) return { items: [], hasMore: false };
    const r = await searchYouTube(query || "shorts", { shorts: tab === "shorts", pageToken: this.tokens[key] });
    this.tokens[key] = r.next;
    return { items: r.items.map(i => toItem({ ...i, thumb: i.thumb })), hasMore: !!r.next };
  }
})();
