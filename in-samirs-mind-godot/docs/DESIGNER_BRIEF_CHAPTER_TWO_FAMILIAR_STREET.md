# In Samir's Mind — Designer Brief: Chapter Two, "Familiar Street"

Chapter II currently exists in the engine as `InfiniteNeighborhood.tscn` —
a single open yard with four flat billboard "flavor zones" (Hub, Park Big,
Park Small, Gazebo, Field) and one house facade with two angles
(`HouseFacadeMain`, `HouseFacadeSide`). That was built to the old
one-room-per-chapter pattern. It does not match the new design brief you
gave for Chapter Two ("Familiar Street"): a real street of walkable
houses, each with a porch, a locked/unlocked interior, discoveries, and
side-level doors folded naturally into house interiors — the same jump in
ambition Chapter I just went through (one room → 13 connected rooms on a
real floor plan).

This doc is the asset ask for that rebuild. Same rules as every other
brief in this project (see `docs/DESIGNER_BRIEF_MAIN_CHAPTERS.md` for the
full house style): 1 unit = 1 meter, `chapter02_tex_*` / `chapter02_prop_*`
/ `chapter02_sign_*` naming, one asset per file, no contact sheets.

---

## 0. Texture delivery rules — new, learned the hard way on Chapter I

Chapter I's wall/floor rebuild shipped looking stretched, then "glitchy,"
then dirty, across three separate rounds of fixes. All three came from
the same root cause: the source art wasn't delivered as a clean, tileable
material — it was cropped out of full "reference sheet" mockups that
mixed several different asset types together. These rules exist so
Chapter Two's textures don't repeat that. **Every wall/floor texture for
Chapter Two must satisfy all four:**

1. **One material per file, full bleed, no sheet.** Don't deliver a
   contact-sheet/mockup image for me to crop from — deliver each material
   as its own file that's *nothing but* the tileable pattern, edge to
   edge. If a swatch has a label, caption, ruler, color chip, or a sliver
   of a neighboring material anywhere in the frame, it is not a clean
   delivery — I cannot crop it out without losing image resolution and
   re-introducing seams.
2. **Tileable materials vs. one-off murals are different asset types —
   say which one you're delivering.** A repeating wall/floor pattern
   (tile, wood, carpet) must actually tile (no unique focal detail that
   would look wrong repeated). A one-off illustrated wall (a specific
   door, a sink with personal clutter, a bulletin board with photos) is
   a **mural** — it gets placed once at its native aspect ratio, never
   tiled. Label the filename accordingly so it's unambiguous on my end:
   `chapter02_tex_*` for tileable materials, `chapter02_mural_*` for
   one-off illustrated walls.
3. **Floors need a clean variant, always.** Chapter I's entire floor set
   was stains/wet-footprints/grime by design, with no clean option, so
   there was nothing to tile without repeating the same dirt patch every
   half-meter. For Chapter Two: **every tileable floor texture needs a
   clean (unstained, dry, unmarked) version delivered alongside any
   distressed version.** Grime/wear is fine as a *separate* overlay or a
   deliberately-placed one-off decal — never baked permanently into the
   base tile itself.
4. **Tile scale**: design the tileable pattern assuming it repeats
   roughly every **0.4–0.6m** at in-game scale (a real bathroom/kitchen
   tile is 10–20cm; this is denser than the 8–12m rule used for the big
   open-world materials in `DESIGNER_BRIEF_MAIN_CHAPTERS.md` — that
   number is right for a football-field-sized outdoor zone, wrong for an
   indoor tiled wall or floor). Don't worry about matching this exactly;
   just don't design a pattern where a single tile occupies more than
   ~1m of wall, or it'll read as an oversized smeared block once tiled.

---

## 1. What's already built and reusable — free, no new art needed

**Textures** (`assets/textures/chapter02/`):
- `chapter02_tex_ground.png`, `chapter02_tex_park_grass.png` — street/yard
  ground cover.
- `chapter02_tex_house_facade_01.png`, `chapter02_tex_house_facade_02.png`
  — two house fronts already painted.
- `chapter02_tex_edge_wall.png`, `chapter02_tex_gazebo_plaza.png`,
  `chapter02_tex_nostalgia_field.png` — boundary and set-piece zones.

**Props** (`assets/props/chapter02/`) — all standalone transparent
sprites, already at the right style: `chapter02_prop_gazebo`,
`_swing_set`, `_park_bench`, `_bus_stop_bench`, `_stop_sign`,
`_hub_planter`, `_string_lights`, `_folding_chairs`, `_nostalgia_tv`,
`_house_door`, `_window_shutter_01/02/03`, and seven distinct ball props
(soccer, tennis, basketball, football, red rubber, beach — already
"wrong/off" variants like half-buried or deflated, useful for the
progressive-weirdness beats in your brief).

**Signage**: `chapter02_sign_twilight_station.png`.

**Systems, not art** — all reusable as-is, zero new code needed:
- `LevelDoor.gd` + `GameRoot.enter_side_level()` / `exit_side_level()` —
  the exact round-trip mechanism your brief wants for side-level doors
  embedded in houses. Just place a `LevelDoor` node inside whichever
  house/room you want a side level's door to live in.
- `Pickup.gd`'s Journal/MemoryCat/Item/DreamTrack kinds and the
  `REQUIRED_DISCOVERIES = 3` pattern from Chapter I — same shape fits
  your "3 House/Porch Discoveries" and "3 journal fragments" requirement
  directly; no new pickup type needed.
- `Chapter01.gd`'s 12-spot-pool → pick-3 spawn system — directly reusable
  for your "10–15 spots per item, pick 3 fresh" ask. Same
  `_roll_and_apply_spawn_pool()` helper works unmodified for Chapter Two;
  just needs its own `GameState.chapter02_*_spawns` arrays (code, not
  art).
- `MoonDoor.gd`'s asleep/awake pattern (toast + pulsing glow + one-time
  "just woke up" event) — reusable wholesale for any Chapter Two "the
  house noticed you" beat.
- `TVScreen.gd` + the existing video-still/audio pairs — reusable for any
  TV inside a house; only new broadcast content (see §3) is a new ask,
  not new code.
- Chapter III's house-interior textures (`chapter03_tex_kitchen_tile`,
  `_living_rug`, `_child_wallpaper`, `_attic_wall`, `_attic_floor`,
  `_foyer_floor`) are a different house (Samir's childhood home, a later
  chapter) but are visually close enough in style that they can serve as
  **stand-in interior dressing for 1–2 of the Chapter Two houses** if you
  want to start blocking out interiors before new textures land — flag
  which houses use stand-ins vs. final art so I don't ship them mixed up
  by accident.
- `assets/spirits/luna_spirit_wrapper.png` — unused elsewhere, available
  if any Chapter Two ghost/ambient-figure beat wants a ready-made sprite
  instead of a new one.
- `assets/doubt/doubt_spirit.png` — the actual Doubt mechanic sprite,
  already wired everywhere; reuse directly for Chapter Two's Doubt
  glimpses, no new art.

## 2. What's genuinely missing — the actual ask

### 2a. House exteriors
The street needs to read as a *street* (multiple distinct homes), not one
house shown from two angles. Ask:
- **3 more house facade textures** (`chapter02_tex_house_facade_03/04/05`),
  each a distinct architectural style/color so the four-plus houses on
  the street don't look copy-pasted. Same size/format as `_facade_01`
  (check its resolution and match it exactly).
- **1 "impossible property" facade variant**
  (`chapter02_tex_house_facade_impossible`) — per your brief's escalating
  spatial-weirdness beat: a house front that's subtly wrong (a window
  where a door should be, proportions slightly too tall, siding pattern
  that doesn't quite repeat correctly). Same base dimensions as a normal
  facade so it drops into the same wall geometry.

### 2b. Porch objects (small transparent sprite props, same treatment as existing ball/prop set)
For the "3 required House/Porch Discoveries" beat — objects sitting on a
porch/stoop that read as intimate, lived-in, slightly off:
- `chapter02_prop_old_shoes` — a worn pair left by a door.
- `chapter02_prop_wind_chime` — hanging, porch-ceiling mount.
- `chapter02_prop_unopened_mail` — a small stack/bundle on a mat or rail.
- Any others you want to suggest for texture — these three are the
  minimum named in the brief, more variety only helps the 10–15-spot pool
  read as natural rather than repeated.

### 2c. House interiors
Each explorable house needs its own interior identity so they don't feel
like reskins. Minimum ask per house (times however many houses get full
interiors — recommend starting with 3):
- 1 wall texture, 1 floor texture, distinct per house
  (`chapter02_tex_house<N>_wall`, `chapter02_tex_house<N>_floor`).
- **Floor must have a clean variant** — see §0.3. A lived-in house can
  still have personality in its floor (a rug pattern, real wood grain)
  without it being visibly dirty; save actual grime for a one-off decal
  prop, not the base tile.
- Style: same photoreal pastel-dreamcore treatment as Chapter I's
  laundromat set (soft AI-photoreal, not flat cartoon) — reference
  `assets/textures/chapter01/*` for the exact finish and grain level.
- Deliver per §0: one clean tileable file per material, full bleed, no
  labels/sheet/neighbor bleed, designed to repeat every ~0.4–0.6m.

### 2d. Street-specific "wrong" prop
Your brief's spatial-weirdness escalation wants a specific "wrong
photograph" beat unique to the street (distinct from Chapter I's
polaroid/photo pickups). Ask: `chapter02_prop_wrong_photograph` — a framed
or loose photo texture where something in the image is subtly incorrect
(a missing person, a house that isn't on the street, a sky that doesn't
match). Transparent sprite, same treatment as the existing polaroid icon
in `assets/pool_garden/icons/polaroid.png` for scale reference.

### 2e. TV broadcast content (only if new footage wanted)
The TV *system* is free (§1), but if you want Chapter-Two-specific
broadcast material distinct from the existing Chapter I commercials
(`Cloudside_Shampoo_commercial`, `humeat_hiring`, `methalkezon`,
`beyond_outlets`), that's new content: a short looping video-still image
+ matching audio track per broadcast, same pairing pattern as those four.
Not required to ship Chapter Two — existing TV content can be reused
as-is if you'd rather save the budget here.

### 2f. Ghost/ambient encounter sprite (only if distinct from Doubt)
Your brief describes ghost encounters as part of Chapter Two's
progression. If these should look different from the Doubt spirit
(`doubt_spirit.png`) or the unused Luna wrapper, that's a new sprite ask:
`chapter02_prop_ghost_figure`. If reusing Doubt or Luna is fine
thematically, skip this — flag your preference either way.

## 3. Priority order if art has to land in batches

1. §2a house facades (3 new + 1 impossible variant) — nothing else reads
   as "a street" without this.
2. §2b porch objects (3 sprites) — cheapest ask, unlocks the
   House/Porch Discovery beats immediately.
3. §2c interiors for the first 3 houses — biggest lift, can be staged
   incrementally (I can block out geometry with Chapter III's stand-ins
   the moment you say go, and hot-swap real textures in per-house as they
   land).
4. §2d wrong-photograph prop.
5. §2e/§2f — only if you want bespoke content over reuse; otherwise skip.

## 4. What I need from you to start building now, art or no art

Nothing — I can start Chapter Two's room/street layout and door-and-item
wiring today using Chapter III's stand-in textures for interiors and the
existing §1 asset set for the street itself, then hot-swap in real art as
it lands per the priority order above. Say the word and I'll begin the
layout pass; or if you'd rather art land first so nothing gets built
twice, that's a completely reasonable call too — just say which.
