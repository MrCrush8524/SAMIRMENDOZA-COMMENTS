// Local media feed: your own library videos, played from this device.
import { Provider } from "./provider-base.js";
import * as media from "../media-store.js";

export const localProvider = new (class extends Provider {
  constructor() { super({ id: "local", name: "My Videos", tabs: [{ id: "recent", label: "Recent" }, { id: "short", label: "Short" }, { id: "shuffle", label: "Shuffle" }] }); }
  async page({ tab, page }) {
    if (page > 1) return { items: [], hasMore: false };
    let all = await media.allMedia();
    if (tab === "short") all = all.filter(m => m.duration && m.duration < 600);
    if (tab === "shuffle") all = all.map(m => [Math.random(), m]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    return { items: all.map(m => ({ id: m.id, title: m.title, creator: media.categoryName(m.category), thumbnail: "", duration: m.duration, kind: "local", localId: m.id })), hasMore: false };
  }
})();
