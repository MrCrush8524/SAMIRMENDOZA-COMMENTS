# In Samir's Mind — Godot 4 Rebuild

This supersedes `../in-samirs-mind/` (the Three.js browser build). Per the
Godot rebuild packet, final targets are a native Windows EXE, a native
Android APK, and an iPhone/iPad Web export wrapped as a PWA — one shared
Godot 4 project, GDScript, not C#.

## Status (be exact about this — see CLAUDE_INSTRUCTIONS.md's reporting rule)

**Implemented and run-tested headlessly** (Godot 4.3 stable, Linux,
`--headless`, no GPU/display — see caveats below):
- Boot → Title (EN/ES/pt-BR selector, Continue gated on a valid save) →
  Character Select (Bobby/Luna/Mateo, real card art) → Begin Dream
- `CharacterBody3D` player: physics-rate WASD + mouse-look movement,
  gravity, sprint, an interact raycast, a slender 0.22m collision
  radius (a small cat/dog, not human-shouldered — see `Player.gd`'s
  `COLLIDER_RADIUS` doc comment for the passage-width contract this
  sets for level geometry)
- A screen-space POV paw overlay, correct art per selected dreamer,
  fading in as the camera pitches downward (25°–55°) rather than
  popping
- Chapter I proxy room (real wallpaper/texture/poster/signage art on
  box/plane geometry) with a spawn `Marker3D`
- Real backgroundless icon art on every pickup (journal, spirit orb,
  lint roller, moon pendant) with idle float/spin and proximity glow;
  two ambient "spirit sighting" encounters showing the two dreamers
  NOT currently played, chosen at random each run
- One journal fragment, one Memory Cat, one ordinary find (Lint
  Roller), one Dream Track pickup — SAVE FOR LATER / PLAY NOW correctly
  fades the main soundtrack out, pauses at its exact position, plays the
  track, and resumes from that position
- One manual TV (single clip) and one proximity-auto TV that cycles a
  3-clip playlist (Humeat hiring, Methalkezon, Beyond Outlets) once
  per trigger, ducking the main soundtrack for the whole break and
  resuming it only after the last clip — not fading in between clips
  (see **Video is not solved yet** below for what "TV" means right now)
- A Doubt glimpse (translucent black cat, timer-driven, never a chase)
- A Moon Door that only lights up once required discoveries are made
- Versioned `user://savegame_v1.json` save/load, including the
  player's **exact** last-safe position and yaw (captured by
  `SaveManager` at save time via `GameState.current_player`) — Continue
  restores you where you actually were, not just the chapter's default
  entrance. A corrupt/version-mismatched save, or one with a
  position that would drop the player through the floor or above the
  ceiling, is treated as no position (falls back to the chapter's named
  spawn marker) rather than trusted blindly.

**Statically verified only** (not yet run on a real device): touch
look/joystick input paths exist in `Player.gd` but have not been
exercised — there is no touch input to simulate headlessly.

**Not yet done — do not read anything above as covering these:**
- Windows EXE / Android APK / iPhone Web-PWA builds. No export
  templates are downloaded in this environment; exporting real
  binaries needs to be delegated to CI (GitHub Actions), the same way
  the previous Backrooms project's Windows/Android builds were —
  that's the next concrete step, not done yet.
- Chapters II–IV, Nightmare Passages, the full object/reward loop,
  Dream Resonance unlocks, Extras gallery, Settings screen.
- Quality-profile tuning has a skeleton (`QualityManager.gd`) but has
  not been measured against a real frame budget on any target.

## Video is not solved yet — a real engine limitation, not a placeholder bug

Stock Godot 4.3 ships **no video codec at all**. `VideoStreamTheora`
does not exist in this engine build (confirmed by dumping its actual
registered classes, not assumed), so the supplied `.mp4` files can't be
played through the built-in `VideoStreamPlayer` without a third-party
GDExtension — and no such extension has been vetted here for all three
export targets (Windows/Android native + Web).

Until that's integrated, `TVScreen.gd` plays the broadcast's real audio
track (extracted from the source `.mp4` via ffmpeg) and shows a still
frame on the screen mesh, with the same duck/resume behavior as before.
That's a genuine, working design for a background/diegetic broadcast —
not a stand-in for the mechanic — but it is not fullscreen video
playback. Revisit with a vetted video GDExtension before calling the TV
system feature-complete.

## Asset format notes

Godot 4 doesn't decode `.opus` natively either. Audio was transcoded to
Ogg Vorbis (long tracks) or WAV (short one-shots) via ffmpeg from the
same source files already verified against the packet's SHA-256
manifest — nothing was re-requested from Samir. `.webp` images import
natively and needed no conversion.

## Project layout

Matches `PROJECT_STRUCTURE.md` from the rebuild packet: `autoload/` for
the six singletons (`GameState`, `SaveManager`, `SceneLoader`,
`AudioManager`, `QualityManager`, `LocalizationManager`, plus `UiRoot`
for the persistent HUD layer), `scenes/{boot,menu,player,chapter01,
shared}/`, `assets/` (curated subset needed for the vertical slice —
same asset-scoping approach as the Three.js build).

## Running it

Needs a Godot 4.3 editor/binary. Open `project.godot`, or headless:

```
godot4 --headless --path . --import   # first run: import assets
godot4 --path .                        # normal run, needs a display
```
