// Global search, updated as you type. Normalised matching (case, accents,
// punctuation) across library, channels, the guide, favorites, playlists,
// YouTube and Discover history. Adult items are never searched from here.
import { tr, trn } from "./i18n.js";
import { h, esc, icon, fuzzy, on } from "./util.js";
import * as media from "./media-store.js";
import * as L from "./channels.js";
import * as C from "./collections.js";
import { setRoot, searchField, switchTab } from "./ui.js";
import { mediaCard, seriesCard } from "./library.js";
import { channelRow, programCard } from "./live.js";
import { itemTile } from "./home.js";
import { openPlaylist } from "./playlists.js";

export function initSearch() {
  setRoot("search", {
    build(content) {
      let q = "", token = 0;
      const out = h(`<div></div>`);
      const field = searchField(tr("Movies, shows, channels, programmes…"), v => { q = v; render(); });
      content.append(h(`<h1 class="page-title">${tr("Search")}</h1>`), field, out);
      async function render() {
        const my = ++token;
        if (!q) { out.replaceChildren(h(`<p class="note">${tr("Search your videos, TV series, channels, what’s on now and later, playlists, favorites, YouTube and Discover history.")}</p>`)); return; }
        const match = fuzzy(q);
        const [all, pls, favs, hist] = await Promise.all([media.allMedia(), C.playlists(), C.favorites(), C.history()]);
        if (my !== token) return;
        const now = Date.now(), parts = [];
        const sec = (title, node) => parts.push(h(`<div class="section-label">${esc(title)}</div>`), node);
        const vids = all.filter(m => match(m.title, m.filename, m.series));
        if (vids.length) { const g = h(`<div class="grid"></div>`); vids.slice(0, 40).forEach(m => g.append(mediaCard(m, { list: vids }))); sec(tr("Library · {p0}", { p0: vids.length }), g); }
        const series = media.seriesOf(all).filter(s => match(s.series));
        if (series.length) { const g = h(`<div class="grid"></div>`); series.forEach(s => g.append(seriesCard(s))); sec(tr("TV Series"), g); }
        const chs = L.channels().filter(c => match(c.name, c.group, c.countryName, tr(c.category)));
        if (chs.length) { const l = h(`<div class="list glass"></div>`); chs.slice(0, 30).forEach(c => l.append(channelRow(c, chs))); sec(tr("Channels · {p0}", { p0: chs.length }), l); }
        const onNow = [], later = [];
        for (const c of L.channels()) for (const p of L.programmesFor(c)) if (match(p.t, p.st, p.d, ...(p.cat || []))) (p.s <= now && p.e > now ? onNow : p.s > now ? later : []).push({ channel: c, program: p });
        if (onNow.length) { const r = h(`<div class="rail"></div>`); onNow.slice(0, 20).forEach(x => r.append(programCard(x))); sec(tr("On Now"), r); }
        if (later.length) { const r = h(`<div class="rail"></div>`); later.sort((a, b) => a.program.s - b.program.s).slice(0, 20).forEach(x => r.append(programCard(x, { upcoming: true }))); sec(tr("Coming Up"), r); }
        const pl = pls.filter(p => match(p.name));
        if (pl.length) { const l = h(`<div class="list glass"></div>`); pl.forEach(p => { const b = h(`<button class="row"><span class="ic">${icon("playlist")}</span><span class="label">${esc(p.name)}<span class="sub">${trn("{n} item", "{n} items", p.items.length)}</span></span><span class="chev">${icon("chevR")}</span></button>`); b.onclick = () => { switchTab("playlists"); openPlaylist(p.id); }; l.append(b); }); sec(tr("Playlists"), l); }
        const fav = favs.filter(f => f.type !== "media" && f.type !== "channel" && match(f.title, f.snapshot?.title, f.snapshot?.channel));
        if (fav.length) { const g = h(`<div class="grid"></div>`); fav.slice(0, 20).forEach(f => g.append(itemTile(f, all))); sec(tr("Favorites"), g); }
        const yt = hist.filter(x => x.type === "youtube" && match(x.title));
        if (yt.length) { const g = h(`<div class="grid"></div>`); yt.slice(0, 20).forEach(f => g.append(itemTile(f, all))); sec(tr("YouTube"), g); }
        const fd = hist.filter(x => x.type === "feed" && !x.adult && match(x.title));
        if (fd.length) { const g = h(`<div class="grid"></div>`); fd.slice(0, 20).forEach(f => g.append(itemTile(f, all))); sec(tr("Discover"), g); }
        out.replaceChildren(...(parts.length ? parts : [h(`<div class="empty">${tr("Nothing matches “{q}”.", { q: esc(q) })}</div>`)]));
      }
      render();
      on("live-changed", () => { if (q) render(); });
      return { refresh: () => { if (q) render(); }, shown: () => { if (matchMedia("(hover:hover)").matches) field.querySelector("input").focus({ preventScroll: true }); } };
    },
  });
}
