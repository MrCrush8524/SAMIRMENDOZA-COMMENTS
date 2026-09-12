# In Samir's Mind — Master Designer Asset Brief

This is the single, consolidated brief covering every piece of art
currently missing from the build, in priority order. It merges three
things that were previously separate documents into one:

1. **Part A — Main Story Chapters II–V + the Lost Passage.** The
   biggest gap in the game: these chapters are fully built and playable
   right now, but every surface in them is still flat engine color.
2. **Part B — Profile Screen, Pause Menu, Mirrors.** Three systems that
   shipped in code this build (save profiles, mid-run character
   swapping, reflective mirrors) and are wearing placeholder art, or in
   the mirror's case, actively misusing existing art in a way that
   looks broken until new pieces land.
3. **Part C — Remaining flat-color rooms in the six side levels, and
   one placement question.** Smaller leftovers from earlier delivery
   waves — real texture coverage everywhere a matching asset existed,
   flat color everywhere one didn't.

Everything below is pulled directly from the live scene files — exact
measurements, hex colors, room names, and pixel dimensions — not a
redrawn concept. Build to these numbers and it drops in with zero
guesswork on my end. Chapter I already has real art and is the visual
bar every part of this brief is trying to match.

## How to use this document

Read the **Overall priority order** section at the very end first if
you want a single sequencing plan across all three parts. Otherwise,
each part is self-contained and can be worked independently — Part A is
the most valuable use of time, Part B is the most self-contained/
fastest to finish, Part C is pure polish.

---

# PART A — Main Story Chapters (II–V) + the Lost Passage

## Units, scale, and how to read this part

- **1 game unit = 1 meter.** A "12 × 10 room" is 12 meters wide by 10
  meters deep. Player eye height is ~1.6m; a doorway reads right at
  ~2.1–2.3m tall.
- **"Footprint"** is the horizontal floor plate size (width × depth) as a
  flat rectangle — every room in these chapters is currently a simple
  rectangular floor patch, no non-rectangular geometry, so texture the
  floor as a straightforward tileable square/rectangle.
- **"Wall height"** is the exterior boundary wall height for that chapter
  (a straight vertical plane), not a per-room ceiling — none of these
  levels have ceilings modeled yet (all interiors are open-top, matching
  the pattern already used in the finished six side levels).
- **"Ambient tint"** is the WorldEnvironment's ambient light color already
  baked into the scene — design your albedo colors assuming that tint is
  washing over them, the same way real materials read differently under
  warm vs. cool light. I've given the hex both for the tint and for the
  current placeholder color so you can match the intended mood exactly or
  deliberately push against it.
- **Texture tiling**: for opaque floor/wall materials, design assuming a
  2048px (or 1024px for smaller zones) tileable square repeats roughly
  every 8–12 meters at in-game scale — that's the density I've used
  everywhere else in the build (Mall, Terminal, Museum, etc.) so a new
  texture matches the existing tile-read of the game. I'll set the exact
  UV repeat count per zone on my end once the texture lands; you don't
  need to hit an exact number, just design it as a repeatable square that
  doesn't look obviously seamed at that density.
- **Deliverable naming**: follow the exact convention already used for
  every other packet — `chapterXX_tex_<name>.png` for opaque tileable
  materials, `chapterXX_prop_<name>.png` for standalone transparent props,
  `chapterXX_sign_<name>.png` for standalone transparent signage. Use
  `backrooms_` as the prefix for the Lost Passage. One asset = one file,
  no collage/contact-sheet/catalog boards — same non-negotiable rule as
  every previous delivery.
- **Signage text**: where a room has an established in-engine flavor line
  (the text that pops up when the player stands in that zone), I've quoted
  it exactly. If you're making a physical sign/plaque for that room, the
  wording on it should either use or clearly riff on that exact line so
  the environmental text and the prop don't contradict each other.

---

## CHAPTER II — The Infinite Neighborhood

A dusty-pastel liminal suburb, entirely outdoors, no ceiling. One big
walkable plate, five named zones arranged in a cross around a central hub,
enclosed by a tall perimeter wall standing in for "the edge of the dream"
rather than a literal building.

**Whole-level footprint**: 70m × 60m (X × Z), enclosed by a perimeter wall
5m tall running the full 70m length on north/south and full 60m length on
east/west. Current wall placeholder: `#EBE6E0` (near-white cream). This
perimeter wall is the one texture that needs to read as "the sky/edge of
the neighborhood," not a real building — think a soft matte boundary,
not brick.

**Floor (whole level, the sidewalk/street connecting the zones)**:
70m × 60m plate. Current placeholder: `#DBD6CC` (warm dove-gray). This is
the base ground plane — treat it as cracked suburban sidewalk/asphalt in
a dusty pastel palette, not clean concrete.

Ambient light tint for the whole level: `#EBE0D9`-ish warm-neutral wash,
energy 1.1 (soft, slightly warm daylight, not harsh).

### Zone: The Hub of Quiet
- Footprint: 10m × 10m, centered at the middle of the map.
- Placeholder color: `#F2CC9E` (warm dusty apricot).
- Lighting: one warm point light overhead, color `#FFEBD1`, soft.
- Flavor line: *"The Hub of Quiet."*
- Notes: this is the crossroads everything else radiates from — the
  player's first stop after entering the chapter and returning to often.
  Needs to feel like a quiet intersection: a dead traffic circle, a
  central planter, or a paved roundabout with nowhere it's actually
  taking anyone.
- Suggested props (standalone transparent PNGs, scattered by me):
  a dead/frozen traffic light or stop sign, a low central planter or
  fountain-shaped centerpiece (non-functional), a bus stop bench facing
  nothing.

### Zone: The Park of Forgotten Balls (big)
- Footprint: 18m × 16m, west side of the map (offset −20m on X, +10m on Z
  from center).
- Placeholder color: `#B8D9AD` (muted sage green).
- Flavor line: *"The Park of Forgotten Balls."*
- Notes: a grass lawn/park texture, worn and patchy rather than lush.
  Needs ball props scattered on the ground — this is the room's entire
  identity, so lean into it: 4–6 distinct sports/toy balls in different
  states of decay (a flat basketball, a faded beach ball, a soccer ball
  half-buried, a tennis ball). Also wants at least one park bench and a
  swing-set or jungle-gym silhouette, ideally slightly wrong-scaled or
  underused-looking.

### Zone: The Park of Forgotten Balls (small, repeated)
- Footprint: 14m × 10m, north side of map (0m on X, −18m on Z).
- Placeholder color: `#CCE6C7` (paler sage than the big park).
- Flavor line: *"The Park of Forgotten Balls. Again? Twilight Station.
  Memory Lane Stop."*
- Notes: **this repetition is deliberate** — the map itself names a
  second, smaller version of the same park as a dream-repetition motif.
  Texture and dress it as a clear smaller/paler echo of the big park
  above (same grass family, same ball props reused sparser, maybe 2–3
  balls instead of 5), not a different park. The flavor text also
  name-drops "Twilight Station" and "Memory Lane Stop" — if you want to
  add a single small transit-sign prop here referencing either name,
  that would sell the "wrong place recurring" feeling well.

### Zone: The Gazebo Plaza
- Footprint: 18m × 16m, east side of map (+20m on X, +10m on Z).
- Placeholder color: `#EBBFCC` (dusty rose-pink).
- Lighting: one warm-pink point light overhead, color `#FFD9E6`.
- Flavor line: *"The Gazebo Plaza."*
- Notes: a paved plaza texture (pavers/brick-pattern, pink-toned) with a
  literal gazebo structure as the centerpiece prop — a hexagonal or
  octagonal roofed pavilion, pastel-painted wood, the kind you'd see at
  the center of a small-town square. This is the single most important
  prop in the whole chapter since the zone is named directly after it.
  Secondary props: string lights or paper lanterns, a scattering of
  folding chairs as if an event almost happened here.

### Zone: Nostalgia Field
- Footprint: 16m × 10m, south side of map (0m on X, +20m on Z).
- Placeholder color: `#E0CCAD` (dry wheat-tan).
- Flavor line: *"Nostalgia Field. Void of missing context."*
- Notes: an open dry-grass/wheat field texture, closer to a vacant lot
  than a maintained lawn — the "void of missing context" line wants this
  to feel emptier and less legible than the parks, like a photograph with
  the subject cropped out. Minimal or no props here on purpose; if
  anything, one single out-of-place object (an old TV, a folding chair
  facing away from the player, a single mailbox with no house behind it)
  reads better than dressing it fully.

### Unbuilt but needed: house facades + the locked/waking house
There's a single interactive door object already built (the "one house
that wakes up" story beat once the player finds all four zones above),
currently a bare 1.3m × 2.3m door slab with no house behind it. **This
needs actual house geometry, which is on me to build once art exists** —
what I need from you is:
- A tileable suburban house-facade texture (siding/stucco/brick, pastel,
  1970s–80s tract-home style) — one or two variants so the street doesn't
  read as one repeated building.
- A standalone door prop (`chapter02_prop_house_door.png`) distinct from
  every other door already delivered elsewhere in the game — this door
  specifically needs to look ordinary and unremarkable until it "wakes
  up," so keep it modest, not magical-looking.
- Optional: 2–3 window/shutter prop variants to dress the facades once I
  build them.

---

## CHAPTER III — House That Knows You

A three-story house, each floor a separate flat plate stacked directly
above the one below (Ground at y=0, Second Floor at y=4m, Attic at y=8m),
connected by teleport-style "lift" pads standing in for stairs — the
player never sees a literal staircase, just steps onto a glowing pad and
arrives on the next floor. Same 44m × 40m footprint on all three floors,
same wall height (~4m) on all three.

Ambient tint: soft warm-neutral, `#E6DBD9`-ish, energy 1.0 — a hair
cooler and dimmer than Chapter II, appropriately "indoors."

### Ground Floor (44m × 40m plate, walls 4m tall)
- Floor material placeholder: `#D9C7B3` (warm taupe).
- Wall material placeholder: `#EDE6DE` (soft off-white), shared by all
  three floors.

**Entry Foyer**
- Footprint: 10m × 8m.
- Placeholder: `#E6C7D1` (dusty pink).
- Lighting: warm point light, `#FFEBE0`.
- Flavor line: *"Entry Foyer. 'Places remember you too.'"*
- This is the room the player always lands in first (both fresh entry and
  respawn point). Wants a genuine entryway feel: welcome mat, coat hooks,
  a console table, maybe a single family photo turned face-down.

**Living Room**
- Footprint: 12m × 10m.
- Placeholder: `#EBCCD6` (slightly warmer pink than the foyer).
- Flavor line: *"Living Room."*
- Standard domestic living room dressing: a sofa, a coffee table, a
  television or fireplace as focal point, a rug.

**Kitchen & Dining Nook**
- Footprint: 12m × 10m.
- Placeholder: `#BFD9C7` (soft mint-green).
- Flavor line: *"Kitchen & Dining Nook. The Looping Corridor is nearby —
  does it end?"* — the "looping corridor" is flavor text only right now
  (no literal corridor geometry exists), so no art is needed for that
  specifically, but a hallway-adjacent visual cue (a corridor stretching
  off past the kitchen that the player can't actually walk down) would be
  a nice touch if you want to design one as background dressing.
- Kitchen textures: cabinetry, countertop, tile backsplash. Props: a
  dining table with mismatched chairs, an old refrigerator, hanging pans.

**Inner Courtyard**
- Footprint: 12m × 10m.
- Placeholder: `#B3D9F2` (pale sky blue) — this is the brightest, coolest
  room on the floor by design.
- Lighting: bright cool point light, `#F2FAFF`, the strongest light
  fixture on Ground Floor.
- Flavor line: *"Inner Courtyard. Open to sky."*
- This room is meant to read as an open-air interior garden, even though
  there's no literal hole in the ceiling mesh — use paving-stone floor
  texture, potted plants, maybe a small non-functional fountain, and
  treat the walls here differently from the rest of the house (climbing
  ivy, exposed brick, weathered stone) since it's nominally "outdoors
  indoors."

**Sunroom**
- Footprint: 10m × 8m, far corner of the floor.
- Placeholder: `#CCE0E6` (pale glass-blue).
- Flavor line: *"Sunroom."*
- Glass-heavy, plant-heavy room — wicker furniture, hanging plants,
  sun-bleached upholstery.

### Second Floor (44m × 40m plate at y=4m, walls 4m tall)
Same wall material as Ground Floor (`#EDE6DE`).

**Mirror Hall**
- Footprint: 12m × 10m.
- Placeholder: `#BFCCD9` (cool pale blue-gray), roughness notably lower
  than other rooms (0.2 vs 0.5–0.7 elsewhere) — **this room is meant to
  look reflective/glossy**, so if you're making a floor texture for it,
  bias toward a polished, mirror-like surface rather than a matte one.
- Flavor line: *"Mirror Hall."*
- **This room now has two real, functional reflective mirrors built into
  it in code** (see Part B's Mirror section below for the exact prop
  specs those need — frame art and reflection-body cutouts). Floor/wall
  texture here is still an independent, separate ask from the mirror
  props themselves.

**Child's Room**
- Footprint: 12m × 10m.
- Placeholder: `#F2CCD9` (soft pink, slightly more saturated than the
  Foyer's).
- Flavor line: *"Child's Room."*
- A child's bedroom, but treat it with the same "outgrown/uncanny"
  restraint as the rest of the game — a twin bed, a toy chest, wallpaper
  with a repeating pattern (stars, animals), maybe one toy positioned as
  if recently played with despite the room's dormant feeling.

**Memory Room**
- Footprint: 12m × 10m.
- Placeholder: `#D9C7A6` (warm sepia-tan) — the warmest, most amber-toned
  room on this floor.
- Lighting: warm amber point light, `#F2E0BF`.
- Flavor line: *"Memory Room."*
- This should read as a room made of nostalgia/keepsakes: photo albums,
  a record player, boxes of memorabilia, framed photographs (blank or
  turned away is fine — I can layer in specific pickup art separately).

**Sitting Room**
- Footprint: 12m × 10m.
- Placeholder: `#EBD9AD` (warm butter-yellow).
- Flavor line: *"Sitting Room."*
- A formal parlor-style room: armchairs, a side table, maybe a
  grandfather clock or reading lamp.

**Upper Landing** (flavor-only zone, no dedicated floor patch — it's the
lift-pad area at the top of the ground-floor stairs)
- Flavor line: *"Upper Landing. You've been here before."*
- No dedicated texture needed beyond the shared Second Floor
  floor/wall materials; a single small prop or piece of signage
  reinforcing "you've been here before" (a framed photo of this exact
  spot, say) would be a nice optional touch.

### Attic (44m × 40m plate at y=8m, walls 4m tall)
- Floor material placeholder: `#8C7A73` (dusty warm brown), noticeably
  darker/rougher than the two floors below (roughness 0.9) — an
  unfinished space, exposed and dusty.
- Wall material: same `#EDE6DE` shared family, but consider a rougher/
  unfinished variant here since the flavor text calls it out explicitly.

**Attic (main zone)**
- Footprint: 12m × 10m.
- Placeholder: `#998C80` (muted taupe-brown).
- Flavor line: *"Attic (unfinished)."*
- Exposed rafters, boxes, dust sheets over furniture, a single bare
  hanging bulb — the least "decorated" room in the house on purpose.

**Duplicate Corridor**
- Footprint: 12m × 10m.
- Placeholder: `#B399B3` (dusty mauve) — deliberately close in tone to
  the Mirror Hall two floors down, reinforcing the "duplicate" naming.
- Flavor line: *"Duplicate Corridor (slightly different)."*
- Wants to visually rhyme with an earlier room in the house (the Mirror
  Hall is the obvious candidate given the palette) while reading as
  subtly wrong — same furniture placed slightly differently, same
  wallpaper in a slightly different color, that kind of thing.

**View (to Courtyard Below)**
- Footprint: 12m × 10m.
- Placeholder: `#A6B8C7` (cool slate-blue).
- Flavor line: *"View to Courtyard Below. The roof remembers a different
  sky."*
- This is also where the Roof Hatch (the door into Chapter IV) physically
  sits, so this room is the emotional hinge between III and IV — wants a
  window or open gap looking down toward where the Courtyard would be,
  and framing that suggests looking up/out toward Chapter IV's rooftops.
  A skylight or window treatment with a strange sky visible through it
  would tie the two chapters together well.

### Lift pads (all three floors)
Four glowing floor pads connect the tiers (Ground↔Second, Second↔Attic).
Current placeholder: solid warm-tan `#998055`, no texture. These stand in
for staircases the player never sees literally — if you want to give them
a decorative texture (worn rug, glowing rune circle, anything that reads
as "the safe way up"), send it as `chapter03_tex_liftpad.png`; otherwise
they're low priority since they already read fine as glowing markers.

### Roof Hatch (III → IV connector)
- A 1.4m × 1.4m hatch prop, in the View room, currently untextured. This
  is the literal door into Chapter IV — needs to look like a hatch into
  an open sky, distinct from every other door in the game
  (`chapter03_prop_roof_hatch.png` or similar).

---

## CHAPTER IV — Above the Street

Three rooftop tiers stacked directly above each other (Lower Roofs at
y=0, Mid Roofs at y=6m, High Roofs at y=12m), same 40m × 36m footprint on
all three, each ringed by a low 1.1m parapet wall rather than a full
enclosing wall — **these are open-air rooftops, sky visible on all
sides**, connected by "fire escape ladder" lift pads the same way
Chapter III's floors connect.

Ambient/sky tint for the whole chapter: cool dusk-blue, background color
`#8C99C7`, ambient light `#B3BFD9` at energy 1.2 — noticeably cooler and
more "open sky" than Chapters II/III. Whatever sky/atmosphere treatment
you design should read as early evening or an overcast blue hour, not
daylight.

### Lower Roofs (40m × 36m plate, parapet 1.1m tall)
- Floor material placeholder: `#80757A` (cool charcoal-gray) — think
  worn tar/gravel roofing material.
- Parapet material (shared across all three tiers): `#666166` (dark
  neutral gray) — low concrete/brick roof-edge walls.

**Chimney Row**
- Footprint: 12m × 12m.
- Placeholder: `#8C8085` (warm-gray).
- Flavor line: *"Chimney Row. Smoke that never finishes rising."*
- The defining prop here is obviously chimneys — 3–5 varied brick chimney
  stacks of different heights, ideally with a smoke-effect element I can
  animate on my end if you deliver a base smoke-wisp sprite separately.

**Gutter Walk**
- Footprint: 12m × 12m.
- Placeholder: `#858C80` (muted sage-gray).
- Flavor line: *"Gutter Walk. Rain that fell somewhere else."*
- A walkway along a roof gutter/drainage channel — corrugated metal or
  aged concrete gutter texture, maybe a downspout prop, puddles that
  never quite dry (a still-water decal, not the animated hazard shader
  used in the Decay minigames).

### Mid Roofs (40m × 36m plate at y=6m, parapet 1.1m tall)
- Floor material placeholder: `#948C9E` (dusty lavender-gray) — a
  visibly cooler/more elevated tone than Lower Roofs.

**Rope Bridge**
- Footprint: 12m × 12m.
- Placeholder: `#9E8066` (warm rope-brown).
- Flavor line: *"Rope Bridge. It sways whether or not you're on it."*
- Wants an actual rope-and-plank bridge texture/prop treatment — rough
  wood planks, frayed rope rails. This is a named, memorable set piece,
  worth making distinct rather than just a floor tint.

**Water Tower Roof**
- Footprint: 12m × 12m.
- Placeholder: `#808C99` (steel-blue-gray).
- Flavor line: *"Water Tower Roof. Something drips on a schedule."*
- The obvious centerpiece prop is a wooden or steel water tower structure
  (the classic NYC-rooftop cylindrical tank on legs), plus a subtle drip/
  puddle decal beneath it.

**Skylight Roof**
- Footprint: 12m × 12m.
- Placeholder: `#B3BFD9` (pale glass-blue), the lowest roughness value on
  this tier (0.3) — **meant to look like glass/glazing**, not solid
  roofing.
- Flavor line: *"Skylight Roof. You can see a room that isn't underneath
  it."*
- A large flat skylight window set into the roof surface — glass-panel
  texture with visible frame mullions. If you want to lean into the
  flavor text, whatever is "visible" through the glass should be
  deliberately mismatched/wrong (a room that doesn't belong under a
  rooftop), which I can composite as a separate render if you provide
  the glass/frame as its own layer.

### High Roofs (40m × 36m plate at y=12m, parapet 1.1m tall — north side
only currently modeled)
- Floor material placeholder: `#ADA8C7` (pale periwinkle-gray) — the
  lightest, highest-altitude tone of the three tiers.

**Clock Tower**
- Footprint: 12m × 12m.
- Placeholder: `#BFB380` (warm brass-gold).
- Flavor line: *"Clock Tower. Every hand points to a different hour."*
- A clock tower structure with an oversized clock face as the hero prop
  — per the flavor text, the clock face art itself should show hands
  pointing in visibly non-matching directions (not a working 12:00
  clock), which is a deliberate detail worth designing into the clock
  face texture itself rather than leaving to me to fake later.

**Antenna Spire**
- Footprint: 8m × 8m (smaller zone than its neighbors).
- Placeholder: `#999EB8` (cool slate-lavender).
- Flavor line: *"Antenna Spire. Picks up nothing, broadcasts anyway."*
- A tall radio/TV antenna mast structure, guy-wires, maybe a warning
  light at the top.

**The Open Dream**
- Footprint: 12m × 12m.
- Placeholder: `#E6D9F2` (pale lavender-white) — the brightest, most
  ethereal tone in the entire chapter.
- Lighting: bright cool-white point light, `#F2E6FF`, energy 0.9 (the
  strongest light fixture in Chapter IV).
- Flavor line: *"The Open Dream. Above the street, above everything else
  you've seen so far."*
- This is the emotional payoff room of the vertical climb from Chapter
  III through Chapter IV — deliberately the least "furnished" of any
  named room in either chapter. If anything, one or two minimal props
  (a single chair facing the skyline, a low platform to stand on) rather
  than a fully dressed set. The floor texture and any horizon/sky
  treatment matter more here than props.

### Lift pads (all three tiers)
Same glowing-pad convention as Chapter III, currently a flat gold-tan
emissive color (`#F2D999`), no texture — low priority for the same
reason as Chapter III's pads.

---

## CHAPTER V — Pastel Dreamscape (recycled Chapter II content)

A single large multi-room building — atrium, foyer, sunken pool, arcade/
lounge, and a rooftop-adjacent balcony — all on one 74m × 62m floor plate,
walls 5m tall. This was originally built as the very first Chapter II
concept before the real Chapter II ("The Infinite Neighborhood") replaced
it, and it's now recycled into the main story as Chapter V, so it needs
the same treatment as the rest: real textures/props, nothing structural
needs to change.

Ambient tint: warm cream, `#F5E6D9`-ish, energy 1.15 — the warmest,
brightest chapter in the whole main sequence, intentionally hotel-lobby/
resort-adjacent in mood rather than domestic or outdoor.

**Whole-building floor**: 74m × 62m. Placeholder: `#F0E6D9` (warm cream).
**Walls**: 5m tall, placeholder `#F7F0E6` (near-white warm cream),
shared across the whole building.

### Main Atrium & Spiral Stairwell
- Footprint: 18m × 18m, dead center of the building.
- Placeholder: `#F0D1B3` (warm peach-tan), the lowest roughness of any
  zone in this chapter (0.35) — meant to read as polished marble/stone.
- Lighting: warm point light, `#FFEBD1`, energy 0.85, range 16m — the
  brightest single fixture in the chapter.
- Flavor line: *"Main Atrium & Spiral Stairwell. The Pastel Dreamscape."*
- There's an existing bare cylindrical placeholder mesh here (3m top
  radius, 3.5m bottom radius, 3m tall) standing in for a spiral
  staircase — this needs a proper spiral-stair texture/model treatment,
  it's the visual anchor of the entire chapter and currently the single
  most obviously-unfinished object in it. Polished marble floor, gold or
  brass stair railings, a grand-hotel-lobby chandelier overhead (there's
  a light fixture at 4.5m already, so a chandelier prop hanging at that
  height would slot right in).

### Sun-Drenched Foyer & Reception
- Footprint: 20m × 16m, one corner of the building (−22m X, −18m Z).
- Placeholder: `#D1EBD1` (pale mint-green).
- Lighting: warm-white point light, `#FFFAD9`, energy 0.75.
- Flavor line: *"The Sun-Drenched Foyer & Reception. Soft elevator jazz
  plays. Always golden hour."*
- A hotel reception desk as the hero prop, potted palms, a seating area
  with low sofas, warm golden-hour lighting throughout (large windows or
  a sunlit-glow treatment on the walls would sell this well).

### Indoor Sunken Pool & Cloud Atrium
- Footprint: 22m × 18m, opposite corner (+22m X, −18m Z).
- Placeholder: `#A6D9E6` (pale aqua).
- Lighting: cool-white point light, `#D9FAFF`, energy 0.7, range 15m.
- Flavor line: *"The Indoor Sunken Pool & Cloud Atrium. Water is warm &
  smooth. Reflects motionless clouds."*
- There's already a working animated water shader on a 10m × 8m pool
  surface at the center of this zone (non-hazardous, purely decorative —
  this is not one of the Decay minigame's dangerous puddles). What's
  needed is the **surrounding pool deck**: poolside tile texture, deck
  chairs, potted plants, and ideally a painted or textured "sky with
  motionless clouds" treatment on the ceiling/upper walls to pay off the
  "Cloud Atrium" half of the name, since there's no literal ceiling mesh
  to paint a sky onto yet — a large mural-style wall panel would work
  as a practical substitute.

### The Pastel Arcade & Memory Lounge
- Footprint: 20m × 16m (−22m X, +18m Z).
- Placeholder: `#B3D9F2` (pale sky-blue).
- Lighting: pink point light, `#FFB3E6`, energy 0.55.
- Flavor line: *"The Pastel Arcade & Memory Lounge. Chimes, not beeps.
  Peaceful gradient screens."*
- This is a different arcade in tone from the Mall's neon arcade — per
  the flavor text, screens should show soft pastel gradients rather than
  bright game graphics, and the whole room should feel like a lounge
  with arcade cabinets in it rather than a loud arcade. 3–4 cabinet
  props with pastel-gradient "screens," soft bench seating, ambient
  string lighting.

### The Endless Skyline Balcony
- Footprint: 22m × 16m, the fourth corner (+22m X, +18m Z).
- Placeholder: `#F5D1C7` (warm dusty coral).
- Lighting: two warm-orange point lights, `#FFC780`, energy 0.5 each,
  positioned 6m apart — a sunset-colored double glow.
- Flavor line: *"The Endless Skyline Balcony. Gentle summer breeze.
  Endless sunset horizon."*
- This room wants an open balcony/terrace feel with an endless sunset
  skyline as its backdrop — since there's no horizon geometry yet, a
  large background/skybox-style painted panel showing a warm sunset
  skyline (city silhouette or open horizon, your call) would let me
  build a real sense of the "endless" view the flavor text promises.
  Foreground props: railing, outdoor lounge furniture, string lights.

---

## THE LOST PASSAGE (Backrooms)

A single small room (16m × 16m, walls 4m tall) representing "Level 1" of
what will eventually be a larger, incrementally-built Backrooms map. This
is explicitly **not** part of the dreamcore aesthetic — it's the classic
liminal-space "wrong yellow" look: fluorescent-lit, mustard-and-beige,
unsettling through blandness rather than horror imagery.

**Floor**: 16m × 16m. Placeholder: `#5C5229` (dark mustard-olive).
**Walls**: 4m tall, placeholder: `#BFAD59` (dingy mustard-yellow) — this
is the single most important texture in the whole request: it needs to
read as damp, stained, dated commercial wallpaper or paneling, the
specific "backrooms" aesthetic (think old office carpet crossed with a
flickering motel hallway).

**Atmosphere already set in-engine**: background color near-black
`#0D0D0A`, fog enabled (color `#665C33`, low density), ambient light
`#736633` at only 0.5 energy — so whatever wall/floor texture you make
should be legible in that dim, slightly foggy, yellow-tinted gloom, not
designed to look good under bright neutral light. Three flickering point
lights (an existing script randomizes their brightness over time) are
scattered through the room at warm dim tones (`#D9D199`) — the room is
meant to feel under-lit and inconsistent, never evenly bright.

### Hazard: Bottomless Pool
- A 2.5m × 2.5m pit trigger, currently invisible (no visual at all — it's
  purely a floor-based trap right now). Needs a "wrong" floor-texture
  patch that reads as a pit, hole, or unstable floor section distinct
  from the rest of the room's flooring — `backrooms_tex_pit.png`, or a
  standalone decal prop if you'd rather it sit on top of the floor than
  replace it.

### Interactable: Stairs Down
- A 2m × 2m trigger area, also currently invisible, meant to lead the
  player deeper into the (future) Backrooms level 2. Needs a stairwell-
  down prop/decal — doesn't need to be a fully modeled staircase, a
  convincing "opening down" floor treatment is enough, `backrooms_
  prop_stairs_down.png`.

### Artifacts (4 built, standalone pickups — each needs its own prop art)
Exactly one of these is the "real" way out each trip (randomized), the
rest are decoys — visually they should all read as equally plausible
"the object you were told to look for," no visual tell that one is
correct:
- `backrooms_prop_artifact_brass_key.png` — "a tarnished brass key."
- `backrooms_prop_artifact_pocket_watch.png` — "a stopped pocket watch."
- `backrooms_prop_artifact_childs_shoe.png` — "a single child's shoe."
- `backrooms_prop_artifact_glass_marble.png` — "a glass marble."

Each is currently a bare 0.6m-radius trigger sphere with zero visual
representation — these four are the highest-priority Backrooms asks
since the room is completely unreadable as a scavenger-hunt space without
them.

### Doors (3 built, standalone exit props)
Same one-is-real-rest-are-decoys pattern as the artifacts. Each is
currently a bare 1.2m × 2.2m trigger slab with no visual:
- `backrooms_prop_door_red.png` — "the door with red paint flaking off
  it."
- `backrooms_prop_door_numbers.png` — "the door scratched with numbers."
- `backrooms_prop_door_ajar.png` — "the door standing slightly ajar."

These three door names describe very specific, distinct visual details
(flaking red paint / scratched numbers / standing ajar) — please design
to those exact descriptions rather than generic door variants, since the
flavor text the player reads names the same detail the art should show.

---

# PART B — Profile Screen, Pause Menu, Mirrors

Three new systems just went into the engine (save profiles, mid-run
character swapping, reflective mirrors). All three work — code is done,
committed, headlessly tested — but all three are wearing placeholder art
or, in the mirror's case, are actively **misusing existing art in a way
that will look broken** until new pieces land.

## Quick-reference table

| File | Type | Pixel size | Alpha | Priority |
|---|---|---|---|---|
| `ui_profile_bg.png` | full-bleed background | 1920×1080 | no | High |
| `ui_pause_bg.png` | full-bleed background | 1920×1080 | no | High |
| `dreamer_reflection_bobby.png` | transparent cutout | 620×980 | **yes** | **Critical** |
| `dreamer_reflection_luna.png` | transparent cutout | 620×980 | **yes** | **Critical** |
| `dreamer_reflection_mateo.png` | transparent cutout | 620×980 | **yes** | **Critical** |
| `ui_pausecard_bobby.png` | transparent cutout | 660×960 | yes | Medium |
| `ui_pausecard_luna.png` | transparent cutout | 660×960 | yes | Medium |
| `ui_pausecard_mateo.png` | transparent cutout | 660×960 | yes | Medium |
| `mirror_frame_ornate.png` | transparent prop | 1120×1760 | yes | High |
| `mirror_glass_overlay.png` | transparent prop | 512×768 | yes | Low (nice-to-have) |

Naming convention note: these are UI/prop assets, not level textures, so
they use `ui_`, `dreamer_`, and `mirror_` prefixes rather than the
`chapterXX_tex_/prop_/sign_` convention used in Part A — same "one asset
= one file, no contact sheets" rule applies.

## 1. Create Your Profile screen

**What it is**: the very first thing a new player sees after pressing
"New Dream" on the title screen — a name field ("What should we call
you?" / placeholder "Your name") and a Confirm button, before Character
Select. Typing a name here is the entire "create a profile" step; there's
no account, no server, it's a label saved with the game.

**Current state**: a flat near-black rectangle (`#141217` at 92% opacity)
covering the whole screen, with a plain white label, a plain LineEdit,
and a plain button — all engine-default styling, dead center. No baked
art exists yet.

**What's needed**: `ui_profile_bg.png`, 1920×1080, full-bleed, no alpha
(background only, like `title_hero.png`/`character_select_hero.png`).

**Layout constraint — read carefully, this is the part that's different
from the hero-image convention used everywhere else**: Title.tscn and
Character Select bake their buttons directly into the art and position
invisible hotspots on top of the exact baked pixels (see
`button_regions.json` from the earlier Menu_Chapter_Art packet). This
screen can't work that way — the name field is a live text input, not a
button, and its position is anchored to screen-center at runtime, not
scaled from a source-pixel rectangle. That means:

- **Do not bake the prompt text, the input field, or the Confirm button
  into this image.** They're drawn live by the engine on top of it.
- Design the image so a **vertical band roughly 300px tall, centered
  both horizontally and vertically** (i.e. from about y=390 to y=690 in
  the 1920×1080 canvas, x=660 to x=1260), reads as a clear, uncluttered
  surface behind pale text — a soft dark vignette, a fogged mirror, a
  folded-open journal page, anything from the dreamcore palette that
  naturally has a calm middle. Busy detail belongs in the outer thirds
  of the frame, not the center band.
- Palette: match the cool, muted, slightly desaturated blue-violet-gray
  family already established by `title_hero.png`'s edges and
  `character_select_hero.png`'s background — this screen sits between
  those two in the flow and shouldn't feel like a different game.
- Mood: "the moment right before you pick who you are" — a threshold,
  not a room. A door left ajar, a mirror with no reflection yet, an
  empty bed with the blanket still warm — anything that reads as
  "about to begin," not "already somewhere."

## 2. Pause / Change Character menu

**What it is**: press Escape at any time during normal exploration (not
inside a Nightmare Passage, which already uses Escape to exit) and a
menu opens showing all three dreamers as cards; picking one swaps your
character instantly, no reload. There's a "Currently: <Name>" label and
a Resume button.

**Current state**: same flat near-black rectangle treatment as above
(`#0D0A12` at 82% opacity), with the three existing
`character_select_hero`-style door cards crammed into a 220×320 slot
each — which brings us to §2b below.

**What's needed — background**: `ui_pause_bg.png`, 1920×1080, full-bleed,
no alpha, same non-baked-controls rule as the profile screen above. The
live layout is a vertical stack, centered, roughly 840×520px
(x=540–1380, y=390–910): a heading, a "Currently: X" line, a row of
three cards, then Resume. Keep that whole central column clear the same
way as §1. This one can read calmer/dimmer than the profile screen —
it's a pause overlay over an already-lit level, not a fresh scene — so
lean into a near-black vignette with only a faint desaturated color
identity at the very edges (a thin band of whatever hue reads as "this
chapter" is enough; it doesn't need to be a full illustrated scene).

**What's needed — pause-specific character cards (§2b)**: the three
existing `Bobby_/Luna_/Mateo_character_card.webp` files are
1086×1448px, built for Character Select's large "choose your door" cards
(baked background, vignette, ornate framing intended to fill a
260×380-scaled hero region). Reusing them at pause-menu size does two
things wrong: the aspect ratio doesn't match the 220×320 UI slot
(1086:1448 = 0.750 vs. the slot's 220:320 = 0.688 — Godot letterboxes
it rather than distorting it, but it reads as an odd-shaped card with
gutters), and the heavy door-frame styling that makes sense as a big
hero choice reads as visual noise at chip size.

Please deliver three **new, smaller, plainer** cards purpose-built for
this context:
- `ui_pausecard_bobby.png`, `ui_pausecard_luna.png`,
  `ui_pausecard_mateo.png` — 660×960px each (exactly the pause slot's
  0.688 aspect ratio, at 3× so it stays crisp), **with alpha** — a clean
  character portrait/bust (waist-up is fine, this doesn't need full
  body) on a transparent background, no card frame, no vignette box, no
  baked "select" affordance. The menu's own background art (§2's
  `ui_pause_bg.png`) is what supplies the frame around each slot; the
  card image itself should be just the character, croppable to a
  rounded-rect mask on my end if needed.
- Same three color identities as the existing character cards (Bobby's
  palette, Luna's palette, Mateo's palette) so a player recognizes "the
  same character, redrawn smaller," not a new design.

## 3. Mirrors — the important one

**What it is**: real-time reflective mirror surfaces (planar, camera-
reflection based, already rendering live) placed at a handful of curated
wall spots — currently Chapter III's Mirror Hall (2 spots) and the
Nightmare Museum's Quiet Mirror Room (2 spots), with more spots planned
level by level. A random subset of the curated spots actually gets a
mirror each time the level loads, so it's not the same set every run.
Critically, **the player's own body is meant to be visible in the
reflection** — there's no first-person body model (this is a strict
first-person game), so the trick is a billboard sprite on a render layer
invisible to the main camera but visible to the mirror's own camera.

**Current state, and why it's actively broken looking**: the mirror
plane itself renders correctly (it's a live camera render, not a static
image — that part needs no art). But the "player's reflection" billboard
is currently reusing the full 1086×1448px `_character_card.webp` art —
built for Character Select, not for this — at a world scale that would
make it roughly **3.76m tall and 2.82m wide** at full size next to a
mirror that's only **1.4m wide × 2.2m tall**. I've temporarily rescaled
the existing art smaller in code so it's not screen-breaking, but it's
still the wrong art for the job (a card, not a body-shaped cutout) and
will look like a floating rectangle rather than a reflection until the
real asset below lands.

**What's needed**: `dreamer_reflection_bobby.png`,
`dreamer_reflection_luna.png`, `dreamer_reflection_mateo.png` —
**620×980px each, full transparent alpha background, a single standing
full-body pose, centered, feet at the bottom edge of the canvas** (not
floating mid-frame — the sprite's pivot is bottom-anchored so the feet
need to land exactly on the last row of pixels or the character will
appear to hover above the mirror's floor line).

Exact math so you know why these numbers matter: the reflection billboard
is a `Sprite3D` with `pixel_size` (world meters per source pixel) set on
my end once art lands. If you deliver at 620×980px and I set
`pixel_size` so the figure reads as **~1.3m tall** (a small
cat/dog-proportioned dreamer standing upright — see the collision capsule
note: the player's own collider is a slender 0.22m-radius, 1.7m-tall
capsule, but these are anthropomorphized small animals per the paw art,
not human-scale), that's `pixel_size = 1.3 / 980 ≈ 0.001327`. I'll tune
the exact final number once I see the delivered art's actual proportions
— **you don't need to hit a number, just deliver at 620×980 with the
figure filling most of the vertical frame** (small margin top and sides,
feet flush to the bottom) and I'll make the meters-per-pixel math match
whatever you draw.

Style notes for the reflection art specifically (different brief than
the character-select cards):
- **Full body, not a portrait/bust** — this needs to read as "a body
  standing in a mirror," so show the whole figure, standing pose,
  facing forward (mirrors face the player, so a 3/4 or profile pose
  would look wrong here even though it might work for a card).
- **No background, no ground shadow, no card frame** — pure alpha
  cutout. The mirror mesh and its frame (below) supply the "this is a
  mirror" context; the character art supplies only the character.
- A faint desaturation or cool-blue tint baked into the art (5–10%
  toward blue-gray, subtle) helps sell "this is a reflection in glass,"
  not "this is the same character card pasted into the world" — entirely
  your call on how much, but a completely neutral/saturated copy of the
  existing character card art will look like a sticker, not a
  reflection.
- Keep each dreamer instantly recognizable against their existing paw
  art and character-select card — same coloring, same key silhouette
  features — just redrawn as a plain standing full-body cutout instead
  of a framed card.

**Mirror frame** — `mirror_frame_ornate.png`, 1120×1760px, transparent
PNG with a **precisely-sized rectangular cutout in the center**. The
live-rendered reflection quad is exactly 1.4m × 2.2m; at this frame's
native resolution that's a **cutout window of exactly 800×1257px**,
centered in the 1120×1760 canvas (leaving a 160px margin on each side
and a ~251px margin top/bottom — adjust the frame's proportions if you
want a thinner top/thicker bottom "vanity mirror" look, but the cutout
itself must stay 800×1257px and centered so it lines up with the render
quad edge-to-edge with no gap or overlap-into-the-glass).

- Style: an ornate, slightly warped, dreamcore-appropriate frame — think
  antique gilded, or bone-white plaster, or driftwood — something that
  reads as "a mirror someone hung here," not a modern bathroom mirror.
  Should feel at home in both the Mirror Hall (soft blue-gray palette,
  `#BFCCD9`-ish tones) and the Museum's Quiet Mirror Room (cool
  midnight-blue palette, `#333852`-ish tones) without needing a
  different frame per level — one frame design, tintable by the room's
  existing ambient light on my end.
- The frame sits **in front of** the render quad as a separate flat
  prop layered just in front of the glass, so it can slightly overlap
  the cutout edge (a few px of frame lip curling over the glass reads
  more convincing than a hard seam) — err on the side of a few pixels
  of overlap rather than a gap.

**Mirror glass overlay** (`mirror_glass_overlay.png`, 512×768px,
transparent, low priority / nice-to-have): a very subtle semi-transparent
texture — light fogging, a few age spots, a faint radial vignette darker
at the corners — meant to be alpha-blended directly over the live
reflection render so the mirror doesn't read as a perfectly clean video
feed. This is pure polish; ship without it and the mirror still works,
it'll just look a little too clean/digital up close.

---

# PART C — Remaining Side-Level Gaps & One Placement Question

Every side level (Mall, Clouds Zoo, Nightmare Museum, Liminal Junction,
Dreamcore Terminal) is now real-textured wherever a matching asset
existed in the delivered packets. These specific zones still fall back
to flat placeholder color because no matching texture was ever delivered
for them — pure polish, lowest priority in this whole document, worth
commissioning only once Parts A and B are done:

- **Mall**: Cinema floor, Greenhouse floor, Dream Playground floor.
- **Clouds Zoo**: Parking lot, Gentle Giants floor, Twilight Forest floor,
  Coral Cloud Reef floor.
- **Nightmare Museum**: Quiet Mirror Room, Star Nursery, Impossible
  Corridor. (Note: the Quiet Mirror Room's *floor/wall* texture is this
  ask; its two new mirror props are covered under Part B.)
- **Liminal Junction**: Carousel Lounge, Garden Platform, Lost Luggage,
  Observation Deck.
- **Dreamcore Terminal**: Tiny Cinema, Sleeper Lounge, Dining Car, Toy
  Pharmacy, Blank Gate, Lower Level.

## Terminal's "Pool Waiting" room — built, placement unconfirmed

Terminal had no dedicated Pool Waiting room in the original floor plan,
so I built one myself (a small room at the open corner past the Lower
Level, with the real `terminal_pool_waiting.ogg` ambience, the real
`terminal_tex_pool_waiting_tile.png` floor, and the airport-seating prop
moved over from the Concourse to sit in it properly) rather than leave
that texture and track homeless. If you have an actual floor-plan spot
for it, let me know and I'll relocate the room — the placement right now
is my best guess, not confirmed against a real layout. No new art needed
for this one, just a decision.

---

# Overall priority order across all three parts

1. **Chapter II** (Infinite Neighborhood) — Part A. It's the very next
   thing after the already-finished Chapter I, so it's first in line for
   anyone actually playing through.
2. **Backrooms artifacts + doors** — Part A. Small, self-contained, and
   the room is currently the least legible space in the whole game
   without them (seven totally invisible trigger volumes in an empty
   box).
3. **Mirror reflection cutouts + frame** — Part B. Small, self-contained,
   and currently the single most visibly "broken-looking" thing in the
   game if a player finds a Mirror Hall or Quiet Mirror Room mirror —
   worth leapfrogging ahead of the remaining main chapters for exactly
   that reason.
4. **Chapter III** (House That Knows You) — Part A. The biggest single
   ask (14 named rooms across three floors) but also the most impactful
   once done.
5. **Chapter IV** (Above the Street) — Part A. Pairs naturally with III
   since they're now physically connected via the Roof Hatch.
6. **Profile screen + pause menu backgrounds, pause cards** — Part B.
   Self-contained, fast, meaningfully improves first impressions (the
   profile screen is literally the first new-player screen) without
   being on the critical path of "does the game look finished while
   playing."
7. **Chapter V** (Pastel Dreamscape) — Part A. Lowest priority of the
   five main chapters since it's a recycled/secondary chapter rather
   than critical path, but still needed for full coverage.
8. **Side-level flat-color leftovers** — Part C. Pure polish, do
   whenever convenient.

Same delivery process as always: zip it, include a short
`START_HERE_CLAUDE.md`, ship however many pieces are ready rather than
waiting to batch the whole thing.
