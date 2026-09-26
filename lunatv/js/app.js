// LunaTV entry: storage + VIDeX migration, then each area mounts in
// isolation so one failure never takes the rest of the app down.
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
  ["library", () => import("./library.js").then(m => m.initLibrary())],
  ["discover", () => import("./discover.js").then(m => m.initDiscover())],
  ["playlists", () => import("./playlists.js").then(m => m.initPlaylists())],
  ["search", () => import("./search.js").then(m => m.initSearch())],
  ["settings", () => import("./settings.js").then(m => m.initSettings())],
];

function areaFailed(tab, err) {
  console.error(tab, err);
  $(`#tab-${tab}`).replaceChildren(h(`<section class="view root"><div class="inner"><h1 class="page-title" style="margin-top:calc(var(--safe-t) + 24px)">Unavailable</h1><div class="empty">This part of LunaTV couldn’t start: ${esc(err?.message || err)}<br><button class="btn blue sm" onclick="location.reload()">Reload</button></div></div></section>`));
}
const splash = t => { const s = $(".boot small"); if (s) s.textContent = t; };

async function boot() {
  const ok = await db.open();
  await db.loadSettings();
  applyAppearance();
  try {
    const rep = await db.migrateFromVidex(p => splash(`Moving your library to LunaTV… ${Math.round(p * 100)}%`));
    if (rep) setTimeout(() => toast(`Welcome to LunaTV. Your ${rep.media} video${rep.media === 1 ? "" : "s"}, ${rep.playlists} playlist${rep.playlists === 1 ? "" : "s"} and history came with you.`, { ms: 6000 }), 800);
  } catch (e) { console.error("migration", e); }
  await C.loadFavorites().catch(() => {});
  L.loadAll().catch(e => console.error("live", e));

  // global header buttons on every area's root
  addHeaderButton(area => { const b = h(`<button class="hbtn" aria-label="Open media">${icon("plus")}</button>`); b.onclick = () => emit("open-media"); return b; });
  addHeaderButton(area => { if (area === "settings") return null; const b = h(`<button class="hbtn only-mobile" aria-label="Settings">${icon("gear")}</button>`); b.onclick = () => switchTab("settings"); return b; });

  for (const [tab, init] of areas) { try { await init(); } catch (e) { areaFailed(tab, e); } }
  await import("./youtube.js").catch(e => console.error("youtube", e));   // registers link handling
  const { openMediaSheet } = await import("./library.js");
  on("open-media", openMediaSheet);

  $$("[data-tab]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); switchTab(b.dataset.tab); }));
  switchTab(routeFromHash() || "home");

  db.onSetting((k, v) => { emit("settings-changed", k); if (k.startsWith("appearance.")) applyAppearance(); });
  on("error", ({ label, error }) => toast(error?.message || `Something went wrong (${label})`, { err: true, ms: 3500 }));
  addEventListener("error", e => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) { console.error(e.error || e.message); toast("Something went wrong. LunaTV kept running.", { err: true }); } });
  addEventListener("unhandledrejection", e => { if (e.reason?.name === "AbortError") return; console.error(e.reason); toast(e.reason?.message || "Something went wrong. LunaTV kept running.", { err: true }); });

  const { startReminderLoop } = L;
  startReminderLoop(r => toast(`Starting now: ${r.title} on ${r.channel}`, { ms: 8000 }));

  document.body.classList.toggle("private", db.session.private);
  document.body.classList.add("ready");
  $(".boot")?.classList.add("gone");
  setTimeout(() => $(".boot")?.remove(), 600);
  if (!ok) toast("Browser storage is unavailable (private browsing?). Everything lasts only for this session.", { err: true, ms: 6000 });

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
