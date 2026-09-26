// Web Push configuration. Empty = off (reminders fire while LunaTV is open).
// To deliver reminders when the app is closed — including the iPhone Home
// Screen app (iOS 16.4+) — run a push sender and fill these in:
//   vapidPublicKey: your VAPID public key (base64url). The private key stays on the server.
//   subscribeUrl:   POST { subscription }                 → store the device
//   scheduleUrl:    POST { subscription, reminder }       → send a push at reminder.start
//   cancelUrl:      POST { subscription, reminderId }     → cancel it
// Nothing secret belongs in this file; it's served to every browser.
export const PUSH = { vapidPublicKey: "", subscribeUrl: "", scheduleUrl: "", cancelUrl: "" };
