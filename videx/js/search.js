// Global search: local library (titles, filenames, series, playlists,
// collections) and ordinary Live TV. X TV is never searched from here.
import { h, esc, icon, on } from "./util.js";
import { setRoot, searchField, segmented, incremental } from "./ui.js";
import { searchLibrary, mediaCard, openSeries, openGroup } from "./library.js";
import { searchLive, channelCard, loadDirectory, directory, openCountry, liveCtx } from "./tv.js";

export function initSearch() {
  setRoot("search", {
    build(content, view) {
      let q = "", scope = "library", stop = () => {}, token = 0;
      const out = h(`<div></div>`);
      const field = searchField("Videos, shows, playlists, channels", v => { q = v; render(); });
      content.append(h(`<h1 class="page-title">Search</h1>`), field,
        segmented([["library", "Library"], ["live", "Live TV"]], scope, v => { scope = v; render(); }), out);

      async function render() {
        const my = ++token;
        stop(); stop = () => {};
        if (!q) {
          out.replaceChildren(h(`<p class="note">${scope === "library" ? "Search titles, filenames, TV series, playlists and collections as you type." : "Search free live channels by name, network or country."}</p>`));
          return;
        }
        if (scope === "library") {
          const r = await searchLibrary(q);
          if (my !== token) return;
          const parts = [];
          if (r.media.length) { const g = h(`<div class="grid"></div>`); r.media.forEach(m => g.append(mediaCard(m, { list: r.media }))); parts.push(h(`<div class="section-label">Videos · ${r.media.length}</div>`), g); }
          if (r.series.length) {
            const l = h(`<div class="list glass"></div>`);
            r.series.forEach(s => { const b = h(`<button class="row"><span class="ic">${icon("tv")}</span><span class="label">${esc(s.series)}<span class="sub">${s.episodes.length} episodes</span></span><span class="chev">${icon("chevR")}</span></button>`); b.onclick = () => openSeries(s.series); l.append(b); });
            parts.push(h(`<div class="section-label">TV Shows</div>`), l);
          }
          if (r.groups.length) {
            const l = h(`<div class="list glass"></div>`);
            r.groups.forEach(g => { const b = h(`<button class="row"><span class="ic">${icon(g.type === "playlist" ? "playlist" : "folderLine")}</span><span class="label">${esc(g.name)}<span class="sub">${g.type === "playlist" ? "Playlist" : "Collection"} · ${g.media.length} videos</span></span><span class="chev">${icon("chevR")}</span></button>`); b.onclick = () => openGroup(g.id); l.append(b); });
            parts.push(h(`<div class="section-label">Playlists & Collections</div>`), l);
          }
          out.replaceChildren(...(parts.length ? parts : [h(`<div class="empty">Nothing in your library matches “${esc(q)}”.</div>`)]));
          return;
        }
        const d = directory();
        if (d.state !== "ready") {
          out.replaceChildren(h(`<div class="loading"><span class="spinner"></span><span>Loading the channel directory…</span></div>`));
          loadDirectory();
          return;
        }
        const r = searchLive(q), parts = [];
        if (r.countries.length) {
          const l = h(`<div class="list glass"></div>`);
          r.countries.forEach(c => { const b = h(`<button class="row"><span class="flag">${c.flag}</span><span class="label">${esc(c.name)}</span><span class="trail"><span class="count">${c.count}</span><span class="chev">${icon("chevR")}</span></span></button>`); b.onclick = () => openCountry(c.code, liveCtx); l.append(b); });
          parts.push(h(`<div class="section-label">Countries</div>`), l);
        }
        parts.push(h(`<div class="section-label">Channels · ${r.channels.length.toLocaleString()}</div>`));
        out.replaceChildren(...parts);
        if (r.channels.length) { const g = h(`<div class="ch-grid"></div>`); out.append(g); stop = incremental(g, r.channels, c => channelCard(c), { chunk: 48, root: view }); }
        else out.append(h(`<div class="empty">No channels match “${esc(q)}”.</div>`));
      }
      on("dir", () => { if (scope === "live" && q) render(); });
      render();
      return { refresh: () => { if (q) render(); }, shown: () => field.querySelector("input").focus({ preventScroll: true }) };
    },
  });
}
