# In Samir's Mind — Walk Through Dreams

Fresh Three.js/WebGL browser build (4.0 rebuild), independent of the old
Backrooms/Electron pipeline elsewhere in this repo. Targets Cloudflare
Pages (app shell) + Cloudflare R2 (heavy assets) for production; local
`public/assets/` currently holds a curated subset of the full asset
packet, just enough to run the vertical slice end to end.

## Run locally

```
npm install
npm run dev
```

## What's implemented (first engineering milestone)

Title -> New Dream -> Character Selector (Bobby / Luna / Mateo, real
selector-card art) -> Begin Dream -> Chapter I (Memory Atrium) with:

- WASD + mouse-look movement, pointer lock, AABB collision against room
  bounds and instanced washer geometry
- One journal fragment pickup (of 3 curated spots), popup stays open
  until closed
- One Memory Cat pickup
- One inventory item pickup (Lint Roller)
- One Dream Track pickup with SAVE FOR LATER / PLAY NOW, main soundtrack
  fades out -> pauses at exact position -> track plays -> resumes from
  that position
- One manual TV (press E) and one proximity-auto TV, both duck/pause the
  main soundtrack during broadcast and resume cleanly after
- Doubt: a translucent black cat silhouette that appears/disappears on
  its own timer, not a chase
- Moon Door that lights up only once required discoveries are made, and
  triggers a save on transition
- Versioned `localStorage` save/reload; New Dream vs. Continue on the
  title screen reflect real save state
- English / Spanish / Brazilian Portuguese language selector on the
  title screen

Full asset packet (character references, all 10 Dream Tracks, all 5
approved broadcasts, environment/wallpaper reference boards) lives in
`../game-assets/` at the repo root (not committed — see Cloudflare R2
plan) and should be consulted before building out Chapters II-IV.

## Explicit constraints carried over from the rebuild brief

- No heavy photorealistic full-body animal models — first-person
  paw/partial-body proxies only, upgradeable later.
- No full photographic images stretched across walls — wall material +
  posters/decals only.
- No YouTube video — local/R2-controlled `.mp4` only.
- Do not reuse the old repo's GitHub Pages/Electron/Android pipeline for
  this project.
