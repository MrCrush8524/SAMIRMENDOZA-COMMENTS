// Playlists area: create, rename, delete, reorder, add/remove, Play All,
// Shuffle, Repeat. Items can be local videos or YouTube links; a playlist
// plays straight through both (YouTube items use the official player).
import { h, esc, icon, fmtDur, on, emit } from "./util.js";
import * as media from "./media-store.js";
import * as C from "./collections.js";
import { setRoot, push, back, sheet, toast, ask, confirmBox } from "./ui.js";
import { playLocal } from "./player.js";
import { parseYouTube } from "./youtube.js";

/** Add one item (or several) to a playlist, with "New Playlist…". */
export async function addToPlaylistSheet(items, label) {
  const list = [items].flat(), one = list.length === 1 ? list[0] : null;
  const pls = await C.playlists(), inIds = one ? await C.playlistsContaining(one) : [];
  sheet({
    title: "Add to Playlist", subtitle: label || one?.title || "",
    groups: [
      pls.map(p => ({ icon: "playlist", label: p.name, sub: `${p.items.length} item${p.items.length === 1 ? "" : "s"}`, check: inIds.includes(p.id), run: async () => {
        if (one) { const added = await C.toggleInPlaylist(p.id, one); toast(added ? `Added to ${p.name}` : `Removed from ${p.name}`); }
        else { await C.addManyToPlaylist(p.id, list); toast(`Added ${list.length} to ${p.name}`); }
      } })),
      [{ icon: "plus", label: "New Playlist…", run: async () => { const n = await ask({ title: "New Playlist", placeholder: "e.g. Watch Later", ok: "Create" }); if (!n) return; const p = await C.createPlaylist(n); await C.addManyToPlaylist(p.id, list); toast(`Added to ${n}`); } }],
    ],
  });
}

async function resolve(p) {
  const all = new Map((await media.allMedia()).map(m => [m.id, m]));
  return p.items.map(i => i.type === "media" ? all.get(i.ref) && { ...all.get(i.ref), _item: i } : i.type === "youtube" ? { _yt: true, id: i.ref, title: i.title || i.snapshot?.title || "YouTube video", thumb: i.snapshot?.thumb, _item: i } : null).filter(Boolean);
}
const thumbOf = e => e._yt ? (e.thumb || `https://i.ytimg.com/vi/${encodeURIComponent(e.id)}/mqdefault.jpg`) : media.posterCached(e.id);

export function initPlaylists() {
  const create = async () => { const n = await ask({ title: "New Playlist", placeholder: "e.g. Late Night", ok: "Create" }); if (n) { const p = await C.createPlaylist(n); openPlaylist(p.id); } };
  setRoot("playlists", {
    build(content) {
      const head = h(`<div><h1 class="page-title">Playlists</h1><div class="btn-row"><button class="btn blue">${icon("plus")}New Playlist</button></div></div>`);
      head.querySelector("button").onclick = create;
      const list = h(`<div style="margin-top:16px"></div>`);
      content.append(head, list);
      const render = async () => {
        const pls = await C.playlists();
        if (!pls.length) { list.replaceChildren(h(`<div class="empty big-empty"><b>No playlists yet</b><span>Try “Watch Later”, “Late Night” or “Comfort Movies”.</span></div>`)); return; }
        const g = h(`<div class="list glass"></div>`);
        for (const p of pls) {
          const items = await resolve(p), first = items[0];
          const t = first && thumbOf(first);
          const r = h(`<button class="row tall"><span class="thumb-sm">${t ? `<img alt="" src="${esc(t)}">` : `<span class="ph">${icon("playlist")}</span>`}</span><span class="label">${esc(p.name)}<span class="sub">${items.length} item${items.length === 1 ? "" : "s"}</span></span><span class="chev">${icon("chevR")}</span></button>`);
          r.onclick = () => openPlaylist(p.id);
          if (first && !first._yt && !t) media.poster(first.id).then(u => { const ph = r.querySelector(".ph"); if (u && ph) ph.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
          g.append(r);
        }
        list.replaceChildren(g);
      };
      render();
      return { refresh: render };
    },
  });
}

const REPEAT = { off: "Repeat off", all: "Repeat all", one: "Repeat one" };
export function openPlaylist(id) {
  let editing = false;
  const editBtn = h(`<button class="icon-btn text-btn" aria-label="Edit order">Edit</button>`);
  const moreBtn = h(`<button class="icon-btn" aria-label="Playlist options">${icon("more")}</button>`);
  push({
    title: "", actions: [editBtn, moreBtn], build(content, view) {
      const render = async () => {
        const p = await C.getPlaylist(id);
        if (!p) { content.replaceChildren(h(`<div class="empty">This playlist was deleted.</div>`)); editBtn.hidden = moreBtn.hidden = true; return; }
        view.querySelector(".navbar h1").textContent = p.name;
        const items = await resolve(p), fav = C.isFavorite("playlist", p.id);
        editBtn.hidden = items.length < 2; editBtn.textContent = editing ? "Done" : "Edit";
        const total = items.reduce((a, m) => a + (m.duration || 0), 0);
        const el = h(`<div><div class="big-title">${esc(p.name)}</div><p class="note">${items.length} item${items.length === 1 ? "" : "s"}${total ? " · " + fmtDur(total) : ""}</p>
          <div class="btn-row">
            <button class="btn primary" data-a="play"${items.length ? "" : " disabled"}>${icon("play")}Play All</button>
            <button class="round" data-a="shuffle" aria-label="Shuffle"${items.length > 1 ? "" : " disabled"}>${icon("shuffle")}</button>
            <button class="round${p.repeat !== "off" ? " on" : ""}" data-a="repeat" aria-label="${REPEAT[p.repeat || "off"]}" title="${REPEAT[p.repeat || "off"]}" style="position:relative">${icon("repeat")}${p.repeat === "one" ? `<b class="rep1">1</b>` : ""}</button>
            <button class="round${fav ? " on" : ""}" data-a="fav" aria-label="${fav ? "Remove playlist from favorites" : "Favorite this playlist"}">${icon(fav ? "heartFill" : "heart")}</button>
            <button class="round" data-a="add" aria-label="Add items">${icon("plus")}</button>
          </div><div class="items" style="margin-top:14px"></div></div>`);
        const box = el.querySelector(".items");
        if (!items.length) box.append(h(`<div class="empty">This playlist is empty. Tap + to add videos or a YouTube link.</div>`));
        else {
          const list = h(`<div class="list glass"></div>`);
          items.forEach((e, i) => {
            const trail = editing ? `<button class="icon-btn plain" data-mv="-1" aria-label="Move up"${i ? "" : " disabled"}>${icon("up")}</button><button class="icon-btn plain" data-mv="1" aria-label="Move down"${i < items.length - 1 ? "" : " disabled"}>${icon("down")}</button><button class="icon-btn plain" data-rm aria-label="Remove from playlist">${icon("close")}</button>` : "";
            const t = thumbOf(e);
            const r = h(`<div class="row tall" style="padding-right:4px"><button class="thumb-sm" data-id="${esc(e.id)}" aria-label="Play ${esc(e.title)}">${t ? `<img alt="" src="${esc(t)}">` : `<span class="ph">${icon("film")}</span>`}</button><button class="label" style="text-align:left">${esc(e.title)}<span class="sub">${e._yt ? "YouTube" : [media.categoryName(e.category), fmtDur(e.duration)].filter(Boolean).join(" · ")}</span></button>${trail}</div>`);
            const play = () => playLocal(items, i, { repeat: p.repeat });
            r.querySelector(".thumb-sm").onclick = play; r.querySelector(".label").onclick = play;
            if (!e._yt && !t) media.poster(e.id).then(u => { const ph = r.querySelector(".ph"); if (u && ph) ph.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
            r.querySelectorAll("[data-mv]").forEach(b => b.onclick = async () => {
              const arr = [...p.items], j = i + +b.dataset.mv, a = arr.indexOf(e._item), bIdx = arr.indexOf(items[j]._item);
              [arr[a], arr[bIdx]] = [arr[bIdx], arr[a]];
              await C.savePlaylist({ ...p, items: arr });
            });
            r.querySelector("[data-rm]")?.addEventListener("click", async () => { await C.savePlaylist({ ...p, items: p.items.filter(x => x !== e._item) }); toast("Removed"); });
            list.append(r);
          });
          box.append(list);
        }
        const acts = {
          play: () => playLocal(items, 0, { repeat: p.repeat }),
          shuffle: () => playLocal(items, 0, { repeat: p.repeat, shuffle: true }),
          repeat: async () => { const nx = { off: "all", all: "one", one: "off" }[p.repeat || "off"]; await C.savePlaylist({ ...p, repeat: nx }); toast(REPEAT[nx]); },
          fav: async () => { const on = await C.toggleFavorite({ type: "playlist", ref: p.id, title: p.name }); toast(on ? "Playlist favorited" : "Removed from Favorites"); render(); },
          add: () => addItems(p),
        };
        el.querySelectorAll("[data-a]").forEach(b => { b.onclick = acts[b.dataset.a]; });
        content.replaceChildren(el);
        moreBtn.onclick = () => sheet({ title: p.name, groups: [
          [{ icon: "plus", label: "Add Items", run: () => addItems(p) }, { icon: "pencil", label: "Rename Playlist", run: async () => { const n = await ask({ title: "Rename Playlist", value: p.name }); if (n) await C.savePlaylist({ ...p, name: n }); } }],
          [{ icon: "trash", label: "Delete Playlist", danger: true, run: async () => { if (await confirmBox({ title: `Delete “${p.name}”?`, message: "The videos themselves stay in LunaTV.", ok: "Delete", danger: true })) { await C.deletePlaylist(p.id); back(); } } }],
        ] });
      };
      editBtn.onclick = () => { editing = !editing; render(); };
      render();
      const offs = [on("library-changed", render), on("favorites-changed", render)];
      return { refresh: render, destroy: () => offs.forEach(f => f()) };
    },
  });
}

function addItems(p) {
  sheet({ title: `Add to ${p.name}`, groups: [[
    { icon: "film", label: "Videos from Library", run: () => pickInto(p) },
    { icon: "youtube", label: "YouTube Link", run: async () => {
      const u = await ask({ title: "YouTube link", placeholder: "https://youtu.be/…", type: "url", ok: "Add" });
      if (!u) return;
      const y = parseYouTube(u);
      if (!y?.video) { toast("That isn’t a YouTube video link LunaTV can read.", { err: true }); return; }
      await C.addManyToPlaylist(p.id, [{ type: "youtube", ref: y.video, title: "YouTube video", snapshot: { id: y.video, thumb: `https://i.ytimg.com/vi/${y.video}/mqdefault.jpg` } }]);
      toast("Added");
    } },
  ]] });
}
function pickInto(p) {
  const chosen = new Set();
  const addBtn = h(`<button class="icon-btn text-btn" disabled>Add</button>`);
  push({
    title: "Add Videos", actions: addBtn, async build(content) {
      const have = new Set(p.items.filter(i => i.type === "media").map(i => i.ref));
      const all = (await media.allMedia()).filter(m => !have.has(m.id));
      if (!all.length) { content.append(h(`<div class="empty">Everything in your library is already in this playlist.</div>`)); return; }
      const list = h(`<div class="list glass"></div>`);
      for (const m of all) {
        const r = h(`<button class="row tall" role="checkbox" aria-checked="false"><span class="thumb-sm"><span class="ph">${icon("film")}</span></span><span class="label">${esc(m.title)}<span class="sub">${esc(media.categoryName(m.category))}${m.duration ? " · " + fmtDur(m.duration) : ""}</span></span><span class="ic" style="opacity:0">${icon("check")}</span></button>`);
        media.poster(m.id).then(u => { const t = r.querySelector(".ph"); if (u && t) t.replaceWith(Object.assign(new Image(), { src: u, alt: "" })); });
        r.onclick = () => {
          const on2 = !chosen.has(m.id); on2 ? chosen.add(m.id) : chosen.delete(m.id);
          r.setAttribute("aria-checked", on2); r.querySelector(".ic").style.opacity = on2 ? 1 : 0;
          addBtn.disabled = !chosen.size; addBtn.textContent = chosen.size ? `Add (${chosen.size})` : "Add";
        };
        list.append(r);
      }
      content.append(h(`<p class="note">Choose videos to add to “${esc(p.name)}”.</p>`), list);
    },
  });
  addBtn.onclick = async () => {
    const all = new Map((await media.allMedia()).map(m => [m.id, m]));
    await C.addManyToPlaylist(p.id, [...chosen].map(id => ({ type: "media", ref: id, title: all.get(id)?.title })));
    toast(`Added ${chosen.size}`); back();
  };
}
