# VIDeX: Style B build

VIDeX is built to `VIDeX_Master_Construction_Brief_Style_B`. It's a static site with no build step, so this folder is what you deploy.

## Deploy

1. On Netlify, drag this `videx/` folder onto the manual deploy page, or connect the repo with **base directory `videx`**. `netlify.toml` holds the headers.
2. In Google Cloud Console, under **Credentials**, open OAuth client `377117992546-tguolq0bqjvrog0s46f2kr50nchhfekn`. Add `https://videxx.netlify.app` to **Authorized JavaScript origins**. Without it, Google sign-in fails with `origin_mismatch`.
3. Make sure the YouTube Data API v3 is enabled for that project. The OAuth consent screen must list the `youtube.readonly` scope. Until Google verifies the app, only listed test users can sign in.

No client secret exists anywhere in the code, and none is needed.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Shell: ambient backdrop, five tab hosts, the dock, the boot splash, and a last-resort "couldn't start" screen. |
| `css/app.css` | One stylesheet, organized as tokens → shell → components. Colors come from the brief's table. |
| `js/app.js` | Entry point. Starts each area separately, so one failure can't take down the others. |
| `js/ui.js` | Tab stacks with push/back (and browser/Android Back), sheets, in-app dialogs (no `prompt()`), toasts, and incremental lists. |
| `js/db.js` | IndexedDB v4, with a memory fallback when storage is blocked. Migrates the two earlier VIDeX schemas. |
| `js/store.js` | Local media: import, metadata, progress, poster frames, playlists/collections, subtitles, series grouping. |
| `js/library.js` | The Style B Library: six rows, shelves, destinations, movie/series detail, the options sheet, playlist editing. |
| `js/player.js` | The player, created on first use. |
| `js/tv.js` + `js/directory-worker.js` | Live TV and X TV, both Country → Category → Channel. The directory is built in a Web Worker and cached for 12 h. |
| `js/youtube.js` | Google Identity Services token client, YouTube Data API search, official embed. |
| `js/home.js`, `js/search.js` | Home dashboard + Settings, and global search. |
| `sw.js` | Optional app-shell cache (network-first). The app works the same if registration fails. |
| `logo-mark.webp` | The supplied transparent logo, cropped to the wordmark. The dark haze and reflection floor baked into the PNG were keyed out, so no box shows behind it when content scrolls underneath. |

## How the brief's hard parts are handled

- **Header / dock.** The brand header is transparent. Once a screen scrolls, a blurred, gradient-masked layer fades in *behind* the logo, so content visibly slides under it. The dock hides when you scroll down, returns when you scroll up, disappears in the player, and comes back when you go back or close the player.
- **Storage.** The video Blob is written once, to its own store. Titles, favorites, progress, and posters live in small records, so editing never rewrites a video. The app requests `navigator.storage.persist()` and shows usage and persistence in Local Files and Settings. When the browser has evicted a video's stored copy, the player says so plainly instead of failing.
- **Player.** Controls hide after 3 s while playing, stay up while paused or scrubbing, and come back on tap or mouse movement. Touch gestures:
  - tap toggles the controls
  - double-tap on the left or right third skips ∓10 s
  - vertical swipe on the left half sets brightness (CSS only)
  - vertical swipe on the right half sets volume; on iOS, where pages can't set volume, the display says "Use your device's volume buttons"

  With a mouse, a click plays/pauses and a double-click toggles fullscreen. Reverse is honestly labelled "simulated": it seeks backward repeatedly and waits for each seek to finish. Frame stepping uses a frame rate measured with `requestVideoFrameCallback`. Subtitles accept SRT (converted to VTT) or VTT, and are saved per video. Screen grabs download a PNG, or open the iOS share sheet. Live mode hides controls that can't work on a live stream.
- **Live TV.** Data comes from the IPTV-org API, and the adapter is swappable (`PROVIDERS` in the worker). Streams a browser can never play are dropped and counted: http on an https page, streams that need custom Referer/User-Agent headers, and DASH. Channel-less streams are excluded because nothing tells us whether they're adult. Each channel keeps every stream URL it has and fails over to the next one. After a fatal error or 20 s of silence, VIDeX shows "Channel unavailable" with Try again / Close.
- **X TV.** It opens behind an 18+ confirmation (once per session), with an optional 4-digit PIN (stored as a SHA-256 hash). The PIN re-locks when you leave X TV or the app goes to the background. It has its own favorites, history, and imports (M3U/M3U8 file, remote URL, direct URL). X TV can be hidden (turn it back on in Home › Settings). Adult entries never reach Live TV, global search, or Home.

## QA done (local, headless Chromium, real IPTV-org data)

Two scripted runs cover the brief's acceptance list: 75 checks, all passing, with no console errors. The QA scripts live outside the repo.

- **Library and player (42 checks):**
  - importing 4 files, with poster frames and series grouping
  - all six Library rows open
  - movie and series detail
  - player open with the dock hidden, auto-hide at 3 s, tap-to-wake, controls held while paused
  - ±10 s, scrubber, frame step both ways, 1.5× speed, reverse while playing, PNG screen grab, fullscreen
  - close back to detail with the dock restored
  - Resume, and Continue Watching filling in
  - favorite, rename through the dialog
  - playlist create/add/reorder/repeat, Play All with Next
  - collection
  - search by playlist and by series name
  - remove with confirmation
  - scroll behavior (header blur, dock away/back)
  - Home shelves
- **Online areas (33 checks):**
  - 177 countries from source data
  - US → 30 non-empty categories → a chunked channel grid that loads more on scroll
  - a dead stream ending on the "Channel unavailable" message
  - channel favorites
  - X TV: the 18+ gate, M3U import browsed Country → Category → Channel, direct URL, a remote URL failure explained
  - isolation from Search and Home
  - PIN lock, wrong PIN refused, right PIN unlocks
  - hide X TV, and re-show it from Settings
  - YouTube: sign-in with the supplied client ID, connected state, search with the bearer token, official embed with a VIDeX close button, sign out
  - dead-control scan: every visible button on every root screen has a handler

**Not yet tested. Do these on the deployed site before calling it production-ready:**
- **Real stream playback.** This sandbox can't reach stream hosts or Google. Play a known-good free channel on iPhone Safari (native HLS) and on desktop Chrome (hls.js).
- **Real Google sign-in and YouTube search.** Tests used a stand-in for Google's scripts and API.
- **iPhone hardware.** Safe areas, notch/Dynamic Island, home indicator, and iOS fullscreen and share-sheet screen grabs. Chromium can't emulate these.

## Known limits

- **X TV's built-in directory is nearly empty.** IPTV-org, the current source, now lists only one channel flagged adult, and it's categorized as music. X TV says so on screen; imports work fully. Filling the built-in directory needs another lawful source. The worker's `PROVIDERS` table is where it would go.
- **Formats.** Playback depends on the browser: Safari won't play MKV, and Chrome has no AC-3 audio.
- **Storage.** Videos are copied into browser storage and count against the site's quota. iOS can clear it unless persistence is granted.
- **Search quota.** YouTube `search.list` costs 100 quota units, so the default quota allows about 100 searches per day across all users.
