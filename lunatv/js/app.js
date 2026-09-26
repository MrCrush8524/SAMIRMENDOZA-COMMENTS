// LunaTV entry: storage + legacy-data migration, then each area mounts in
// isolation so one failure never takes the rest of the app down.
import { tr, trn, translateStatic } from "./i18n.js";
import { $, $$, on, emit, h, esc, icon } from "./util.js";
import * as db from "./database.js";
import * as C from "./collections.js";
import * as L from "./channels.js";
import { switchTab, routeFromHash, addHeaderButton, toast, AREAS } from "./ui.js";
import { LUNATV_VERSION, BUILD_ID } from "./version.js";

window.LUNATV_VERSION = LUNATV_VERSION; window.LUNATV_BUILD = BUILD_ID;

const areas = [
  ["home", () => import("./home.js").then(m => m.initHome())],
  ["live", () => import("./live.js").then(m => m.initLive())],
  ["youtube", () => import("./youtube.js").then(m => m.initYouTubeArea())],
  ["library", () => import("./library.js").then(m => m.initLibrary())],
  ["discover", () => import("./discover.js").then(m => m.initDiscover())],
  ["playlists", () => import("./playlists.js").then(m => m.initPlaylists())],
  ["search", () => import("./search.js").then(m => m.initSearch())],
  ["settings", () => import("./settings.js").then(m => m.initSettings())],
];

function areaFailed(tab, err) {
  console.error(tab, err);
  $(`#tab-${tab}`).replaceChildren(h(`<section class="view root"><div class="inner"><h1 class="page-title" style="margin-top:calc(var(--safe-t) + 24px)">${tr("Unavailable")}</h1><div class="empty">${tr("This part of LunaTV couldn’t start:")} ${esc(err?.message || err)}<br><button class="btn blue sm" onclick="location.reload()">${tr("Reload")}</button></div></div></section>`));
}
const splash = t => { const s = $(".boot small"); if (s) s.textContent = t; };

async function boot() {
  translateStatic();
  const ok = await db.open();
  await db.loadSettings();
  applyAppearance();
  try {
    const rep = await db.migrateLegacy(p => splash(tr("Moving your library to LunaTV… {p0}%", { p0: Math.round(p * 100) })));
    if (rep) setTimeout(() => toast(tr("Welcome to LunaTV. Your {p0}, {p1} and history came with you.", { p0: trn("{n} video", "{n} videos", rep.media), p1: trn("{n} playlist", "{n} playlists", rep.playlists) }), { ms: 6000 }), 800);
  } catch (e) { console.error("migration", e); }
  await C.loadFavorites().catch(() => {});
  L.loadAll().catch(e => console.error("live", e));

  // global header buttons on every area's root
  // Phone header: Discover and Settings live here (the dock holds Home / Live TV / YouTube / Library / Search)
  addHeaderButton(area => { if (area === "discover") return null; const b = h(`<button class="hbtn only-mobile" aria-label="${tr("Discover")}">${icon("compass")}</button>`); b.onclick = () => switchTab("discover"); return b; });
  addHeaderButton(area => { const b = h(`<button class="hbtn" aria-label="${tr("Open media")}">${icon("plus")}</button>`); b.onclick = () => emit("open-media"); return b; });
  addHeaderButton(area => { if (area === "settings") return null; const b = h(`<button class="hbtn only-mobile" aria-label="${tr("Settings")}">${icon("gear")}</button>`); b.onclick = () => switchTab("settings"); return b; });

  for (const [tab, init] of areas) { try { await init(); } catch (e) { areaFailed(tab, e); } }
  const { openMediaSheet } = await import("./library.js");
  on("open-media", openMediaSheet);

  $$("[data-tab]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); switchTab(b.dataset.tab); }));
  switchTab(routeFromHash() || "home");

  db.onSetting((k, v) => { emit("settings-changed", k); if (k.startsWith("appearance.")) applyAppearance(); });
  on("error", ({ label, error }) => toast(error?.message || tr("Something went wrong ({p0})", { p0: label }), { err: true, ms: 3500 }));
  addEventListener("error", e => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) { console.error(e.error || e.message); toast(tr("Something went wrong. LunaTV kept running."), { err: true }); } });
  addEventListener("unhandledrejection", e => { if (e.reason?.name === "AbortError") return; console.error(e.reason); toast(e.reason?.message || tr("Something went wrong. LunaTV kept running."), { err: true }); });

  const { startReminderLoop } = L;
  startReminderLoop(r => toast(tr("Starting now: {p0} on {p1}", { p0: r.title, p1: r.channel }), { ms: 8000 }));

  document.body.classList.toggle("private", db.session.private);
  document.body.classList.add("ready");
  $(".boot")?.classList.add("gone");
  setTimeout(() => $(".boot")?.remove(), 600);
  if (!ok) toast(tr("Browser storage is unavailable (private browsing?). Everything lasts only for this session."), { err: true, ms: 6000 });

  // App-shell cache only; LunaTV works the same if this fails.
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register(`service-worker.js?v=${encodeURIComponent(LUNATV_VERSION + "-" + BUILD_ID)}`).catch(() => {});
  }
}
function applyAppearance() {
  const rm = db.setting("appearance.reduceMotion");
  document.documentElement.classList.toggle("reduce-motion", !!rm);
  document.documentElement.classList.toggle("compact", db.setting("appearance.density") === "compact");
}
void AREAS;
boot().catch(e => window.__lunaFatal?.(e));
