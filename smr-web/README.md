# SMR — Stories Made Real (Web)

A fully client-side web version of SMR: React + Vite, no backend except a single serverless
function that proxies Claude API calls. Deploys as a static site to Cloudflare Pages or Netlify.

This is a sibling build to `../smr-android` (the native Android app), not a replacement --
see "How this differs from the Android build" below for what's genuinely different about the
web platform, not just reimplemented.

## Design

Same locked palette as the Android build: dark midnight base (`#0D1326`), pastel lavender
(`#AAA0D8`) / teal (`#76A9A4`), warm cream text (`#F4F4E8`), soft dim cobalt bloom behind the
book cover, hamburger drawer, minimal Now Playing controls. See `src/theme.css` for the tokens
and `src/components/CoverGlow.tsx` for the glow effect.

## What's implemented

- Library: import a plain-text (`.txt`) manuscript, stored locally in IndexedDB, never uploaded
- Now Playing: cover glow, mode chips (Read/Retell/Summary/Podcast), ±15s, speed, sleep timer,
  scrubber
- **Fully client-side Kokoro TTS** via [`kokoro-js`](https://www.npmjs.com/package/kokoro-js)
  (transformers.js + onnxruntime-web/WASM) -- no manual "download" step. The model fetches
  automatically the first time narration is needed and the browser caches it (Cache API), so
  every load after the first is instant. Uses the `q8` (int8) quantized weights, ~80-100MB
  instead of the ~320MB fp32 weights the Android build downloads.
- Claude API integration for Retell/Summary/Podcast, routed through `functions/api/claude.ts`
  so the API key never reaches the browser
- Automatic copyright-safe fallback cover art (canvas-generated, no third-party artwork)
- Media Session API integration for lock-screen/notification transport controls where the
  browser supports it

## How this differs from the Android build

Two things the Android app does that the web platform genuinely cannot:

- **Mixing with other apps' audio (Spotify, YouTube, etc.) at the OS level.** There is no
  browser API for this. Whatever the OS does by default when two audio sources play is what
  you get; a web page can't request "mix mode" the way `AudioFocusManager` does natively.
- **Guaranteed background/lock-screen playback.** Media Session gives you lock-screen controls
  while a tab is open, but mobile browsers can suspend JS when a tab loses focus or the screen
  locks -- there's no equivalent to a real Android foreground service. Keep the tab open and
  the screen on for uninterrupted narration.

Voice cloning is not implemented on web (same honesty as the Android build, which also ships
it as an intentional stub) -- there's no equivalent client-side library as mature as
`kokoro-js` for this yet.

## Local development

```bash
npm install
npm run dev
```

For the Claude proxy to work locally, run it through Wrangler instead of plain Vite:

```bash
npx wrangler pages dev -- npm run dev
```

Set your API key for local dev in a `.dev.vars` file (gitignored):

```
CLAUDE_API_KEY=sk-ant-...
```

## Deploy

### Cloudflare Pages

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the Cloudflare dashboard: Pages -> Create a project -> connect the repo, set the project
   root to `smr-web/`.
3. Build command: `npm run build`. Build output directory: `dist`.
4. Settings -> Environment variables -> add `CLAUDE_API_KEY` as a secret (not a plaintext var).
5. Deploy. `functions/api/claude.ts` is picked up automatically as a Pages Function.

Or via CLI:

```bash
npm run build
npx wrangler pages deploy dist --project-name smr-stories-made-real
wrangler pages secret put CLAUDE_API_KEY --project-name smr-stories-made-real
```

### Netlify

Netlify Functions use a different handler signature than Cloudflare Pages Functions, so
`functions/api/claude.ts` needs a small adaptation, not a straight copy:

1. Create `netlify/functions/claude.ts`.
2. Move the request-parsing and Anthropic `fetch` logic from `functions/api/claude.ts` in
   verbatim -- only the function signature changes, from `PagesFunction<Env>` /
   `context.request` / `context.env` to Netlify's `Handler` / `event.body` / `process.env`.
3. Add a `netlify.toml` with:
   ```toml
   [build]
     base = "smr-web"
     command = "npm run build"
     publish = "dist"
     functions = "netlify/functions"
   [[redirects]]
     from = "/api/claude"
     to = "/.netlify/functions/claude"
     status = 200
   ```
4. Set `CLAUDE_API_KEY` in Site settings -> Environment variables.

## Still to finish before calling it production

- Exact cross-chunk resume position after a page reload (currently resumes at the start of the
  manuscript's first narration chunk; the running elapsed time is tracked but not yet used to
  seek back to precisely where you left off)
- PDF/DOCX manuscript import (plain text only today)
- Real cover art search with license filtering (canvas-generated placeholder only today)
- Voice cloning (intentionally unimplemented, as on Android)
- Code-splitting the ~2.4MB JS bundle (transformers.js pulls in a fair amount; not urgent for
  a personal-use deployment, worth doing before wide distribution)
