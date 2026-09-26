// Interface language: English (source), Español, Português (Brasil).
// Strings are written in English in the code and looked up here; anything
// missing falls back to English. Changing language reloads the interface.
import { ES } from "./locales/es.js";
import { PT } from "./locales/pt.js";

export const LANGUAGES = [["en", "English"], ["es", "Español"], ["pt", "Português"]];
const DICTS = { es: ES, pt: PT };
const LOCALES = { en: "en-US", es: "es", pt: "pt-BR" };
const KEY = "lunatv.lang";

function detect() {
  try { const s = localStorage.getItem(KEY); if (s && (s === "en" || DICTS[s])) return s; } catch {}
  const nav = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return nav.startsWith("es") ? "es" : nav.startsWith("pt") ? "pt" : "en";
}
let current = detect();
export const lang = () => current;
/** BCP-47 locale for dates, times and numbers. */
export const locale = () => LOCALES[current];

/** Translate. `vars` fill {placeholders}: tr("Added {n} videos", { n: 3 }). */
export function tr(s, vars) {
  let out = (current !== "en" && DICTS[current][s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}
/** Singular/plural: trn("{n} video", "{n} videos", n). Same 1-vs-other rule in all three languages. */
export const trn = (one, other, n, vars = {}) => tr(n === 1 ? one : other, { n: typeof n === "number" ? n.toLocaleString(locale()) : n, ...vars });

export function setLang(code) {
  if (code !== "en" && !DICTS[code]) return;
  try { localStorage.setItem(KEY, code); } catch {}
  current = code;
  location.reload();
}

// date/time helpers in the chosen language
export const fmtClock = ts => new Date(ts).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
export const fmtDate = ts => new Date(ts).toLocaleDateString(locale());
export const fmtDateTime = (ts, opts = { dateStyle: "medium", timeStyle: "short" }) => new Date(ts).toLocaleString(locale(), opts);
export const fmtWeekday = ts => new Date(ts).toLocaleDateString(locale(), { weekday: "short" });

/** Static markup (index.html) uses data-i18n / data-i18n-aria attributes. */
export function translateStatic(root = document) {
  document.documentElement.lang = current === "pt" ? "pt-BR" : current;
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tr(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", tr(el.dataset.i18nAria)); });
}
