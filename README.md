# The Backrooms

A walkable, dreamcore-pastel three.js recreation of the Backrooms wiki
blueprint — pillar-forests, flooded lowlands, a metro station, a church,
posters on the walls, a teleport menu, and (PC only) vintage commercials
looping on CRT screens throughout the building.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `lib/`, `posters/` | The web build. Open `index.html` directly, or serve the folder. This is also what gets deployed to the website and wrapped for Android. |
| `electron/` | The Windows desktop app. `electron/app/` is its own copy of the web build, plus `electron/app/videos/` (the six commercials — desktop-only, too heavy for web/mobile) and the TV-screen code that only activates when `window.ELECTRON_BUILD` is set. |
| `android-app/` | The Android app, built with [Capacitor](https://capacitorjs.com/) (a native WebView wrapper around `android-app/www/`, a copy of the web build). |
| `videx/` | VIDeX, a separate single-page local video player / live TV / YouTube app, deployed on its own to Netlify. Built to the Style B brief; see `videx/README.md` for deploy steps, architecture and QA status. Not part of the Backrooms build or its CI. |
| `.github/workflows/` | CI that builds the Windows `.exe`, the Android `.apk`, and deploys the website — see below. |

The three copies of the web build (`/`, `electron/app/`, `android-app/www/`)
are kept in sync by regenerating them from one source file each time the
game changes (posters as `posters/name.jpg` file references rather than
inlined base64, so the repo stays reasonably sized).

## Running each version

**Web**: open `index.html` in a browser, or `python3 -m http.server` in
this directory and visit `http://localhost:8000`.

**Desktop (dev)**:
```
cd electron
npm install
npm start
```

**Desktop (build the exe yourself)**: `npm run dist` inside `electron/`
using [electron-builder](https://www.electron.build/). This needs to run
on Windows (or Linux with Wine) to produce a Windows binary — see CI notes
below for why this repo builds it on GitHub's Windows runners instead of
locally.

**Android (dev)**: needs Android Studio / the Android SDK installed.
```
cd android-app
npm install
npx cap sync android
npx cap open android
```
Then run from Android Studio, or `cd android/ && ./gradlew assembleDebug`
if you have the SDK on your PATH.

## CI builds (GitHub Actions)

This environment doesn't have the Android SDK or a Windows/Wine
toolchain available, and Google's SDK download servers are blocked by
this sandbox's network policy — so real binaries are produced by GitHub's
own hosted runners instead, which have full, unrestricted internet access:

- **`build-windows.yml`** — runs on `windows-latest`, installs deps, runs
  `electron-builder`, uploads the resulting `.exe` (NSIS installer +
  portable) as a workflow artifact.
- **`build-android.yml`** — runs on `ubuntu-latest`, installs the Android
  SDK via `android-actions/setup-android`, syncs the Capacitor project,
  and runs `./gradlew assembleDebug`, uploading the `.apk`.
- **`deploy-pages.yml`** — assembles the web build and deploys it to
  GitHub Pages.

All three trigger automatically on pushes that touch their respective
folders, or can be run on demand from the Actions tab
(`workflow_dispatch`). Built artifacts show up under that workflow run's
**Summary → Artifacts**, downloadable as a zip.

**One-time setup this repo's owner needs to do, once, in Settings:**
- **Pages**: Settings → Pages → Source → "GitHub Actions" (otherwise
  `deploy-pages.yml` has nothing to deploy to).
- **Actions permissions**: Settings → Actions → General → Workflow
  permissions should allow the Pages deployment (default settings work
  for this repo; only needed if permissions were previously locked down).

## Performance notes

An early build carried ~70 live point lights, which three.js's forward
renderer evaluates per-pixel on every lit surface — that alone dropped
frame rate to single digits in testing. The scene now renders fully unlit
(`MeshBasicMaterial` everywhere, mood from painted textures and floor
tinting instead of dynamic lights), and ceiling fixtures / obstacle props
(pillars, stalls, bars, benches) are batched into instanced meshes instead
of hundreds of individual draw calls. Net effect in the same test
environment: draw calls per frame 453 → 83, frame rate roughly doubled.
