// VIDeX entry: boot storage, mount each area in isolation, wire the dock.
import { $, $$, on, h, esc } from "./util.js";
import * as db from "./db.js";
import { switchTab, toast } from "./ui.js";

const areas = [
  ["library", () => import("./library.js").then(m => m.initLibrary())],
  ["home", () => import("./home.js").then(m => m.initHome())],
  ["live", () => import("./tv.js").then(async m => { await m.initTV(); m.initLive(); })],
  ["youtube", () => import("./youtube.js").then(m => m.initYouTube())],
  ["search", () => import("./search.js").then(m => m.initSearch())],
];

// One failing area must not take the rest of VIDeX down: show a local notice instead.
function areaFailed(tab, err) {
  console.error(tab, err);
  const host = $(`#tab-${tab}`);
  host.replaceChildren(h(`<section class="view"><div class="inner"><h1 class="page-title" style="margin-top:calc(var(--safe-t) + 24px)">Unavailable</h1><div class="empty">This part of VIDeX couldn’t start: ${esc(err?.message || err)}<br><button class="btn blue sm" onclick="location.reload()">Reload</button></div></div></section>`));
}

async function boot() {
  const ok = await db.open();
  for (const [tab, init] of areas) { try { await init(); } catch (e) { areaFailed(tab, e); } }

  $$(".dock button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  switchTab("library");

  on("error", ({ label, error }) => toast(error?.message || `Something went wrong (${label})`, { err: true, ms: 3500 }));
  addEventListener("error", e => { if (e.message && !/ResizeObserver/.test(e.message)) toast("Something went wrong. VIDeX kept running.", { err: true }); });
  addEventListener("unhandledrejection", e => { console.error(e.reason); toast(e.reason?.message || "Something went wrong. VIDeX kept running.", { err: true }); });

  document.body.classList.add("ready");
  $(".boot")?.classList.add("gone");
  setTimeout(() => $(".boot")?.remove(), 500);
  if (!ok) toast("Browser storage is unavailable (private browsing?). Imports will last only for this session.", { err: true, ms: 6000 });

  // App-shell caching is optional: VIDeX works the same if this fails.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot().catch(e => { window.__videxFatal?.(e); });
