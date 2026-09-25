// Home dashboard and Settings. X TV never appears here.
import { h, esc, icon, fmtBytes, on } from "./util.js";
import * as db from "./db.js";
import * as store from "./store.js";
import { setRoot, push, switchTab, toast, confirmBox, switchEl } from "./ui.js";
import { mediaCard, seriesCard, shelf, pickFiles, openGroup } from "./library.js";
import { favorites, recents, channelCard, clearHistory, directory, loadDirectory, setXTVHidden } from "./tv.js";
import { ytHistory, videoCard, clearYTHistory } from "./youtube.js";

export function initHome() {
  setRoot("home", {
    build(content) {
      const body = h(`<div></div>`);
      content.append(h(`<h1 class="page-title">Home</h1>`), body);
      let token = 0;
      const render = async () => {
        const my = ++token;
        const [media, gs, favCh, recCh, yt] = await Promise.all([store.allMedia(), store.groups(), favorites(false), recents(false), ytHistory()]);
        if (my !== token) return;
        const out = [];
        if (!media.length && !favCh.length && !recCh.length && !yt.length) {
          const w = h(`<div class="glass" style="padding:20px 18px;margin-top:4px"><b style="font-size:20px">Welcome to VIDeX</b><p class="note" style="margin:8px 0 14px;font-size:15px">Add videos from this device, or start with worldwide live TV.</p><div class="btn-row"><button class="btn blue">${icon("plus")}Import Videos</button><button class="btn">${icon("live")}Browse Live TV</button></div></div>`);
          const [a, b] = w.querySelectorAll("button"); a.onclick = pickFiles; b.onclick = () => switchTab("live");
          out.push(w);
        }
        const cont = media.filter(store.inProgress).sort((a, b) => b.watchedAt - a.watchedAt);
        if (cont.length) out.push(shelf("Continue Watching", cont, m => mediaCard(m, { variant: "continue" })));
        if (media.length) out.push(shelf("Recently Added", media.slice(0, 20), m => mediaCard(m), { onMore: () => switchTab("library") }));
        const favs = media.filter(m => m.favorite);
        if (favs.length) out.push(shelf("Favorites", favs, m => mediaCard(m)));
        const byId = new Map(media.map(m => [m.id, m]));
        for (const g of gs.filter(g => g.type === "playlist").slice(0, 3)) {
          const items = g.media.map(id => byId.get(id)).filter(Boolean);
          if (items.length) out.push(shelf(g.name, items, m => mediaCard(m, { list: items, group: g }), { onMore: () => { switchTab("library"); openGroup(g.id); } }));
        }
        const series = store.seriesOf(media);
        if (series.length) out.push(shelf("TV Shows", series.slice(0, 12), seriesCard));
        if (favCh.length) out.push(shelf("Favorite Channels", favCh, c => channelCard(c, { mini: true }), { onMore: () => switchTab("live") }));
        if (recCh.length) out.push(shelf("Recently Watched TV", recCh, c => channelCard(c, { mini: true }), { onMore: () => switchTab("live") }));
        if (yt.length) out.push(shelf("YouTube", yt.slice(0, 12), v => { const c = videoCard(v); c.style.cssText = "width:220px;flex:none"; return c; }, { onMore: () => switchTab("youtube") }));
        const set = h(`<div class="list glass" style="margin-top:28px"><button class="row"><span class="ic">${icon("gear")}</span><span class="label">Settings</span><span class="chev">${icon("chevR")}</span></button></div>`);
        set.firstElementChild.onclick = openSettings;
        out.push(set);
        body.replaceChildren(...out);
      };
      render();
      on("tv-changed", render); on("yt-changed", render);
      return { refresh: render };
    },
  });
}

function openSettings() {
  push({
    title: "Settings", build(content) {
      const render = async () => {
        const [est, persisted, media] = await Promise.all([db.estimate(), db.isPersisted(), store.allMedia()]);
        const d = directory();
        const el = h(`<div><div class="big-title">Settings</div>
          <div class="section-label">Storage</div>
          <div class="list glass">
            <div class="row static"><span class="ic">${icon("storage")}</span><span class="label">${media.length} video${media.length === 1 ? "" : "s"} in VIDeX<span class="sub">${est?.quota ? `${fmtBytes(est.usage)} used of ${fmtBytes(est.quota)} available to this site` : "Storage size not reported by this browser"}</span></span></div>
            <button class="row" data-a="persist"><span class="ic">${icon("lock")}</span><span class="label">${!db.persistent ? "Storage unavailable" : persisted ? "Storage is persistent" : "Keep videos stored"}<span class="sub">${!db.persistent ? "Private browsing or blocked storage: videos last only for this session." : persisted ? "The browser has agreed not to clear VIDeX data automatically." : "Ask the browser not to clear VIDeX data when space runs low. Browsers decide this themselves."}</span></span></button>
          </div>
          <div class="section-label">Live TV</div>
          <div class="list glass">
            <button class="row" data-a="refresh"><span class="ic">${icon("globe")}</span><span class="label">Refresh channel directory<span class="sub">${d.data ? `${d.live.length.toLocaleString()} channels · updated ${new Date(d.data.at).toLocaleString()}` : d.state === "error" ? "Last load failed" : "Not loaded yet"}</span></span></button>
            <button class="row" data-a="clearTv"><span class="ic">${icon("clock")}</span><span class="label">Clear Live TV history</span></button>
            <div class="row static"><span class="ic">${icon("eyeOff")}</span><span class="label">Show X TV in Live TV<span class="sub">The separate 18+ area</span></span><span class="sw"></span></div>
          </div>
          <div class="section-label">YouTube</div>
          <div class="list glass"><button class="row" data-a="clearYt"><span class="ic">${icon("clock")}</span><span class="label">Clear YouTube history</span></button></div>
          <div class="section-label">About</div>
          <div class="list glass"><div class="row static"><span class="ic">${icon("info")}</span><span class="label">VIDeX<span class="sub">Local videos stay on this device. Live TV lists free streams from public directories; availability depends on each broadcaster.</span></span></div></div>
        </div>`);
        el.querySelector(".sw").replaceWith(switchEl(!db.prefs.get("xtv.hidden", false), v => { setXTVHidden(!v); toast(v ? "X TV shown in Live TV" : "X TV hidden"); }));
        const acts = {
          persist: async () => { const ok = await db.requestPersist(); toast(ok ? "Storage is now persistent" : "The browser declined. It may allow it after you use VIDeX more or install it to the Home Screen.", { ms: 4000 }); render(); },
          refresh: async () => { toast("Refreshing channels…"); await loadDirectory({ force: true }); render(); },
          clearTv: async () => { if (await confirmBox({ title: "Clear Live TV history?", ok: "Clear", danger: true })) { await clearHistory(false); toast("Live TV history cleared"); } },
          clearYt: async () => { if (await confirmBox({ title: "Clear YouTube history in VIDeX?", ok: "Clear", danger: true })) { await clearYTHistory(); toast("YouTube history cleared"); } },
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
      };
      render();
      return { refresh: render };
    },
  });
}
