// Interface language: English (source), Español, Português.
// Strings are keyed by their English text; anything missing falls back to English.
import { readLS, writeLS } from './db.js';
import es from './lang/es.js';
import pt from './lang/pt.js';

export const LANGS = [['en', 'English'], ['es', 'Español'], ['pt', 'Português']];
const DICTS = { es, pt };
const LOCALES = { en: 'en-US', es: 'es', pt: 'pt-BR' };

function detect() {
  const saved = readLS('amb-lang', null);
  if (LANGS.some(l => l[0] === saved)) return saved;
  for (const l of navigator.languages || [navigator.language]) {
    const base = String(l || '').slice(0, 2).toLowerCase();
    if (base === 'es' || base === 'pt') return base;
  }
  return 'en';
}

let lang = detect();
document.documentElement.lang = lang;
const listeners = new Set();

export const getLang = () => lang;
export const locale = () => LOCALES[lang] || 'en-US';
export const onLang = fn => (listeners.add(fn), () => listeners.delete(fn));

export function setLang(l) {
  if (!LANGS.some(x => x[0] === l) || l === lang) return;
  lang = l;
  writeLS('amb-lang', l);
  document.documentElement.lang = l;
  applyStatic();
  listeners.forEach(fn => { try { fn(l); } catch (e) { console.error(e); } });
}

export function t(s, vars) {
  let out = (lang !== 'en' && DICTS[lang]?.[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}

// Translate the static markup in index.html: data-i18n (text), data-i18n-aria (aria-label).
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
