# VIDeX: teardown and revision notes

Source: `VIDeX-Netlify-Deploy.zip`. It held one file, `index.html`, 4,399,947 bytes.
The first commit in `videx/` holds that original code. The only change in that
commit is that the inlined logo was pulled out into a file (see below). The
second commit is the revision, so `git diff HEAD~1 -- videx/index.html` shows
every change.

## What it is

VIDeX is a single-page, no-build, no-framework web app. It's styled like an
iOS media player: a frosted-glass tab bar, horizontal rails, and bottom sheets.
It has five tabs.

| Tab | What it does | Backing |
|---|---|---|
| Library / Home | Video files you pick from the device are stored **inside the browser** and shown in rails: Continue Watching, Recently Added, Movies. | IndexedDB `videx`. The file's `Blob` is stored whole. |
| Live TV | A searchable directory of free-to-air channels, with country and category filters. | `iptv-org.github.io/api/` `channels.json` + `streams.json` + `logos.json`, fetched live. |
| 18+ | Imports a local `.m3u`/`.m3u8` playlist file and lists its entries. It is never merged into the public directory. | `FileReader` plus a 6-line M3U parser. |
| YouTube | Google sign-in, then search. Results play in the YouTube embed iframe. | Google Identity Services token client, `youtube.readonly` scope, YouTube Data API v3 `search.list`. |
| Search | Name search over the local library. | IndexedDB scan. |

The player is a full-screen `<video>` with:
- ±10 s skip buttons
- a seek bar
- a speed cycle (0.25×–2×)
- REV (fake reverse playback: seeks backward 0.1 s every 100 ms)
- a frame grab (canvas → PNG download)
- a fullscreen button
- swipe gestures: left half for brightness (a CSS `filter`), right half for volume

Controls fade after 3 s of playback.

### Data model (original, IndexedDB v2)

```
media  { id: "<filename>|<size>|<lastModified>", name, filename,
         type: "movie"|"show",         // regex: s01e02 / season / episode → show
         blob: File, added, favorite, position, duration,
         playlists: [], collections: [] }      // these two arrays are never used
groups { id: "<type>|<lowercased name>", type: "playlist"|"collection",
         name, media: [mediaId, …] }
```

### External dependencies and identifiers

- **Google OAuth client ID** `377117992546-tguolq0bqjvrog0s46f2kr50nchhfekn.apps.googleusercontent.com`.
  Client IDs are public by design, so this is not a leak. But sign-in only
  works from the origins listed for that client in Google Cloud Console. A
  new Netlify URL has to be added there, or you get `origin_mismatch`.
- `https://accounts.google.com/gsi/client`, loaded the first time you open the YouTube tab.
- `https://iptv-org.github.io/api/*.json`, a few MB per session.
- The revision adds `hls.js@1.5.20` from jsDelivr, loaded only the first
  time you play an HLS stream in a browser that can't play HLS itself.

## Findings

✔ = fixed in the revision and **verified in headless Chromium** against the
original (side-by-side script, numbers below). ✎ = fixed by code reading.
○ = not fixed: it's a platform or product limit, not a bug.

### Size
- ✔ **The logo PNG (656 KB) was base64-inlined five times, once per tab
  header.** That's 3.3 MB of a 4.4 MB page, and base64 adds another third.
  Now it's one `logo.webp` at 560×280 (2× its 270 px display width) that the
  browser caches: **55 KB**. The page is now about 40 KB. The first load drops
  from 4.4 MB to about 100 KB.

### Playback
- ✔ **REV did nothing if the video was playing.** The handler calls
  `v.pause()`, then starts its interval. The browser fires the `pause` event
  later, asynchronously, and the `pause` handler ran `clearInterval(reverseTimer)`,
  which killed the reverse it had just started. It also left `reverseTimer`
  non-null, so the next tap said "Reverse off". REV only worked when you were
  already paused.
  *Test:* original 9.00 s → 9.04 s after 1.2 s of REV. Revised: 8.99 → 7.83.
  The reverse step now also waits for the previous seek to finish, so seeks
  don't pile up on long-GOP files, and it scales with the chosen speed.
- ✔ **Live TV couldn't play on Chrome, Firefox, or Android.** Nearly every
  iptv-org stream is HLS (`.m3u8`), and only Safari plays HLS in `<video>`.
  The original assigned the URL to `v.src` and showed "Tap play if this stream
  allows browser playback" for streams that could never play there. hls.js is
  now loaded on first use and attached through Media Source Extensions (MSE).
  It's destroyed when the player closes.
- ✔ **Streams that can never play in a browser were listed anyway.** Some
  are plain `http://`, which the browser blocks as mixed content on an https
  Netlify site. Others need a spoofed `Referer`/`User-Agent` (iptv-org's
  `referrer`/`user_agent` fields), and a page can't set those headers. Both
  kinds are filtered out now, and the count is shown ("… unplayable in a
  browser hidden").
- ✎ Stream failures now show a real message ("Stream offline or blocked by
  its host", "This video can't be played here") instead of failing silently.
- ✎ The frame grab no longer tries to save an empty 0×0 PNG before the video
  loads. It now reports that cross-origin streams block grabs instead of
  failing silently. It also revokes the download URL it creates.
- ✎ Fullscreen now uses the player container, so the custom controls stay
  visible. It falls back to iOS `webkitEnterFullscreen`. Closing the player
  exits fullscreen.
- ✎ Swipe gestures: a swipe that starts on the control bar is ignored. In the
  original, scrubbing the seek bar also changed the brightness. A 12 px dead
  zone stops taps from registering as swipes. iOS ignores writes to
  `video.volume`, so the original's volume swipe showed "🔊 80%" and nothing
  changed. On iOS both halves now control brightness.
- ✎ Added keyboard control for desktop: Space/K, ←/→, ↑/↓, F, Esc.
- ✎ Added "Play all" on playlists, with auto-advance on `ended`.

### Storage and memory
- ✔ **Every rail card made its own blob URL and its own
  `<video preload=metadata>`, and the URLs were never revoked.** Five rails,
  one video, three open/close cycles: the original created 27 blob URLs and
  kept 3 decoders alive per video. Each `renderAll()` (every player close,
  favorite, rename…) made a new set. With a real library, that means hundreds
  of media decoders, and mobile Safari reloads the tab. Now one hidden
  `<video>` captures one 272-px JPEG poster per file. The poster is cached in
  its own IndexedDB store, reused across renders, and loaded lazily with
  `IntersectionObserver`. *Test:* 6 blob URLs, 0 decoders in the rails.
- ✎ **Progress saves rewrote the whole video.** `ontimeupdate` saved when
  `Math.floor(currentTime) % 4 === 0`. `timeupdate` fires about 4 times a
  second, so that's a burst of 3–4 writes every fourth second. Each write
  `put()` the full media record, video `Blob` included. Position now lives in
  its own `progress` store. Saves happen at most every 5 s, plus on pause,
  close, tab hide, and `pagehide`. The v2→v3 upgrade copies old positions over.
- ✔ **Re-adding a file wiped its progress, favorite flag, and custom name.**
  `addFiles` blindly `put()` a fresh record under the same id. Existing ids
  are skipped now ("1 already in library"). *Test:* Continue Watching went
  1 → 0 in the original and stayed at 1 in the revision.
- ✔ **Closing the player before the resume seek finished saved position 0**,
  which wiped progress. Saves are held until the seek lands.
- ✎ **Picking the same file again did nothing.** The `<input type=file>` was
  never cleared, so `change` didn't fire. It's cleared after each pick now.
- ✎ Files with an empty MIME type were silently dropped. Android and Windows
  often report `.mkv` that way. Such files are now accepted by extension.
- ✎ Files with `Infinity` duration (MediaRecorder output and many screen
  recordings) broke progress math. Their duration is now stored as 0, meaning
  unknown.
- ✎ Calls `navigator.storage.persist()` after the first import. Without it,
  the browser may evict the videos stored in IndexedDB when disk space runs
  low.
- ✎ Deleting a video left its id inside every playlist and collection, so
  counts stayed wrong for good. Delete now cleans up groups, progress, and the
  poster. It also asks for confirmation first.

### Library UI
- ✔ **Playlists and Collections were dead ends.** Tapping a group did
  nothing. Now it opens and lists its videos, with Play all and Delete.
- ✎ The filter sheet titles read "▣ Movies" because `innerText` included the
  icon glyph. Fixed.
- ✎ Home's Continue Watching included finished videos, but Library's didn't.
  Both now use the same rule. Finishing a video resets its position to 0.
- ✎ Added "Mark as Movie / TV Show", because the filename regex guesses wrong
  often.
- ✎ **The bottom sheet had no scroll.** A 2,000-entry M3U ran off the screen
  and couldn't be reached. The sheet now caps at 82vh and scrolls.
- ✎ **Desktop tab bar:** `.bottom.hidden { transform: translateY(120%) }`
  replaced the desktop `translateX(-50%)`, so the bar jumped sideways as it
  hid. The translate is combined now.
- ✎ Messages such as "Added to Faves" were drawn *inside* the player, which is
  `display:none` outside playback. The message now sits at the page level.
- ✎ The error banner couldn't be dismissed. Tapping it now closes it.
- ✎ The M3U parser gave a URL with no `#EXTINF` line of its own the previous
  channel's name. Each entry now gets its own name or a numbered fallback.
- ✎ Live TV search re-rendered up to 300 cards on every keystroke. It's
  debounced now. When the list is truncated at 300, the page says so. Rapid
  tab switching could start two directory loads at once; it can't now.
  Channel logos lazy-load and remove themselves if they fail to load.

### YouTube
- ✎ An expired token (Google Identity Services tokens last about 1 h) now
  returns you to "sign in again" instead of showing a raw 401. A missing
  thumbnail no longer throws. Thumbnail URLs and `videoId` are escaped. A
  blocked GIS script now shows a message instead of hanging.
- ○ **`search.list` costs 100 quota units.** The default 10,000/day project
  quota covers about 100 searches per day **across all users**.
- ○ `youtube.readonly` is a *sensitive* scope. Until the OAuth consent screen
  passes Google verification, users see the "unverified app" warning, and
  only the test users you list can sign in (100 max).
- ○ Sign-in isn't needed to search. An API key restricted by HTTP referrer
  would remove the OAuth step. Sign-in only earns its keep for personal data
  (subscriptions, playlists, liked videos), and the app doesn't use any.

### Accessibility and PWA
- ✎ Removed `user-scalable=no`, which blocked pinch-zoom for low-vision
  users. Added `aria-label` to every icon-only button, `alt` text, a
  `:focus-visible` ring, and `aria-live` on status messages. Thumbnails are
  real `<button>`s now.
- ✎ Added `manifest.webmanifest` and 192/512 icons, so "Add to Home Screen"
  installs a proper standalone app. The original had the Apple meta tags but
  no manifest or icon.
- ✎ Added `netlify.toml`: `index.html` is never served stale, images are
  cached, and a `Referrer-Policy` keeps YouTube embeds working. The embed
  shows error 153 if no referrer is sent.

## Not changed (known limits)
- **Codecs:** playback depends on the browser. MKV/HEVC/AC-3 files that play
  in VLC often won't play here: Safari won't play MKV at all, and Chrome has
  no AC-3 audio. Fixing that means shipping ffmpeg.wasm, which is about 25 MB.
- **Storage:** files are copied into browser storage, so a 4 GB movie uses
  4 GB of quota. Chromium's File System Access API could store a handle to the
  file instead of a copy. It isn't available on iOS.
- **Offline:** no service worker. The shell needs the network on first load
  each session, and so do Live TV and YouTube.
- **Live TV legality:** iptv-org lists publicly available links, but whether
  a given stream is licensed in your country is not something the app checks.

## Deploying

Drag the `videx/` folder onto Netlify's manual deploy page. Or point a Netlify
site at this repo with **base directory `videx`**. Then add the new site's
origin to the Google OAuth client's *Authorized JavaScript origins*.
