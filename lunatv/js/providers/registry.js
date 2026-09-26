// Provider registry. Adding a provider = implementing Provider and listing it here.
// Future RapidAPI-based adapters read their key from Settings › Content ›
// Providers (stored on this device only; never committed to the repository).
import { localProvider } from "./local.js";
import { youtubeProvider } from "./youtube.js";
import { jsonProvider, directProvider } from "./json-feed.js";
import { epornerProvider } from "./eporner.js";
export { XFREE } from "./xfree.js";

export const GENERAL = [localProvider, youtubeProvider, directProvider, jsonProvider];
export const ADULT = [epornerProvider];
export const RAPIDAPI = [];   // none installed yet
export const byId = id => [...GENERAL, ...ADULT].find(p => p.id === id);
