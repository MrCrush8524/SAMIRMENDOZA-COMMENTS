# LunaTV

**Premium Personal Cinema + Live TV Player**

LunaTV plays your own videos, live TV from playlists you add, YouTube links, and a vertical Discover feed. It installs on iPhone from Safari. No account, no server, no sign-up.

LunaTV™ is a product of Bobby, Luna & Mateo Interactive, the interactive technology division of SMR Entertainment.

---

## 1. Put LunaTV on GitHub Pages

1. Create a new repository on GitHub, for example `lunatv`.
2. Upload the **contents** of this folder, not the folder itself and not the zip file. `index.html` must sit at the top of the repository.
3. Commit the files.
4. Open the repository's **Settings**.
5. Open **Pages**.
6. Under **Source**, choose **Deploy from a branch**.
7. Branch: **main**.
8. Folder: **/ (root)**.
9. Click **Save**.
10. Wait a minute, then open the address GitHub shows you, e.g. `https://yourname.github.io/lunatv/`.

LunaTV uses relative paths and `#/` addresses (`#/home`, `#/live`, …), so it works in a sub-folder like `/lunatv/` and refreshing any screen never produces a 404. The same files also work on any other static HTTPS host: Netlify, Cloudflare Pages, Firebase Hosting, Surge or your own server.

## 2. Install on iPhone

1. Open your LunaTV address in **Safari**.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Confirm the name **LunaTV**.
5. Open LunaTV from the new icon.

It opens full-screen, like an app. This is a web app added to the Home Screen, not an App Store install, and no paid Apple Developer membership is needed.

## 3. Open your own videos

- Tap **＋** (top right) or **Library › Open Video**, then pick one or more videos.
- On a computer with Chrome or Edge you can also use **Open Folder**.
- LunaTV keeps a copy inside the browser's own storage on your device. Nothing is uploaded anywhere.
- iPhone may clear website storage when it runs low on space. If that happens, the video's title, poster and your place in it are kept, and LunaTV shows **File needs to be reconnected › Locate File**. Pick the same file to carry on.
- Categories are guessed from the filename; change them with **••• › Category**. Files named like `Show.Name.S01E02.mp4` are grouped into TV series automatically.

## 4. Live TV

**Live › Add Source** offers:

| Option | What to give it |
|---|---|
| Import M3U File | A `.m3u` / `.m3u8` channel list from your device |
| Add M3U URL | A link to a channel list. The server must allow browsers to read it; if not, download the file and import it. |
| Add Direct Stream | One stream address (`.m3u8`, MP4, WebM) and a name |
| Import XMLTV File | A programme guide `.xml` or `.xml.gz` |
| Add XMLTV URL | A link to a programme guide |
| Worldwide Free Channels | The public IPTV-org directory: thousands of free channels from about 180 countries |
| Import LunaTV Backup | A `lunatv-backup.json` you exported earlier |

- If a playlist names its own guide (`url-tvg`), LunaTV offers to add it.
- Guides are matched to channels by `tvg-id`, then by exact channel name. LunaTV never guesses, so a channel shows no guide rather than the wrong one.
- With a guide added, Live shows **Live Now**, **Movies On Now** and **Coming Up**, programme details, a full **Guide** grid, and a **mini guide** inside the player.
- Tap **•••** next to any channel to favorite, rename, hide, move, reorder or set custom artwork. **Restore Original** undoes your edits.
- In the player, **Previous / Next** change channel. Settings › Live TV can limit that to favorites.
- LunaTV plays what your browser can play. It does not get around DRM, logins, paywalls or region locks. Streams that use plain `http://` may be blocked on an `https://` site; LunaTV warns you when that's likely.
- **Remind Me** works while LunaTV is open. A system notification appears only where the browser supports it and you've allowed it; iPhone Home Screen apps get an in-app notice instead.
- **Movie artwork (optional):** add your own free TMDB key in Settings › Content › Providers to get posters and details for films the guide doesn't illustrate.

## 5. YouTube

- Tap **＋ › YouTube Link** and paste any `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…` or playlist link.
- It plays in YouTube's own official player. No sign-in and no LunaTV account.
- Some videos can only be watched on YouTube itself: the owner blocked embedding, or YouTube wants a sign-in or age check. LunaTV then says **Playback not available in LunaTV** and offers **Open in YouTube**.
- **Recently played:** LunaTV keeps its own list on this device. It isn't your YouTube history.
- **Search (optional):** add your own YouTube Data API key in Settings › Content › Providers to search and browse Shorts in Discover.

## 6. Discover (Luna Feed)

A full-screen vertical feed: swipe up for the next item, down for the previous one.

- **Tap:** play or pause.
- **Double-tap:** favorite.
- **Press and hold:** pause while held.

Feeds (providers):

- **My Videos:** your own library.
- **YouTube:** things you've played or favorited, plus search if you added a key.
- **Direct Videos:** video links you add one by one.
- **My Feeds:** your own JSON feeds (Settings › Discover), in the format `{ "items": [ { "id", "title", "thumbnail", "videoUrl" or "embedUrl", "sourceUrl", "duration" } ] }`. LunaTV never runs code from a feed.
- **Adult:** see below.

Only the item on screen (plus its neighbours, for plain videos) has a real player loaded; everything else is a thumbnail. That keeps phones fast.

## 7. Adult content (optional, off by default)

1. **Settings › Content › Adult Content**.
2. Confirm **I am 18+ — Enable**. You're asked once.
3. Adult material then appears only in **Discover › Adult**. It never shows on Home, in Live TV, in search, or in general favorites unless you allow it.

- **Eporner** uses Eporner's documented API v2 and its official embed player. The default feed is gay-only (`gay=2`); tabs include For You, Gay, Latest, Popular, This Week, Top Rated and Search. **Open in Eporner** is always available.
- LunaTV calls Eporner directly from your browser. If a browser blocks that, LunaTV shows **Provider unavailable** instead of routing your requests through anyone else.
- **My Streams:** adult M3U playlists or direct streams you add. They stay inside Discover › Adult.
- **Xfree:** LunaTV doesn't scrape sites, so Xfree is a link until it offers a supported API or embed.
- **Privacy:** Save Adult History (off by default), Private Adult Session, Clear Adult History, Hide Adult Favorites from general Favorites. Results that suggest minors are dropped before they reach the screen.

## 8. Back up and restore

- **Settings › Storage & Backup › Export Backup** saves `lunatv-backup.json`. You choose what goes in: settings, favorites, playlists, channel edits, stream sources, watch history.
- **Adult configuration** is left out unless you switch it on.
- API keys are never included, and neither are your video files.
- **Import Backup** offers **Merge** (add to what's here) or **Replace** (erase those parts first; you'll be asked to confirm).

## 9. Privacy

- No account, no analytics, no LunaTV server.
- Your videos, history, favorites, playlists, sources, guide data and keys are stored only in this browser on this device.
- **Private Session** (Settings, or Library › History) stops new history, search and Discover history until you close the tab. Favorites you tap still save.
- When you play a stream, a YouTube video or a Discover item, your device talks directly to that service.
- The offline cache holds only LunaTV's own files. It never stores channels, YouTube, adult content or your videos.
- A key you paste into LunaTV is stored in this browser. Anyone who uses this browser can read it, so treat it like any key you'd keep on a shared device.

## 10. Coming from VIDeX

The first time LunaTV opens on a site where the old VIDeX was used, it moves everything across: videos, positions, favorites, playlists, history and imported streams. It deletes the old copy only after checking everything arrived, so videos aren't stored twice. This happens once.

## For developers

- Plain HTML/CSS/JavaScript modules; no build step.
- Code map:
  - `js/app.js`: start-up
  - `js/ui.js`: navigation, sheets, routes
  - `js/database.js`: storage, settings, migration
  - `js/player.js` and `js/subtitles.js`: the player
  - `js/channels.js`, `js/m3u.js`, `js/workers/xmltv-worker.js`: live TV and guides
  - `js/discover.js` and `js/providers/*`: the feed and its providers
- **Adding a feed provider:** implement `Provider` (`js/providers/provider-base.js`) and list it in `js/providers/registry.js`.
- Version and build are in `js/version.js`. The service worker cache name follows them.
- `vendor/hls.min.js` (hls.js, Apache-2.0) is bundled so playback never depends on a CDN.

© 2026 SMR Entertainment. All rights reserved. LunaTV™ and associated names, logos and marks are trademarks of SMR Entertainment. Third-party names and trademarks belong to their owners; LunaTV is not affiliated with Apple, Google, YouTube, Eporner, Xfree, IPTV-org, TMDB or any other provider.
