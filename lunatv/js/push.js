// Web Push client. Switched on by filling js/push-config.js; until then every
// function here reports "not configured" and reminders stay in-app.
import { PUSH } from "./push-config.js";

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushConfigured = () => !!(PUSH.vapidPublicKey && PUSH.subscribeUrl && PUSH.scheduleUrl);
/** On iPhone/iPad, Web Push works for the Home Screen app, not a Safari tab. */
export const needsHomeScreen = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches && !navigator.standalone;

const b64 = s => { const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error(`Push server answered HTTP ${r.status}.`); });

/** Ask permission (must follow a tap) and return this device's push subscription. */
export async function subscription() {
  if (!pushSupported() || !pushConfigured()) return null;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission !== "granted") return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(PUSH.vapidPublicKey) }); await post(PUSH.subscribeUrl, { subscription: sub }); }
  return sub;
}
/** Hand a reminder to the push sender. Returns true if the server accepted it. */
export async function scheduleRemote(r) {
  const sub = await subscription(); if (!sub) return false;
  await post(PUSH.scheduleUrl, { subscription: sub, reminder: { id: r.id, title: r.title, body: `On ${r.channel}`, start: r.start, url: "./#/live" } });
  return true;
}
export async function cancelRemote(id) {
  if (!pushConfigured() || !PUSH.cancelUrl) return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) await post(PUSH.cancelUrl, { subscription: sub, reminderId: id }).catch(() => {});
}
