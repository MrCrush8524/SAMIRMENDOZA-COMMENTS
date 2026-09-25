// Navigation (tabs with per-tab view stacks), bottom sheets, in-app dialogs,
// toasts. No browser prompt()/confirm() anywhere in VIDeX.
import { $, $$, h, esc, icon, on, debounce } from "./util.js";

// ---------------------------------------------------------------- navigation
const TABS = ["home", "live", "youtube", "library", "search"];
const stacks = Object.fromEntries(TABS.map(t => [t, []]));
let activeTab = "library";
const dock = () => $(".dock");

/** A view = scroll container. `build(inner, view)` fills it; may return {refresh, destroy}. */
function makeView({ root = false, bare = false, title = "", actions = "", build }) {
  const v = h(`<section class="view${root ? "" : " pushed"}"><div class="inner"></div></section>`);
  const inner = v.firstElementChild;
  if (root) {
    inner.insertAdjacentHTML("afterbegin", `<header class="brand"><div class="brand-inner"><img class="logo" src="logo-mark.webp" alt="VIDeX" width="520" height="157"></div></header>`);
  } else if (!bare) {
    inner.insertAdjacentHTML("afterbegin", `<header class="navbar"><button class="back" aria-label="Back">${icon("chevL")}<span>Back</span></button><h1>${esc(title)}</h1><div class="actions"></div></header>`);
    inner.querySelector(".back").onclick = () => back();
    if (actions) inner.querySelector(".actions").append(...(typeof actions === "string" ? [h(actions)] : [actions].flat()));
  }
  let lastY = 0;
  v.addEventListener("scroll", () => {
    const y = v.scrollTop;
    v.classList.toggle("scrolled", y > 6);
    if (Math.abs(y - lastY) > 6) { dock().classList.toggle("away", y > lastY && y > 90); lastY = y; }
  }, { passive: true });
  const content = h(`<div class="content"></div>`);
  inner.append(content);
  v._ctl = build(content, v) || {};
  return v;
}

export function setRoot(tab, opts) {
  const host = $(`#tab-${tab}`);
  const v = makeView({ ...opts, root: true });
  host.append(v);
  stacks[tab] = [v];
}

export function push(opts) {
  const host = $(`#tab-${activeTab}`), stack = stacks[activeTab];
  const v = makeView(opts);
  v.classList.add("enter");
  host.append(v);
  const prev = stack[stack.length - 1];
  stack.push(v);
  requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.remove("enter"); prev?.classList.add("covered"); }));
  dock().classList.remove("away");
  try { history.pushState({ videx: stack.length }, ""); } catch { /* sandboxed */ }
  return v;
}

function popView() {
  const stack = stacks[activeTab];
  if (stack.length < 2) return false;
  const v = stack.pop(), prev = stack[stack.length - 1];
  v.classList.add("leave");
  prev.classList.remove("covered");
  dock().classList.remove("away");
  prev._ctl.refresh?.();
  setTimeout(() => { v._ctl.destroy?.(); v.remove(); }, 330);
  return true;
}
/** UI back: go through history so the Android/browser back button stays in sync. */
export function back() { if (history.state?.videx) history.back(); else popView(); }

const backHandlers = [];
/** Overlays (player, YouTube embed) register here so Back closes them first. */
export function onBack(fn) { backHandlers.push(fn); }
addEventListener("popstate", () => {
  closeSheet();
  for (const fn of backHandlers) if (fn()) return;
  popView();
});

/** Drop views off the top of a tab's stack (e.g. locking X TV) without animation. */
export function popWhere(tab, pred) {
  const stack = stacks[tab];
  while (stack.length > 1 && pred(stack[stack.length - 1])) { const v = stack.pop(); v._ctl.destroy?.(); v.remove(); }
  stack[stack.length - 1]?.classList.remove("covered");
}

export function switchTab(tab) {
  if (!TABS.includes(tab)) return;
  if (tab === activeTab) {                 // re-tap: pop to root
    while (stacks[tab].length > 1) popView();
    stacks[tab][0]?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  activeTab = tab;
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === `tab-${tab}`));
  $$(".dock button").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("active", on); b.setAttribute("aria-current", on ? "page" : "false"); });
  dock().classList.remove("away");
  const top = stacks[tab][stacks[tab].length - 1];
  top?._ctl.refresh?.();
  top?._ctl.shown?.();
}
export const currentTab = () => activeTab;

/** Re-render every mounted view (cheap views re-read from IndexedDB). */
export const refreshAll = debounce(() => {
  for (const t of TABS) for (const v of stacks[t]) v._ctl.refresh?.();
}, 60);
on("library-changed", refreshAll);

// ---------------------------------------------------------------- sheets
let openScrim = null;
export function closeSheet() {
  const s = openScrim; if (!s) return;
  openScrim = null;
  s.classList.remove("show");
  s._resolve?.(null);
  setTimeout(() => s.remove(), 230);
}

/**
 * Action sheet. groups: [[{icon, label, sub, danger, run, disabled}]]
 * The sheet closes before `run` executes, so actions can open another sheet.
 */
export function sheet({ title = "", subtitle = "", groups = [] }) {
  closeSheet();
  const s = h(`<div class="scrim" role="dialog" aria-modal="true"><div class="sheet glass"><div class="grab"></div></div></div>`);
  const body = s.firstElementChild;
  if (title || subtitle) body.insertAdjacentHTML("beforeend", `<div class="sheet-title">${title ? `<b>${esc(title)}</b>` : ""}${esc(subtitle)}</div>`);
  for (const g of groups.filter(g => g && g.length)) {
    const grp = h(`<div class="grp"></div>`);
    for (const it of g.filter(Boolean)) {
      const b = h(`<button class="row${it.danger ? " danger" : ""}"${it.disabled ? " disabled" : ""}>${it.icon ? `<span class="ic">${icon(it.icon)}</span>` : ""}<span class="label">${esc(it.label)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ""}</span>${it.check ? `<span class="ic">${icon("check")}</span>` : ""}</button>`);
      b.onclick = () => { closeSheet(); it.run?.(); };
      grp.append(b);
    }
    body.append(grp);
  }
  body.append(h(`<div class="grp"><button class="row" style="justify-content:center;font-weight:650">Cancel</button></div>`));
  body.lastElementChild.firstElementChild.onclick = closeSheet;
  s.onclick = e => { if (e.target === s) closeSheet(); };
  document.body.append(s);
  openScrim = s;
  requestAnimationFrame(() => s.classList.add("show"));
  body.querySelector("button")?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- dialogs
function dialog(html, setup) {
  closeSheet();
  return new Promise(resolve => {
    const s = h(`<div class="scrim center" role="dialog" aria-modal="true"><form class="dialog glass" novalidate>${html}</form></div>`);
    const form = s.firstElementChild;
    s._resolve = resolve;
    const done = v => { s._resolve = null; resolve(v); closeSheet(); };
    s.onclick = e => { if (e.target === s) done(null); };
    form.querySelector("[data-cancel]")?.addEventListener("click", () => done(null));
    setup(form, done);
    document.body.append(s);
    openScrim = s;
    requestAnimationFrame(() => { s.classList.add("show"); form.querySelector("input,select")?.focus(); });
  });
}

export function ask({ title, message = "", value = "", placeholder = "", ok = "Save", type = "text" }) {
  return dialog(`<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}<input class="input" name="v" type="${type}" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(value)}"><div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn blue">${esc(ok)}</button></div>`,
    (form, done) => { form.onsubmit = e => { e.preventDefault(); const v = form.v.value.trim(); if (v) done(v); else form.v.focus(); }; });
}

export function confirmBox({ title, message = "", ok = "OK", danger = false }) {
  return dialog(`<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}<div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn ${danger ? "danger" : "blue"}">${esc(ok)}</button></div>`,
    (form, done) => { form.onsubmit = e => { e.preventDefault(); done(true); }; }).then(Boolean);
}

/** Multi-field form. fields: [{name, label, value, type, min, placeholder}] */
export function form({ title, message = "", fields, ok = "Save" }) {
  const f = fields.map(x => `<label class="lbl" for="f-${x.name}">${esc(x.label)}</label><input class="input" id="f-${x.name}" name="${x.name}" type="${x.type || "text"}" ${x.min != null ? `min="${x.min}"` : ""} inputmode="${x.type === "number" ? "numeric" : "text"}" placeholder="${esc(x.placeholder || "")}" value="${esc(x.value ?? "")}">`).join("");
  return dialog(`<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}${f}<div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn blue">${esc(ok)}</button></div>`,
    (el, done) => { el.onsubmit = e => { e.preventDefault(); done(Object.fromEntries(fields.map(x => [x.name, el[x.name].value.trim()]))); }; });
}

/** 4-digit PIN entry. */
export function pinPad({ title, message = "" }) {
  return dialog(`<h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ""}<div class="pin">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit ${i + 1}" autocomplete="off" type="password">`).join("")}</div><div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn blue">OK</button></div>`,
    (form, done) => {
      const ins = $$(".pin input", form);
      ins.forEach((inp, i) => {
        inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(-1); if (inp.value && i < 3) ins[i + 1].focus(); if (ins.every(x => x.value)) form.requestSubmit(); };
        inp.onkeydown = e => { if (e.key === "Backspace" && !inp.value && i) ins[i - 1].focus(); };
      });
      form.onsubmit = e => { e.preventDefault(); const v = ins.map(x => x.value).join(""); if (v.length === 4) done(v); };
    });
}

// ---------------------------------------------------------------- toast
let toastEl, toastT;
export function toast(msg, { err = false, ms = 2200 } = {}) {
  toastEl ||= document.body.appendChild(h(`<div class="toast glass" role="status" aria-live="polite"></div>`));
  toastEl.textContent = msg;
  toastEl.classList.toggle("err", err);
  toastEl.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// ---------------------------------------------------------------- misc components
export function searchField(placeholder, oninput) {
  const f = h(`<label class="field">${icon("search")}<input type="search" enterkeyhint="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><button type="button" class="clear" aria-label="Clear" hidden>${icon("close")}</button></label>`);
  const inp = f.querySelector("input"), clr = f.querySelector(".clear");
  const fire = debounce(() => oninput(inp.value.trim()), 140);
  inp.oninput = () => { clr.hidden = !inp.value; fire(); };
  clr.onclick = () => { inp.value = ""; clr.hidden = true; oninput(""); inp.focus(); };
  return f;
}

export function segmented(options, value, onchange) {
  const s = h(`<div class="seg" role="tablist">${options.map(([v, l]) => `<button type="button" role="tab" data-v="${esc(v)}" class="${v === value ? "on" : ""}" aria-selected="${v === value}">${esc(l)}</button>`).join("")}</div>`);
  s.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", s).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    onchange(b.dataset.v);
  };
  return s;
}

export function switchEl(checked, onchange) {
  const s = h(`<button type="button" class="switch" role="switch" aria-checked="${!!checked}"></button>`);
  s.onclick = e => { e.stopPropagation(); const v = s.getAttribute("aria-checked") !== "true"; s.setAttribute("aria-checked", v); onchange(v); };
  return s;
}

/** Render a long list in chunks as the user scrolls (no thousands of nodes at once). */
export function incremental(container, items, renderOne, { chunk = 60, root = null } = {}) {
  let i = 0;
  const sentinel = h(`<div class="sentinel"></div>`);
  const more = () => {
    const frag = document.createDocumentFragment();
    for (const end = Math.min(items.length, i + chunk); i < end; i++) frag.append(renderOne(items[i], i));
    sentinel.before(frag);
    if (i >= items.length) { io.disconnect(); sentinel.remove(); }
  };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { root, rootMargin: "600px" });
  container.append(sentinel);
  more();
  if (i < items.length) io.observe(sentinel);
  return () => io.disconnect();
}
