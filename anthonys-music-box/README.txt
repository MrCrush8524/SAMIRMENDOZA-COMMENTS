ANTHONY'S MUSIC BOX (AMB) — v2.6 "Black Crystal"
=================================================

DEPLOY TO NETLIFY
1. Netlify → Add new site → Deploy manually → drag this ZIP (or the unzipped folder).
   index.html is at the root. There's no build step.
2. To keep an existing library and playlists, deploy over the SAME site/URL the
   prototype used. v2 reads the prototype's storage (IndexedDB "smr-music-v1",
   playlists, favorites). A different URL starts with a separate, empty library.
3. On iPhone: open the site in Safari → Share → Add to Home Screen, then import
   music from inside the installed app. Safari and the Home Screen app each keep
   their own library.

ABOUT (v2.6)
Anthony's Music Box — Premium Personal Music + Worldwide Radio Player.
Product of Bobby, Luna & Mateo Interactive, a technology division of SMR
Entertainment. Navigation: Home · Library · Radio · Playlists · Search ·
Settings. Radio opens into Around the World, Countries, Genres, Favorites,
Recently Played and Local Stations. About is in Settings (or tap the wolf).

THEME (v2.3)
All black and silver: no blue anywhere. Black backgrounds, neutral glass,
white text and highlights, gray secondary text. The Now Playing backdrop is
a dark, colorless blur of the artwork. Red is kept only for delete and LIVE,
amber only for warnings.

BRANDING (v2.2)
The chrome AMB wolf with musical engraving: the transparent wolf mark in the
app header, empty states and Settings; wolf + AMB wordmark on the launch
screen and default cover; new Home Screen / app icons.

WHAT'S INSIDE
index.html, css/app.css, js/*.js (plain ES modules), sw.js (offline app shell),
manifest.webmanifest, _headers (security + caching), netlify.toml, assets/.

FEATURES
- Home: Recently Played, Made for Anthony mixes (Late Night, Favorites Mix,
  Forgotten Tracks, New in the Box, all built on this device from local
  listening history), Recently Added, Favorites, Most Played. Sections with
  nothing in them stay hidden.
- Library: Playlists, Artists, Albums, Songs, Genres, Recently Added, Favorites,
  Live Radio, Local Files. Edit chooses which rows show. Songs sort by Title /
  Artist / Album / Date Added / Recently Played / Play Count. Select mode for bulk
  Favorite, Play Next, Add to Playlist, Remove.
- Search: grouped Songs / Albums / Artists / Playlists / Genres that update as you
  type, a Top Result, and Recent Searches.
- Album, Artist (Top Songs from your own play counts), Genre, Playlist and Mix
  pages. Back returns to the exact scroll position.
- Now Playing: background drawn from the artwork, scrubbable progress, skip /
  play / skip, volume (where the browser allows it), Lyrics (embedded synced
  lyrics highlight line by line; tap a line to jump), Output (shown only where
  the browser offers a speaker picker), Queue sheet. More menu: Favorite, Add to
  Playlist, Play Next/Last, Go to Album/Artist, Song Info, Edit Details, Sleep
  Timer, Remove from AMB. Swipe down to close.
- Queue: drag to reorder, × or swipe left to remove, Clear, Shuffle (a fixed
  shuffled order), Repeat All / Repeat One, History. The queue survives reloads.
- Import: multiple files; whole folders on desktop; drag & drop on desktop.
  Reads ID3v2.2/2.3/2.4 + ID3v1 (MP3), MP4/M4A atoms, FLAC and Ogg Vorbis/Opus
  comments, and WAV INFO: title, artist, album, album artist, track/disc, year,
  genre, duration, artwork, plain and synced lyrics. Untagged files get a clean
  title from the filename ("Artist - Title" is recognized). The same file
  imported twice is skipped. Files this browser can't decode are reported
  rather than added.
- Artwork: embedded → set manually → another track on the same album → AMB
  cover. Lists use small thumbnails, not the full images.
- Playlists: create, rename, delete, add, remove, drag to reorder, Play,
  Shuffle, Play Next/Last. Mixes can be saved as playlists.
- Settings: storage used, a request to keep the library protected from
  cleanup, backup/restore of playlists, favorites and history (JSON), clear
  history, remove all.
- Live Radio (only this part uses the internet, and only once you open it):
  Radio Browser directory, search by name, country and genre, saved stations,
  add your own https:// stream.
- Videos (new in v2.1): add MP4, M4V, MOV or WebM with Add Music. AMB spots
  video automatically, grabs a poster frame as artwork, and lists videos under
  Library → Videos (they stay out of Songs). They play in Now Playing and join
  the queue and playlists like songs.
  Picture in Picture: the button in Now Playing and on the mini-player. Close
  Now Playing while a video plays and it moves into Picture in Picture on its
  own (Settings → Video turns this off). On iPhone, going to the Home Screen
  during a video also switches to Picture in Picture. Double-tap the video, or
  More → Full Screen, for full screen.
- Lock screen / system media controls through the Media Session API.
- Keyboard: Space, ←/→ seek, Shift+←/→ skip, / search, Esc back.
- Desktop: sidebar layout, two-column Now Playing. Tablet: wider grids.

PRIVACY
Music, file names and listening history never leave the device. No accounts,
no analytics. Removing a song from AMB never deletes your original file.

HONEST NOTES FOR iPHONE
- Tested in Chromium at 375, 390, 430, 820 and 1280 px widths. NOT yet
  tested on a physical iPhone. Please check lock-screen controls and
  background playback on the device after deploying.
- iOS keeps web audio playing in the background while the app stays alive.
  It can pause it if the app is swiped away, during calls, or when memory is
  low. The sleep timer relies on the page staying active.
- iOS doesn't let web apps change volume, so the slider is hidden there. Use
  the side buttons. Choose speakers or headphones in Control Center.
- Safari can clear website data. Keep your original music files. Settings →
  "Ask the browser to keep my library" and adding AMB to the Home Screen both
  help.
- Video: iPhone plays H.264/HEVC MP4, M4V and MOV. WebM depends on the iOS
  version. Unlike music, a video keeps playing in the background only while
  it's in Picture in Picture; iOS pauses a hidden video.
- FLAC/OGG playback depends on the browser (recent iOS plays FLAC; Ogg Vorbis
  support is limited on older iOS).
