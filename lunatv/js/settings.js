// Settings, backup/restore and About.
import { tr, trn, locale, lang, setLang, LANGUAGES } from "./i18n.js";
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
  ["playback", tr("Playback"), "play"], ["subtitles", tr("Subtitles"), "cc"], ["live", tr("Live TV"), "live"], ["discover", tr("Discover"), "compass"],
  ["content", tr("Content"), "lock"], ["library", tr("Library"), "film"], ["appearance", tr("Appearance"), "sparkle"], ["storage", tr("Storage & Backup"), "storage"], ["about", tr("About LunaTV"), "info"],
];

// ---- small builders
const toggle = (label, key, sub = "", after) => {
  const r = h(`<div class="row static"><span class="label">${esc(tr(label))}${sub ? `<span class="sub">${esc(tr(sub))}</span>` : ""}</span></div>`);
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
const note = t => h(`<p class="note">${esc(tr(t))}</p>`);

export function initSettings() {
  setRoot("settings", {
    build(content) {
      const l = h(`<nav class="list glass" aria-label="${tr("Settings sections")}"></nav>`);
      for (const [id, label, ic] of SECTIONS) l.append(action(label, "", () => openSection(id), { ic }));
      const priv = h(`<div class="list glass" style="margin-top:14px"><div class="row static"><span class="ic">${icon("eyeOff")}</span><span class="label">${tr("Private Session")}<span class="sub">${tr("No new history, search or Discover history until you close this tab.")}</span></span></div></div>`);
      priv.firstElementChild.append(switchEl(db.session.private, v => { db.session.private = v; document.body.classList.toggle("private", v); toast(v ? tr("Private Session on") : tr("Private Session off")); }));
      // Language: English / Español / Português. Names are shown in their own language so anyone can find theirs.
      const langName = LANGUAGES.find(([c]) => c === lang())?.[1] || "English";
      const langRow = h(`<button class="row" data-setting="language"><span class="ic">${icon("globe")}</span><span class="label">${tr("Language")}<span class="sub">${tr("Interface language")}</span></span><span class="count">${esc(langName)}</span><span class="chev">${icon("chevR")}</span></button>`);
      langRow.onclick = () => sheet({ title: tr("Language"), subtitle: tr("Changes the language of menus and messages. Your videos, channel names and programme titles stay as they are."),
        groups: [LANGUAGES.map(([code, name]) => ({ label: name, check: code === lang(), run: () => { if (code !== lang()) setLang(code); } }))] });
      const langList = h(`<div class="list glass" style="margin-top:14px"></div>`); langList.append(langRow);
      content.append(h(`<h1 class="page-title">${tr("Settings")}</h1>`), langList, priv, h(`<div style="height:14px"></div>`), l);
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
    group(tr("Playback"),
      choice(tr("Default speed"), "playback.speed", [0.5, 0.75, 1, 1.25, 1.5, 2].map(v => [v, `${v}×`]), v => `${v}×`),
      toggle("Remember speed", "playback.rememberSpeed", "Use the last speed you picked for the next video"),
      choice(tr("Skip interval"), "playback.skip", [5, 10, 15, 30].map(v => [v, tr("{v} seconds", { v })]), v => `${v} s`),
      toggle("Autoplay next", "playback.autoplay", "Play the next item in a playlist or series"),
      toggle("Resume where you left off", "playback.resume"),
      choice(tr("Count as watched at"), "playback.watched", [0.8, 0.85, 0.9, 0.92, 0.95, 0.98].map(v => [v, `${Math.round(v * 100)}%`]), v => `${Math.round(v * 100)}%`)),
    group(tr("Gestures"),
      toggle("Player gestures", "playback.gestures", "Double-tap to skip, swipe for brightness and volume"),
      toggle("Swipe sideways to seek", "playback.seekSwipe")),
  ],
  subtitles: () => {
    const set = k => x => db.setSetting(`subs.${k}`, x);
    const wrap = h(`<div class="list glass sliders"></div>`);
    wrap.append(
      slider({ label: tr("Size"), min: 60, max: 200, step: 5, value: db.setting("subs.size"), fmt: x => `${x}%`, oninput: set("size") }),
      slider({ label: tr("Weight"), min: 300, max: 900, step: 100, value: db.setting("subs.weight"), oninput: set("weight") }),
      slider({ label: tr("Background opacity"), min: 0, max: 1, step: 0.05, value: db.setting("subs.bgOpacity"), fmt: x => `${Math.round(x * 100)}%`, oninput: set("bgOpacity") }),
      slider({ label: tr("Position"), min: 2, max: 40, step: 1, value: db.setting("subs.position"), fmt: x => tr("{v}% from bottom", { v: x }), oninput: set("position") }),
      slider({ label: tr("Line height"), min: 1, max: 2, step: 0.05, value: db.setting("subs.lineHeight"), fmt: x => x.toFixed(2), oninput: set("lineHeight") }),
    );
    const colors = (label, key, opts) => {
      const r = h(`<div class="slider-row"><span class="sl-label">${label}</span><div class="swatches">${opts.map(c => `<button class="sw${db.setting(key) === c ? " on" : ""}" style="background:${c}" data-c="${c}" aria-label="${label} ${c}"></button>`).join("")}</div></div>`);
      r.onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; r.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x === b)); db.setSetting(key, b.dataset.c); };
      return r;
    };
    wrap.append(colors(tr("Text colour"), "subs.color", ["#ffffff", "#f5e663", "#9fe0ff", "#c8ffb0"]), colors(tr("Background"), "subs.bg", ["#000000", "#1b2433", "#ffffff"]));
    return [h(`<div class="section-label">${tr("Style")}</div>`), wrap, note("Sync (±10 s in 0.1 s steps) is set per video from the player’s Subtitles menu, because every file drifts differently. LunaTV draws subtitles itself; in iPhone’s own full-screen video mode they aren’t shown.")];
  },
  live: () => [
    group(tr("Sources"), action(tr("Sources & Guides"), tr("{n} added", { n: L.live.sources.filter(s => !s.adult).length }), () => openSources(), { ic: "live" })),
    group(tr("Channels"), toggle("Channel surfing: favorites only", "live.surfFavorites", "Next/previous channel skips non-favorites")),
    note(tr("Reminders currently fire while LunaTV is open. LunaTV is built for Web Push, so once a push server is connected, reminders also arrive when the app is closed — including the iPhone Home Screen app (iOS 16.4 and later).")),
  ],
  discover: () => {
    const list = h(`<div class="list glass"></div>`);
    const fileIn = h(`<input type="file" accept="application/json,.json" hidden>`);
    const renderFeeds = async () => {
      const fs = (await feeds()).filter(f => !f.adult || db.setting("content.adult"));
      list.replaceChildren(...fs.map(f => { const r = h(`<div class="row"><span class="label">${esc(f.name)}<span class="sub">${esc(f.url || trn("{n} item from a file", "{n} items from a file", f.items?.length || 0))}${f.adult ? " · " + tr("adult") : ""}</span></span><button class="icon-btn plain" aria-label="${tr("Remove feed")}">${icon("trash")}</button></div>`); r.querySelector("button").onclick = async () => { await saveFeeds((await feeds()).filter(x => x.id !== f.id)); renderFeeds(); }; return r; }),
        action(tr("Add JSON Feed URL"), tr("Must allow browsers to read it (CORS)"), async () => {
          const u = await ask({ title: tr("Feed URL"), placeholder: "https://…/feed.json", type: "url", ok: tr("Add") });
          if (!u) return; if (!safeURL(u)) { toast(tr("Enter a full https:// address."), { err: true }); return; }
          try { const items = validateFeed(await (await fetch(u)).json()); const adult = db.setting("content.adult") && await confirmBox({ title: tr("Is this an adult feed?"), message: tr("Adult feeds only appear in Discover › Adult."), ok: tr("Yes, adult") }); await saveFeeds([...await feeds(), { id: Date.now().toString(36), name: new URL(u).hostname, url: u, adult }]); toast(tr("Feed added · {p0} items", { p0: items.length })); renderFeeds(); }
          catch (e) { toast(e instanceof TypeError ? tr("LunaTV couldn’t download that feed (CORS or offline).") : e.message, { err: true, ms: 4500 }); }
        }, { ic: "link" }),
        action(tr("Import JSON Feed File"), "", () => fileIn.click(), { ic: "file" }));
    };
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; fileIn.value = ""; if (!f) return;
      try { const items = validateFeed(JSON.parse(await f.text())); await saveFeeds([...await feeds(), { id: Date.now().toString(36), name: f.name.replace(/\.json$/i, ""), items, adult: false }]); toast(tr("Feed added · {p0} items", { p0: items.length })); renderFeeds(); }
      catch (e) { toast(e.message || tr("That isn’t valid JSON."), { err: true, ms: 4500 }); }
    };
    renderFeeds();
    return [group(tr("Feed"), toggle("Return to where you were", "discover.resume")), h(`<div class="section-label">${tr("JSON Feeds")}</div>`), list, fileIn,
      note("Feed files are data only: LunaTV never runs code from them, and every link must be http(s). Format: { \"items\": [ { \"id\", \"title\", \"thumbnail\", \"videoUrl\" or \"embedUrl\", \"sourceUrl\", \"duration\" } ] }")];
  },
  content: () => {
    const adult = db.setting("content.adult");
    const adultToggle = h(`<div class="row static"><span class="label">${tr("Adult Content")}<span class="sub">${adult ? tr("On · stays inside Discover › Adult") : tr("Off · nothing adult is shown anywhere")}</span></span></div>`);
    adultToggle.append(switchEl(adult, async v => {
      if (v && !db.setting("content.adultConfirmed")) {
        const ok = await confirmBox({ title: tr("Adult Content"), message: tr("This section contains sexually explicit material intended only for adults."), ok: tr("I am 18+ — Enable") });
        if (!ok) { emit("settings-rerender"); return; }
        await db.setSetting("content.adultConfirmed", true);
      }
      await db.setSetting("content.adult", v);
      emit("settings-rerender");
    }));
    const out = [group(tr("Adult"), adultToggle)];
    if (adult) {
      const privA = h(`<div class="row static"><span class="label">${tr("Private Adult Session")}<span class="sub">${tr("No adult history until you close this tab")}</span></span></div>`);
      privA.append(switchEl(db.session.privateAdult, v => { db.session.privateAdult = v; }));
      out.push(group(tr("Adult Privacy"),
        toggle("Save adult history", "content.saveAdultHistory", "Off by default"),
        privA,
        toggle("Hide adult favorites from general Favorites", "content.hideAdultFavorites"),
        action(tr("Clear Adult History"), "", async () => { await C.clearHistory({ adult: true }); toast(tr("Adult history cleared")); }, { danger: true }),
        action(tr("Clear Adult Favorites"), "", async () => { if (await confirmBox({ title: tr("Clear adult favorites?"), ok: tr("Clear"), danger: true })) { await C.clearAdultFavorites(); toast(tr("Cleared")); } }, { danger: true })));
      out.push(group(tr("Eporner"), toggle("Gay only", "content.epornerGay", "Default feed filter (gay=2)"), toggle("Show low-quality results", "content.epornerLowQuality")));
    }
    const key = (label, k, sub) => action(label, db.setting(k) ? tr("Key saved on this device") : sub, async () => {
      const v = await ask({ title: label, message: tr("Stored only in this browser. Anyone using this browser can read it."), value: db.setting(k), placeholder: tr("Paste key"), ok: tr("Save") });
      if (v != null) { await db.setSetting(k, v.trim()); toast(v.trim() ? tr("Key saved") : tr("Key removed")); emit("settings-rerender"); }
    }, { ic: "lock" });
    out.push(group(tr("Providers"),
      key(tr("Movie artwork (TMDB)"), "providers.tmdbKey", tr("Optional · posters and details for Movies On Now")),
      key(tr("RapidAPI key"), "providers.rapidapiKey", tr("Optional · for future RapidAPI providers (none installed)"))),
      note("YouTube search, Shorts, liked videos and playlists use Google sign-in on the YouTube tab; pasted links never need an account. Keys stay on this device only and are never included in backups or exports."));
    return out;
  },
  library: () => [
    group(tr("Library"), choice(tr("Default view"), "library.view", [["poster", tr("Poster")], ["grid", tr("Grid")], ["list", tr("List")]], v => tr({ poster: "Poster", grid: "Grid", list: "List" }[v] || ""))),
    group(tr("History"), toggle("Save watch history", "library.history"), action(tr("View History"), "", openHistory, { ic: "history" })),
    group(tr("Metadata"), action(tr("Clear artwork & metadata cache"), "", async () => { await clearMetadataCache(); toast(tr("Cache cleared")); })),
  ],
  appearance: () => [
    group(tr("Appearance"),
      toggle("Reduce Motion", "appearance.reduceMotion", "Less animation, no hero rotation", v => document.documentElement.classList.toggle("reduce-motion", v)),
      toggle("Ambient Glow", "appearance.ambient", "A soft colour spill around the video"),
      choice(tr("Interface density"), "appearance.density", [["comfortable", tr("Comfortable")], ["compact", tr("Compact")]], v => (v === "compact" ? tr("Compact") : tr("Comfortable")))),
  ],
  storage: () => {
    const info = h(`<div class="list glass"><div class="row static"><span class="ic">${icon("storage")}</span><span class="label">${tr("Checking…")}</span></div></div>`);
    (async () => {
      const [est, persisted] = await Promise.all([db.estimate(), db.isPersisted()]);
      info.firstElementChild.querySelector(".label").innerHTML = `${est?.quota ? tr("{used} used of {total}", { used: fmtBytes(est.usage), total: fmtBytes(est.quota) }) : tr("Storage size not reported")}<span class="sub">${tr(!db.persistent ? "Storage unavailable (private browsing?): data lasts only for this session." : persisted ? "Persistent: the browser won’t clear LunaTV automatically." : "The browser may clear LunaTV data when space runs low.")}</span>`;
    })();
    return [
      h(`<div class="section-label">${tr("This Device")}</div>`), info,
      group(tr("Backup"), action(tr("Export Backup"), "lunatv-backup.json", exportBackup, { ic: "share" }), action(tr("Import Backup"), tr("Merge or replace"), importBackup, { ic: "restart" })),
      group(tr("Maintenance"),
        action(tr("Keep data stored"), tr("Ask the browser not to clear LunaTV"), async () => { const ok = await db.requestPersist(); toast(ok ? tr("Storage is now persistent") : tr("The browser declined. Installing to the Home Screen can help."), { ms: 4000 }); }),
        action(tr("Clear application cache"), tr("Re-download LunaTV’s own files"), async () => { const ks = await caches?.keys?.() || []; await Promise.all(ks.filter(k => k.startsWith("lunatv-")).map(k => caches.delete(k))); toast(tr("Cache cleared. Reload to fetch fresh files.")); }),
        action(tr("Clear History"), "", async () => { if (await confirmBox({ title: tr("Clear all history?"), ok: tr("Clear"), danger: true })) { await C.clearHistory(); toast(tr("History cleared")); } }, { danger: true })),
      note(tr("Backups contain settings and lists, not your video files. Videos stay on this device only.")),
    ];
  },
};

// ------------------------------------------------------------------ backup
const PARTS = [["settings", tr("Settings")], ["favorites", tr("Favorites")], ["playlists", tr("Playlists")], ["channelEdits", tr("Channel edits")], ["streams", tr("Stream sources")], ["history", tr("Watch history")], ["adult", tr("Adult configuration")]];
function exportBackup() {
  const pick = new Set(PARTS.filter(([k]) => k !== "adult").map(([k]) => k));
  const body = h(`<div class="list glass"></div>`);
  for (const [k, l] of PARTS) {
    const r = h(`<div class="row static"><span class="label">${l}${k === "adult" ? `<span class="sub">${tr("Off by default. Includes adult sources, favorites and playback URLs.")}</span>` : ""}</span></div>`);
    r.append(switchEl(pick.has(k), v => v ? pick.add(k) : pick.delete(k))); body.append(r);
  }
  const go = h(`<button class="btn blue" style="margin:12px 16px">${icon("share")}${tr("Export")}</button>`);
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
    toast(tr("Backup saved"));
  };
  const wrap = h(`<div></div>`); wrap.append(body, go);
  panel({ title: tr("Export Backup"), subtitle: tr("Choose what to include"), body: wrap });
}
let backupIn;
export function importBackup() {
  backupIn ||= document.body.appendChild(h(`<input type="file" accept="application/json,.json" hidden>`));
  backupIn.onchange = async () => {
    const f = backupIn.files[0]; backupIn.value = ""; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); if (data?.app !== "LunaTV" || typeof data.parts !== "object") throw 0; }
    catch { toast(tr("That isn’t a LunaTV backup file."), { err: true }); return; }
    const kinds = Object.keys(data.parts);
    sheet({ title: tr("Import Backup"), subtitle: `${new Date(data.exportedAt).toLocaleString(locale())} · ${kinds.length} parts`, groups: [[
      { icon: "plus", label: tr("Merge"), sub: tr("Add to what’s already here"), run: () => applyBackup(data, "merge") },
      { icon: "restart", label: tr("Replace"), sub: tr("Erase matching data first, then restore"), danger: true, run: async () => { if (await confirmBox({ title: tr("Replace with this backup?"), message: tr("Your current settings, favorites, playlists, sources and history in these parts will be erased first. Videos are not affected."), ok: tr("Replace"), danger: true })) applyBackup(data, "replace"); } },
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
  toast(mode === "merge" ? trn("Backup merged · {n} record", "Backup merged · {n} records", n) : trn("Backup restored · {n} record", "Backup restored · {n} records", n));
}
on("import-backup", importBackup);

// ------------------------------------------------------------------ About
function openAbout() {
  push({
    title: tr("About"), build(content) {
      const el = h(`<div class="about">
        <img class="about-logo" src="assets/branding/lunatv-logo.webp" alt="${tr("LunaTV")}" width="720" height="660">
        <p class="about-tag">${tr("Premium Personal Cinema + Live TV Player")}</p>
        <p class="about-ver">${tr("Version")} ${esc(LUNATV_VERSION)} ${tr("· Build")} ${esc(BUILD_ID)}</p>
        <div class="about-org"><span class="section-label">${tr("Product of")}</span><b>${tr("Bobby, Luna &amp; Mateo Interactive")}</b><span class="section-label">${tr("A technology division of")}</span><b class="smr">${tr("SMR ENTERTAINMENT")}</b></div>
        <p class="note center">${tr("LunaTV is a product of Bobby, Luna &amp; Mateo Interactive, the interactive technology division of SMR Entertainment.")}</p>
        <div class="list glass about-rows"></div>
        <p class="about-copy">${tr("© 2026 SMR Entertainment. All rights reserved.")}<br>${tr("LunaTV™")}</p></div>`);
      const rows = el.querySelector(".about-rows");
      const text = (title, paras) => () => panel({ title, body: h(`<div class="legal">${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>`) });
      rows.append(
        action(tr("Privacy"), "", text(tr("Privacy"), [
          tr("LunaTV has no accounts and no sign-in. It doesn’t run a server and doesn’t collect analytics."),
          tr("Videos you open stay on this device: LunaTV stores a copy in this browser’s own storage and never uploads it."),
          tr("History, favorites, playlists, stream sources, provider keys and settings are stored only in this browser. Private Session and Private Adult Session stop new history from being saved."),
          tr("When you play a stream, a YouTube video or a Discover item, your device connects directly to that service, which has its own privacy policy."),
        ])),
        action(tr("Legal"), "", text(tr("Legal"), [
          tr("LunaTV™ and associated LunaTV names, logos, visual identities, and product marks are trademarks of SMR Entertainment."),
          tr("Bobby, Luna & Mateo Interactive™ is an interactive technology division of SMR Entertainment."),
          tr("Third-party services, content, trademarks, and streaming sources remain the property of their respective owners. LunaTV is not affiliated with or endorsed by Apple, Google, YouTube, Eporner, Xfree, Netflix, Roku, Amazon, IPTV-org, TMDB or any other provider."),
          tr("Availability and playback may depend on the source, platform, region, device, browser, and applicable provider requirements."),
        ])),
        action(tr("Open-Source Licenses"), "", text(tr("Open-Source Licenses"), [
          "hls.js — Copyright (c) 2017 Dailymotion; Apache License 2.0. Bundled in vendor/hls.min.js; full text in vendor/hls.js-LICENSE.txt.",
          tr("Channel directory data (optional) — IPTV-org, public domain (Unlicense)."),
          tr("Movie artwork (optional, with your own key) — The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB."),
        ])),
        action(tr("Version Information"), "", text(tr("Version Information"), [tr("LunaTV {p0}", { p0: LUNATV_VERSION }), tr("Build {p0}", { p0: BUILD_ID }), tr("Storage: {p0}", { p0: db.persistent ? "IndexedDB" : tr("temporary (memory)") }), tr("Running from {p0}{p1}", { p0: location.origin, p1: location.pathname }), navigator.userAgent])),
      );
      content.append(el);
    },
  });
}
