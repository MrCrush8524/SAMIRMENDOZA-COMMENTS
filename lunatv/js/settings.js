// Settings, backup/restore and About.
import { h, esc, icon, on, emit, fmtBytes, safeURL } from "./util.js";
import * as db from "./database.js";
import * as C from "./collections.js";
import * as L from "./channels.js";
import { setRoot, push, back, sheet, panel, slider, toast, confirmBox, ask, switchEl, switchTab } from "./ui.js";
import { openSources } from "./live.js";
import { openHistory } from "./home.js";
import { feeds, saveFeeds, validateFeed } from "./providers/json-feed.js";
import { clearMetadataCache } from "./metadata.js";
import { LUNATV_VERSION, BUILD_ID } from "./version.js";

const SECTIONS = [
  ["playback", "Playback", "play"], ["subtitles", "Subtitles", "cc"], ["live", "Live TV", "live"], ["discover", "Discover", "compass"],
  ["content", "Content", "lock"], ["library", "Library", "film"], ["appearance", "Appearance", "sparkle"], ["storage", "Storage & Backup", "storage"], ["about", "About LunaTV", "info"],
];

// ---- small builders
const toggle = (label, key, sub = "", after) => {
  const r = h(`<div class="row static"><span class="label">${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span></div>`);
  r.append(switchEl(db.setting(key), v => { db.setSetting(key, v); after?.(v); }));
  return r;
};
const action = (label, sub, run, { danger = false, ic = "" } = {}) => {
  const r = h(`<button class="row${danger ? " danger" : ""}">${ic ? `<span class="ic">${icon(ic)}</span>` : ""}<span class="label">${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span><span class="chev">${icon("chevR")}</span></button>`);
  r.onclick = run; return r;
};
const choice = (label, key, opts, fmt = v => v) => {
  const r = h(`<button class="row"><span class="label">${esc(label)}</span><span class="count">${esc(String(fmt(db.setting(key))))}</span><span class="chev">${icon("chevR")}</span></button>`);
  r.onclick = () => sheet({ title: label, groups: [opts.map(([v, l]) => ({ label: l, check: db.setting(key) === v, run: () => { db.setSetting(key, v); r.querySelector(".count").textContent = String(fmt(v)); } }))] });
  return r;
};
const group = (title, ...rows) => { const g = h(`<div><div class="section-label">${esc(title)}</div><div class="list glass"></div></div>`); g.lastElementChild.append(...rows.filter(Boolean)); return g; };
const note = t => h(`<p class="note">${esc(t)}</p>`);

export function initSettings() {
  setRoot("settings", {
    build(content) {
      const l = h(`<nav class="list glass" aria-label="Settings sections"></nav>`);
      for (const [id, label, ic] of SECTIONS) l.append(action(label, "", () => openSection(id), { ic }));
      const priv = h(`<div class="list glass" style="margin-top:14px"><div class="row static"><span class="ic">${icon("eyeOff")}</span><span class="label">Private Session<span class="sub">No new history, search or Discover history until you close this tab.</span></span></div></div>`);
      priv.firstElementChild.append(switchEl(db.session.private, v => { db.session.private = v; document.body.classList.toggle("private", v); toast(v ? "Private Session on" : "Private Session off"); }));
      content.append(h(`<h1 class="page-title">Settings</h1>`), priv, h(`<div style="height:14px"></div>`), l);
    },
  });
  on("settings-section", id => openSection(id));
}

export function openSection(id) {
  const [, title] = SECTIONS.find(s => s[0] === id) || [];
  if (id === "about") return openAbout();
  push({ title, build(content) { const r = () => content.replaceChildren(...BUILD[id]()); r(); const off = on("settings-rerender", r); return { refresh: r, destroy: off }; } });
}

const BUILD = {
  playback: () => [
    group("Playback",
      choice("Default speed", "playback.speed", [0.5, 0.75, 1, 1.25, 1.5, 2].map(v => [v, `${v}×`]), v => `${v}×`),
      toggle("Remember speed", "playback.rememberSpeed", "Use the last speed you picked for the next video"),
      choice("Skip interval", "playback.skip", [5, 10, 15, 30].map(v => [v, `${v} seconds`]), v => `${v} s`),
      toggle("Autoplay next", "playback.autoplay", "Play the next item in a playlist or series"),
      toggle("Resume where you left off", "playback.resume"),
      choice("Count as watched at", "playback.watched", [0.8, 0.85, 0.9, 0.92, 0.95, 0.98].map(v => [v, `${Math.round(v * 100)}%`]), v => `${Math.round(v * 100)}%`)),
    group("Gestures",
      toggle("Player gestures", "playback.gestures", "Double-tap to skip, swipe for brightness and volume"),
      toggle("Swipe sideways to seek", "playback.seekSwipe")),
  ],
  subtitles: () => {
    const set = k => x => db.setSetting(`subs.${k}`, x);
    const wrap = h(`<div class="list glass sliders"></div>`);
    wrap.append(
      slider({ label: "Size", min: 60, max: 200, step: 5, value: db.setting("subs.size"), fmt: x => `${x}%`, oninput: set("size") }),
      slider({ label: "Weight", min: 300, max: 900, step: 100, value: db.setting("subs.weight"), oninput: set("weight") }),
      slider({ label: "Background opacity", min: 0, max: 1, step: 0.05, value: db.setting("subs.bgOpacity"), fmt: x => `${Math.round(x * 100)}%`, oninput: set("bgOpacity") }),
      slider({ label: "Position", min: 2, max: 40, step: 1, value: db.setting("subs.position"), fmt: x => `${x}% from bottom`, oninput: set("position") }),
      slider({ label: "Line height", min: 1, max: 2, step: 0.05, value: db.setting("subs.lineHeight"), fmt: x => x.toFixed(2), oninput: set("lineHeight") }),
    );
    const colors = (label, key, opts) => {
      const r = h(`<div class="slider-row"><span class="sl-label">${label}</span><div class="swatches">${opts.map(c => `<button class="sw${db.setting(key) === c ? " on" : ""}" style="background:${c}" data-c="${c}" aria-label="${label} ${c}"></button>`).join("")}</div></div>`);
      r.onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; r.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x === b)); db.setSetting(key, b.dataset.c); };
      return r;
    };
    wrap.append(colors("Text colour", "subs.color", ["#ffffff", "#f5e663", "#9fe0ff", "#c8ffb0"]), colors("Background", "subs.bg", ["#000000", "#1b2433", "#ffffff"]));
    return [h(`<div class="section-label">Style</div>`), wrap, note("Sync (±10 s in 0.1 s steps) is set per video from the player’s Subtitles menu, because every file drifts differently. LunaTV draws subtitles itself; in iPhone’s own full-screen video mode they aren’t shown.")];
  },
  live: () => [
    group("Sources", action("Sources & Guides", `${L.live.sources.filter(s => !s.adult).length} added`, () => openSources(), { ic: "live" })),
    group("Channels", toggle("Channel surfing: favorites only", "live.surfFavorites", "Next/previous channel skips non-favorites")),
    note("Reminders currently fire while LunaTV is open. LunaTV is built for Web Push, so once a push server is connected, reminders also arrive when the app is closed — including the iPhone Home Screen app (iOS 16.4 and later)."),
  ],
  discover: () => {
    const list = h(`<div class="list glass"></div>`);
    const fileIn = h(`<input type="file" accept="application/json,.json" hidden>`);
    const renderFeeds = async () => {
      const fs = (await feeds()).filter(f => !f.adult || db.setting("content.adult"));
      list.replaceChildren(...fs.map(f => { const r = h(`<div class="row"><span class="label">${esc(f.name)}<span class="sub">${esc(f.url || `${f.items?.length || 0} items from a file`)}${f.adult ? " · adult" : ""}</span></span><button class="icon-btn plain" aria-label="Remove feed">${icon("trash")}</button></div>`); r.querySelector("button").onclick = async () => { await saveFeeds((await feeds()).filter(x => x.id !== f.id)); renderFeeds(); }; return r; }),
        action("Add JSON Feed URL", "Must allow browsers to read it (CORS)", async () => {
          const u = await ask({ title: "Feed URL", placeholder: "https://…/feed.json", type: "url", ok: "Add" });
          if (!u) return; if (!safeURL(u)) { toast("Enter a full https:// address.", { err: true }); return; }
          try { const items = validateFeed(await (await fetch(u)).json()); const adult = db.setting("content.adult") && await confirmBox({ title: "Is this an adult feed?", message: "Adult feeds only appear in Discover › Adult.", ok: "Yes, adult" }); await saveFeeds([...await feeds(), { id: Date.now().toString(36), name: new URL(u).hostname, url: u, adult }]); toast(`Feed added · ${items.length} items`); renderFeeds(); }
          catch (e) { toast(e instanceof TypeError ? "LunaTV couldn’t download that feed (CORS or offline)." : e.message, { err: true, ms: 4500 }); }
        }, { ic: "link" }),
        action("Import JSON Feed File", "", () => fileIn.click(), { ic: "file" }));
    };
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; fileIn.value = ""; if (!f) return;
      try { const items = validateFeed(JSON.parse(await f.text())); await saveFeeds([...await feeds(), { id: Date.now().toString(36), name: f.name.replace(/\.json$/i, ""), items, adult: false }]); toast(`Feed added · ${items.length} items`); renderFeeds(); }
      catch (e) { toast(e.message || "That isn’t valid JSON.", { err: true, ms: 4500 }); }
    };
    renderFeeds();
    return [group("Feed", toggle("Return to where you were", "discover.resume")), h(`<div class="section-label">JSON Feeds</div>`), list, fileIn,
      note("Feed files are data only: LunaTV never runs code from them, and every link must be http(s). Format: { \"items\": [ { \"id\", \"title\", \"thumbnail\", \"videoUrl\" or \"embedUrl\", \"sourceUrl\", \"duration\" } ] }")];
  },
  content: () => {
    const adult = db.setting("content.adult");
    const adultToggle = h(`<div class="row static"><span class="label">Adult Content<span class="sub">${adult ? "On · stays inside Discover › Adult" : "Off · nothing adult is shown anywhere"}</span></span></div>`);
    adultToggle.append(switchEl(adult, async v => {
      if (v && !db.setting("content.adultConfirmed")) {
        const ok = await confirmBox({ title: "Adult Content", message: "This section contains sexually explicit material intended only for adults.", ok: "I am 18+ — Enable" });
        if (!ok) { emit("settings-rerender"); return; }
        await db.setSetting("content.adultConfirmed", true);
      }
      await db.setSetting("content.adult", v);
      emit("settings-rerender");
    }));
    const out = [group("Adult", adultToggle)];
    if (adult) {
      const privA = h(`<div class="row static"><span class="label">Private Adult Session<span class="sub">No adult history until you close this tab</span></span></div>`);
      privA.append(switchEl(db.session.privateAdult, v => { db.session.privateAdult = v; }));
      out.push(group("Adult Privacy",
        toggle("Save adult history", "content.saveAdultHistory", "Off by default"),
        privA,
        toggle("Hide adult favorites from general Favorites", "content.hideAdultFavorites"),
        action("Clear Adult History", "", async () => { await C.clearHistory({ adult: true }); toast("Adult history cleared"); }, { danger: true }),
        action("Clear Adult Favorites", "", async () => { if (await confirmBox({ title: "Clear adult favorites?", ok: "Clear", danger: true })) { await C.clearAdultFavorites(); toast("Cleared"); } }, { danger: true })));
      out.push(group("Eporner", toggle("Gay only", "content.epornerGay", "Default feed filter (gay=2)"), toggle("Show low-quality results", "content.epornerLowQuality")));
    }
    const key = (label, k, sub) => action(label, db.setting(k) ? "Key saved on this device" : sub, async () => {
      const v = await ask({ title: label, message: "Stored only in this browser. Anyone using this browser can read it.", value: db.setting(k), placeholder: "Paste key", ok: "Save" });
      if (v != null) { await db.setSetting(k, v.trim()); toast(v.trim() ? "Key saved" : "Key removed"); emit("settings-rerender"); }
    }, { ic: "lock" });
    out.push(group("Providers",
      key("Movie artwork (TMDB)", "providers.tmdbKey", "Optional · posters and details for Movies On Now"),
      key("RapidAPI key", "providers.rapidapiKey", "Optional · for future RapidAPI providers (none installed)")),
      note("YouTube search, Shorts, liked videos and playlists use Google sign-in on the YouTube tab; pasted links never need an account. Keys stay on this device only and are never included in backups or exports."));
    return out;
  },
  library: () => [
    group("Library", choice("Default view", "library.view", [["poster", "Poster"], ["grid", "Grid"], ["list", "List"]], v => ({ poster: "Poster", grid: "Grid", list: "List" }[v]))),
    group("History", toggle("Save watch history", "library.history"), action("View History", "", openHistory, { ic: "history" })),
    group("Metadata", action("Clear artwork & metadata cache", "", async () => { await clearMetadataCache(); toast("Cache cleared"); })),
  ],
  appearance: () => [
    group("Appearance",
      toggle("Reduce Motion", "appearance.reduceMotion", "Less animation, no hero rotation", v => document.documentElement.classList.toggle("reduce-motion", v)),
      toggle("Ambient Glow", "appearance.ambient", "A soft colour spill around the video"),
      choice("Interface density", "appearance.density", [["comfortable", "Comfortable"], ["compact", "Compact"]], v => (v === "compact" ? "Compact" : "Comfortable"))),
  ],
  storage: () => {
    const info = h(`<div class="list glass"><div class="row static"><span class="ic">${icon("storage")}</span><span class="label">Checking…</span></div></div>`);
    (async () => {
      const [est, persisted] = await Promise.all([db.estimate(), db.isPersisted()]);
      info.firstElementChild.querySelector(".label").innerHTML = `${est?.quota ? `${fmtBytes(est.usage)} used of ${fmtBytes(est.quota)}` : "Storage size not reported"}<span class="sub">${!db.persistent ? "Storage unavailable (private browsing?): data lasts only for this session." : persisted ? "Persistent: the browser won’t clear LunaTV automatically." : "The browser may clear LunaTV data when space runs low."}</span>`;
    })();
    return [
      h(`<div class="section-label">This Device</div>`), info,
      group("Backup", action("Export Backup", "lunatv-backup.json", exportBackup, { ic: "share" }), action("Import Backup", "Merge or replace", importBackup, { ic: "restart" })),
      group("Maintenance",
        action("Keep data stored", "Ask the browser not to clear LunaTV", async () => { const ok = await db.requestPersist(); toast(ok ? "Storage is now persistent" : "The browser declined. Installing to the Home Screen can help.", { ms: 4000 }); }),
        action("Clear application cache", "Re-download LunaTV’s own files", async () => { const ks = await caches?.keys?.() || []; await Promise.all(ks.filter(k => k.startsWith("lunatv-")).map(k => caches.delete(k))); toast("Cache cleared. Reload to fetch fresh files."); }),
        action("Clear History", "", async () => { if (await confirmBox({ title: "Clear all history?", ok: "Clear", danger: true })) { await C.clearHistory(); toast("History cleared"); } }, { danger: true })),
      note("Backups contain settings and lists, not your video files. Videos stay on this device only."),
    ];
  },
};

// ------------------------------------------------------------------ backup
const PARTS = [["settings", "Settings"], ["favorites", "Favorites"], ["playlists", "Playlists"], ["channelEdits", "Channel edits"], ["streams", "Stream sources"], ["history", "Watch history"], ["adult", "Adult configuration"]];
function exportBackup() {
  const pick = new Set(PARTS.filter(([k]) => k !== "adult").map(([k]) => k));
  const body = h(`<div class="list glass"></div>`);
  for (const [k, l] of PARTS) {
    const r = h(`<div class="row static"><span class="label">${l}${k === "adult" ? `<span class="sub">Off by default. Includes adult sources, favorites and playback URLs.</span>` : ""}</span></div>`);
    r.append(switchEl(pick.has(k), v => v ? pick.add(k) : pick.delete(k))); body.append(r);
  }
  const go = h(`<button class="btn blue" style="margin:12px 16px">${icon("share")}Export</button>`);
  go.onclick = async () => {
    const data = { app: "LunaTV", format: 1, version: LUNATV_VERSION, exportedAt: new Date().toISOString(), parts: {} };
    const adult = pick.has("adult");
    if (pick.has("settings")) data.parts.settings = (await db.all("settings")).filter(s => !s.id.startsWith("providers.") && (adult || !s.id.startsWith("content.")));
    if (pick.has("favorites")) { data.parts.favorites = await db.all("favorites"); if (adult) data.parts.adultFavorites = await db.all("adultFavorites"); }
    if (pick.has("playlists")) data.parts.playlists = await db.all("playlists");
    if (pick.has("channelEdits")) data.parts.channelEdits = await db.all("channelEdits");
    if (pick.has("streams")) {
      const srcs = (await db.all("sources")).filter(s => adult || !s.adult), ids = new Set(srcs.map(s => s.id));
      data.parts.sources = srcs; data.parts.channels = (await db.all("channels")).filter(c => ids.has(c.sourceId) && (adult || !c.adult));
      data.parts.feeds = (await feeds()).filter(f => adult || !f.adult);
    }
    if (pick.has("history")) { data.parts.history = await db.all("history"); data.parts.progress = await db.all("progress"); if (adult) data.parts.adultHistory = await db.all("adultHistory"); }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" }), u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = "lunatv-backup.json"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    toast("Backup saved");
  };
  const wrap = h(`<div></div>`); wrap.append(body, go);
  panel({ title: "Export Backup", subtitle: "Choose what to include", body: wrap });
}
let backupIn;
export function importBackup() {
  backupIn ||= document.body.appendChild(h(`<input type="file" accept="application/json,.json" hidden>`));
  backupIn.onchange = async () => {
    const f = backupIn.files[0]; backupIn.value = ""; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); if (data?.app !== "LunaTV" || typeof data.parts !== "object") throw 0; }
    catch { toast("That isn’t a LunaTV backup file.", { err: true }); return; }
    const kinds = Object.keys(data.parts);
    sheet({ title: "Import Backup", subtitle: `${new Date(data.exportedAt).toLocaleString()} · ${kinds.length} parts`, groups: [[
      { icon: "plus", label: "Merge", sub: "Add to what’s already here", run: () => applyBackup(data, "merge") },
      { icon: "restart", label: "Replace", sub: "Erase matching data first, then restore", danger: true, run: async () => { if (await confirmBox({ title: "Replace with this backup?", message: "Your current settings, favorites, playlists, sources and history in these parts will be erased first. Videos are not affected.", ok: "Replace", danger: true })) applyBackup(data, "replace"); } },
    ]] });
  };
  backupIn.click();
}
async function applyBackup(data, mode) {
  const map = { settings: "settings", favorites: "favorites", adultFavorites: "adultFavorites", playlists: "playlists", channelEdits: "channelEdits", sources: "sources", channels: "channels", history: "history", adultHistory: "adultHistory", progress: "progress" };
  let n = 0;
  for (const [k, store] of Object.entries(map)) {
    const rows = data.parts[k]; if (!Array.isArray(rows)) continue;
    if (mode === "replace") await db.clear(store);
    await db.putMany(store, rows.filter(r => r && typeof r.id === "string" && !(store === "settings" && r.id.startsWith("providers."))));
    n += rows.length;
  }
  if (Array.isArray(data.parts.feeds)) await saveFeeds(mode === "replace" ? data.parts.feeds : [...await feeds(), ...data.parts.feeds]);
  await db.loadSettings(); await C.loadFavorites(); await L.loadAll();
  emit("library-changed"); emit("favorites-changed"); emit("history-changed");
  toast(`Backup ${mode === "merge" ? "merged" : "restored"} · ${n} records`);
}
on("import-backup", importBackup);

// ------------------------------------------------------------------ About
function openAbout() {
  push({
    title: "About", build(content) {
      const el = h(`<div class="about">
        <img class="about-logo" src="assets/branding/lunatv-logo.webp" alt="LunaTV" width="720" height="660">
        <p class="about-tag">Premium Personal Cinema + Live TV Player</p>
        <p class="about-ver">Version ${esc(LUNATV_VERSION)} · Build ${esc(BUILD_ID)}</p>
        <div class="about-org"><span class="section-label">Product of</span><b>Bobby, Luna &amp; Mateo Interactive</b><span class="section-label">A technology division of</span><b class="smr">SMR ENTERTAINMENT</b></div>
        <p class="note center">LunaTV is a product of Bobby, Luna &amp; Mateo Interactive, the interactive technology division of SMR Entertainment.</p>
        <div class="list glass about-rows"></div>
        <p class="about-copy">© 2026 SMR Entertainment. All rights reserved.<br>LunaTV™</p></div>`);
      const rows = el.querySelector(".about-rows");
      const text = (title, paras) => () => panel({ title, body: h(`<div class="legal">${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>`) });
      rows.append(
        action("Privacy", "", text("Privacy", [
          "LunaTV has no accounts and no sign-in. It doesn’t run a server and doesn’t collect analytics.",
          "Videos you open stay on this device: LunaTV stores a copy in this browser’s own storage and never uploads it.",
          "History, favorites, playlists, stream sources, provider keys and settings are stored only in this browser. Private Session and Private Adult Session stop new history from being saved.",
          "When you play a stream, a YouTube video or a Discover item, your device connects directly to that service, which has its own privacy policy.",
        ])),
        action("Legal", "", text("Legal", [
          "LunaTV™ and associated LunaTV names, logos, visual identities, and product marks are trademarks of SMR Entertainment.",
          "Bobby, Luna & Mateo Interactive™ is an interactive technology division of SMR Entertainment.",
          "Third-party services, content, trademarks, and streaming sources remain the property of their respective owners. LunaTV is not affiliated with or endorsed by Apple, Google, YouTube, Eporner, Xfree, Netflix, Roku, Amazon, IPTV-org, TMDB or any other provider.",
          "Availability and playback may depend on the source, platform, region, device, browser, and applicable provider requirements.",
        ])),
        action("Open-Source Licenses", "", text("Open-Source Licenses", [
          "hls.js — Copyright (c) 2017 Dailymotion; Apache License 2.0. Bundled in vendor/hls.min.js; full text in vendor/hls.js-LICENSE.txt.",
          "Channel directory data (optional) — IPTV-org, public domain (Unlicense).",
          "Movie artwork (optional, with your own key) — The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.",
        ])),
        action("Version Information", "", text("Version Information", [`LunaTV ${LUNATV_VERSION}`, `Build ${BUILD_ID}`, `Storage: ${db.persistent ? "IndexedDB" : "temporary (memory)"}`, `Running from ${location.origin}${location.pathname}`, navigator.userAgent])),
      );
      content.append(el);
    },
  });
}
