# IN SAMIR'S MIND — GODOT 4 REBUILD MASTER PLAN

## Final deliverables
1. Windows PC native app (`InSamirsMind.exe`)
2. Android native local app (`InSamirsMind.apk`)
3. iPhone/iPad Godot Web export packaged as a PWA that can be added to the Home Screen

This plan supersedes the previous Three.js/browser-first approach.

## Core technology
Use:
- Godot 4.x stable
- GDScript, not C#
- Compatibility renderer as the common baseline
- one shared project
- platform-specific export presets and quality profiles

Do not port the old Three.js runtime or preserve its broken startup/save/menu architecture.

## Why Godot
The goal is a real local app on Windows and Android, while still keeping an iOS web-app path. Windows and Android should run natively, without a browser. iOS should use Godot's Web export and a PWA wrapper.

## Final Windows build
Deliver a normal local Windows release:
- `InSamirsMind.exe`
- embedded or adjacent `.pck`
- x86_64
- windowed/fullscreen settings
- mouse/keyboard controls
- local saves
- local audio/video
- no Cloudflare/YouTube dependency required to play

## Final Android build
Deliver:
- signed or locally installable `InSamirsMind.apk`
- ARM64 primary target
- touch controls
- local saves
- local audio/video
- background/pause handling
- optional AAB preset retained for future Play Store release

## Final iOS web app
This first iOS release is NOT a native App Store build.

Create:
- Godot Web export
- single-threaded web export unless testing proves otherwise
- PWA manifest
- service worker
- Apple touch icons
- standalone display mode
- safe-area support
- touch controls
- HTTPS hosting
- offline-after-first-cache behavior

Host with Cloudflare Pages, with R2 only if useful for large assets.

## One game, three targets
Do not fork three separate games. Share gameplay, scenes, quests, audio logic, save schema, and assets.

Platform differences should be limited to:
- quality profile
- touch UI
- browser media restrictions
- fullscreen behavior
- safe-area layout
- asset streaming/caching
- platform save implementation details

## Clean startup state machine
Build this from zero:

BOOT
→ TITLE

TITLE:
- New Dream
- Continue only if a valid save exists
- Settings
- Extras
- Language

New Dream:
TITLE
→ CHARACTER SELECT
→ BEGIN DREAM
→ CHAPTER I

Continue:
TITLE
→ validate save
→ load saved chapter
→ restore safe spawn

Character select contains ONLY:
- Bobby
- Luna
- Mateo
- Begin Dream
- Back

There is no Continue button on character select.

## Characters
Bobby:
- He/Him
- polydactyl Siamese/colorpoint cat
- use supplied real references
- short sleek cream/taupe body
- slate-gray points
- broad polydactyl front paws
- feline first-person paws
- gentle, observant, loyal

Luna:
- She/Her
- Chihuahua–Terrier mix
- DOG
- use supplied real references
- small, scruffy tan/light coat
- canine paws
- brave, feisty, intensely loving, personality bigger than her body

Mateo:
- He/Him
- Bengal/tabby-marked cat based on supplied references
- feline paws
- sweet, cautious, scaredy-cat, likes hiding

Use lightweight stylized-realistic first-person paws/forelimbs first. Do not waste the vertical slice budget on expensive full photoreal animal bodies.

## Scene loading
Each chapter must be its own `.tscn`.

Load one chapter at a time:
- current scene loaded
- next scene preloaded only near transition if needed
- previous chapter freed after transition
- Nightmare spaces separate scenes
- no all-chapters-at-startup behavior

Suggested scenes:
- Chapter01_MemoryAtrium.tscn
- Chapter02_FamiliarStreet.tscn
- Chapter03_HouseThatKnowsYou.tscn
- Chapter04_AboveTheStreet.tscn
- Nightmare_Decay.tscn
- Nightmare_Wander.tscn
- Nightmare_Arcade.tscn

Use explicit `Marker3D` spawn points.

## Player
Use `CharacterBody3D`.

Requirements:
- stable floor detection
- capsule collider
- fixed eye height
- gravity
- mouse look
- touch look
- sprint/stamina
- physics independent of rendering frame rate
- spawn validation
- fallback spawn if save coordinates are invalid

Desktop:
- WASD
- mouse
- E/click interact
- Shift sprint
- Escape pause

Mobile:
- left joystick movement
- right drag look
- large interact button
- inventory button
- pause button

## Performance architecture
Do not optimize after the fact.

Use:
- modular geometry
- MultiMesh for repeated washers/dryers/lamps/etc.
- baked lightmaps
- simple collision meshes
- occlusion/manual room culling
- LOD
- limited dynamic lights
- conservative particles/transparency
- texture atlases where useful
- streamed long audio
- load video only when needed

Do not use giant stretched photographs as wall materials.

## Quality profiles
DESKTOP_HIGH:
- 100% render scale
- higher shadow distance
- higher LOD distances
- more decoration
- optional light post-processing

DESKTOP_LOW:
- modest render-scale reduction
- lower shadow/effect density

ANDROID:
- target ~30 FPS
- reduced dynamic lights/shadows/particles
- keep close-range image sharp
- no permanent potato resolution

IOS_WEB:
- target ~30 FPS
- conservative memory use
- single-threaded Web export
- minimal expensive post
- practical AA
- modest dynamic resolution only when needed

## Chapter I — Memory Atrium
Pastel late-70s/early-80s laundromat dream.

Required:
- 3 Memory Cats
- 3 Journal Fragments
- Moon Door progression
- Doubt spectral black cat
- found objects
- Dream Tracks
- TVs/commercials
- optional rooms
- service spaces/courtyard

Journal text:
1. “This place feels so familiar, even though you've never been here.”
2. “It feels just like home. The street does. The windows do. Even the silence does.”
3. “But is this house yours?”

Collectibles randomize only among validated reachable positions.

## Chapter II — Familiar Street
- explorable pastel residential street
- real multi-room houses
- visible door-opening animation
- 3 porch/house discoveries
- 3 journal fragments
- optional spaces
- hidden staircase/under-level
- Nightmare door betrayals

## Chapter III — House That Knows You
- increasingly impossible domestic architecture
- 3 room checks
- 3 journal fragments
- back-exit progression
- TVs/PSAs

Journal text:
1. “The windows seem higher than they were a minute ago.”
2. “Every time you look outside, the ground is a little farther away.”
3. “When you finally leave this house, don't expect the street to still be there.”

## Chapter IV — Above the Street
- reconstruct/remember door
- fluorescent path
- impossible window
- cistern
- black door
- tunnel
- swing/threshold
- central light
- completion save

## Nightmare Passages
Three types:

Decay:
- dangerous
- composure drains
- rot/corrosion/fluorescent instability

Wander:
- mostly exploratory
- long corridors/wrong rooms/distant movement

Arcade:
- dangerous/playful
- fake 1980s cabinets
- deceptive instructions
- randomized machine layout possible

Nightmare entry must remember exact return location.

## Finds / gifts / objects
Use the supplied object set:
- Lint Roller
- Cat Collar
- Laundry Token
- Lost Sock
- Detergent Cap
- Bent Key
- Polaroid
- Receipt
- Tiny Bell
- Empty Cassette

Reward twice:
1. finding the object
2. discovering its use

Correct use can award Dream Resonance / Memory Use and unlock:
- menu backgrounds
- character art
- hidden journal pages
- Dream Tracks
- sky palettes
- paw cosmetics
- Extras gallery items

## Dream Tracks
Use the 10 supplied tracks.

On discovery:
“You found a tune.”

Choices:
- PLAY NOW
- SAVE FOR LATER

Both unlock permanently.

PLAY NOW:
- fade main soundtrack
- pause exact position
- play found track
- restore main soundtrack at previous position
- fade back in

## Audio buses
Create:
- Master
- Music
- DreamTrack
- Ambience
- Voice
- SFX
- Footsteps
- TV

Use supplied:
- menu music
- long main soundtrack
- 10 Dream Tracks
- voice stems
- footsteps
- nightmare SFX
- ambience
- UI sounds

## TV/video system
Use supplied final videos, including:
- Bellamy Drink Mix kids-dialogue commercial
- Do Not Nap PSA
- Nightmare Vacuum
- Dream Guide
- Cloudside
- other supplied broadcasts

Each Dream TV needs:
- video asset ID
- autoplay-on-proximity toggle
- trigger radius
- replayable toggle
- played-this-session state
- TV audio volume
- placement ID

On trigger:
- TV video starts
- main music ducks/pauses
- TV audio fades in
- restore music smoothly after playback

Some TVs autoplay by proximity, others require interaction.

For iOS Web, ensure the first user gesture unlocks audio/video behavior.

## Posters / billboards / wallpapers
Use the supplied:
- Bellamy
- Kellerman
- Door Temperature
- Vanderhall
- Sunspot
- Cloudside
- Nightmare Vacuum
- Do Not Nap
- additional PSA art
- wallpaper/texture sheets

Environment wall treatment:
- tile
- plaster
- painted concrete
- wallpaper
- paneling
- terrazzo
- carpet
- wood

Layer posters/signage/decals instead of stretching photographic rooms across walls.

## Save system
Use a versioned Godot save schema.

Recommended native save:
`user://savegame_v1.json`

Save:
- version
- run ID
- selected character
- chapter
- named spawn ID
- safe player transform
- journals
- Memory Cats
- inventory
- object-use state
- Dream Tracks
- Dream Resonance
- nightmare assignments
- chapter progression
- final-door progress
- permanent extras
- settings

New Dream creates a fresh run.

Continue only appears if save validates.

Never load incompatible raw coordinates blindly.

## Offline behavior
Windows:
- fully local

Android:
- fully local after APK installation

iOS PWA:
- offline after first successful install/cache
- cache Web shell, WASM/PCK/data, icons, and essential media
- first load requires download
- optional heavy media can use a “Preparing Dream…” cache step

## Export presets
Create presets for:

Windows:
- x86_64 release
- `InSamirsMind.exe`

Android:
- local APK
- ARM64 release
- package ID such as `com.samirmendoza.insamirsmind`

Optional Android:
- AAB for future Play Store

Web:
- iOS Web PWA
- single-threaded
- Compatibility renderer
- release build

Do not store signing secrets in the repo.

## iOS PWA wrapper
Include:
- `manifest.webmanifest`
- service worker
- Apple touch icons
- `display: standalone`
- HTTPS
- safe-area CSS
- no browser scrolling during gameplay
- touch controls
- orientation handling

Use:
- `env(safe-area-inset-top)`
- `env(safe-area-inset-bottom)`
- `env(safe-area-inset-left)`
- `env(safe-area-inset-right)`

## Vertical slice FIRST
Before building all chapters, prove:

Title
→ New Dream
→ Bobby/Luna/Mateo selector
→ Begin Dream
→ Chapter I mini area
→ smooth movement
→ one journal
→ one Memory Cat
→ one ordinary find
→ one Dream Track
→ one manual TV
→ one proximity/autoplay TV
→ one ghost/Doubt event
→ one transition door
→ save
→ quit
→ Continue
→ correct restore

Export and test this slice on:
1. Windows EXE
2. Android APK
3. iPhone Safari/PWA

Only then expand Chapter I.

## Acceptance gates
Windows:
- responsive
- no startup/menu race
- no floor spawn
- stable save/load
- target smooth 60-ish FPS on reasonable hardware

Android:
- target stable ~30 FPS
- responsive touch
- no constant jagged low-resolution image
- no major frame spikes

iPhone Web/PWA:
- target ~30 FPS on a modern supported device
- clean edges
- no page scrolling during play
- audio starts after gesture
- TV video works
- save persists after reopening
- memory controlled

## Build order
Phase 0 — project/repo/import/export setup
Phase 1 — boot/title/settings/character selector
Phase 2 — player controller + desktop/touch input
Phase 3 — Chapter I vertical-slice room
Phase 4 — audio manager
Phase 5 — journal/Memory Cat/inventory/find system
Phase 6 — Dream Track system
Phase 7 — TV/video system
Phase 8 — save/load
Phase 9 — export/test all three targets
Phase 10 — full Chapter I
Phase 11 — Familiar Street + stairs + Nightmares
Phase 12 — House That Knows You
Phase 13 — Above the Street
Phase 14 — polish/localization/accessibility/deployment

## What Claude already has
The four previously supplied asset ZIPs contain:
- character references/cards
- final videos
- posters/ads
- menu/main music
- Dream Tracks
- voice stems
- footsteps
- nightmare SFX
- ambience
- UI audio
- environment references
- wallpapers/textures
- UI references

Inspect them before asking Samir to resend anything.

## Source-of-truth technical change
OLD:
Three.js/browser-first.

NEW:
Godot 4 + GDScript → Windows EXE + Android APK + iOS Web/PWA.

Cloudflare is only the hosting/delivery layer for the iOS Web/PWA path and optional web assets. It is not the runtime for Windows or Android.
