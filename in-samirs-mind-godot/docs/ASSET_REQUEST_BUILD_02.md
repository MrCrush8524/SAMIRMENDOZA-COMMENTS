# In Samir's Mind — Asset Request for Build 02

Audit date: this session, after wiring the full "FINAL CLAUDE ASSET DELIVERY"
payload (audio runtime, core UI, Chapter III/IV floorplans, Dreamcore Mall,
Nightmare Passages, Nightmare Minigames, Dreamcore Level 4, Clouds Zoo,
Dreamcore Terminal, Nightmare Museum, Liminal Junction) into the live build.
Everything in that delivery is now integrated and verified working. This is
what's still missing or worth commissioning next.

## Highest priority: the main story chapters have zero art

Chapter I has real textures (from earlier packets). **Chapters II (The
Infinite Neighborhood), III (House That Knows You), IV (Above the Street),
V (recycled Pastel Dreamscape), and the Lost Passage (Backrooms) are still
100% flat placeholder-color materials — no textures, no props, no signage
at all.** These are the core critical-path chapters, not optional side
levels, so this is the biggest visible gap in the current build.

Needed per chapter, same style as the side-level deliveries (opaque tileable
floor/wall textures + standalone transparent PNG props/signage):

- **Chapter II — The Infinite Neighborhood**: suburban street/sidewalk/lawn
  textures, house facades, a few yard props (mailbox, hedge, porch light),
  signage for the Hub of Quiet / Park of Forgotten Balls / Gazebo Plaza /
  Nostalgia Field.
- **Chapter III — House That Knows You**: per-floor textures (Ground/
  Second/Attic — foyer, living room, kitchen, courtyard, sunroom, mirror
  hall, child's room, memory room, sitting room, attic, duplicate corridor,
  the view), plus furniture props for at least the named rooms.
- **Chapter IV — Above the Street**: rooftop/parapet/gravel textures per
  tier (Lower/Mid/High Roofs), plus chimney, water tower, rope bridge,
  clock tower, antenna, and skylight props.
- **Chapter V — Pastel Dreamscape** (recycled Chapter II content): atrium/
  stairwell/pool/arcade/balcony textures and props.
- **Lost Passage (Backrooms)**: wall/floor/ceiling textures with the liminal
  "wrong yellow" aesthetic, plus artifact and door variant art (10 artifact
  IDs, matching door IDs per `BackroomsManager.gd`).

## Delivered but not yet wired into the actual minigames

The Nightmare Minigames zip includes real art (`decay_corrupted_water_tile`,
`decay_debris_bent_pipe/broken_light/ceiling_chunk`, `floor_tile_blue/green/
red/yellow`, `arcade_dream_diver_arrows/shapes_strip`, `arcade_happy_forever_
faces_strip`, `arcade_memory_mart_symbols_strip`, extra `wander_prop_books/
phone/plant/table/teddy`) that predates the 11 minigames actually built this
session (Rising Water, Wrong Door, Freeze, Follow the Light, Count and
Answer, Hide and Seek, Simon Reversed, Claw Timing, Whack-a-Mole, plus the
original Don't Touch the Water / What Changed). The two sets don't line up
1:1 — this is an **engineering task for me**, not a new art ask: I'll reskin
the built minigames with this delivered art (corrupted water tile onto the
two water hazards, debris as Decay set-dressing, the arcade icon strips onto
Simon Reversed's pads, the extra Wander props into Count and Answer/Follow
the Light) in the next pass.

## Remaining flat-color materials in the six side levels

Every side level is now real-textured where a matching asset existed. These
zones still fall back to flat color because no matching texture was in the
delivery — worth commissioning if you want full coverage:

- **Mall**: Cinema floor, Greenhouse floor, Dream Playground floor.
- **Clouds Zoo**: Parking lot, Gentle Giants floor, Twilight Forest floor,
  Coral Cloud Reef floor.
- **Nightmare Museum**: Quiet Mirror Room, Star Nursery, Impossible
  Corridor.
- **Liminal Junction**: Carousel Lounge, Garden Platform, Lost Luggage,
  Observation Deck.
- **Dreamcore Terminal**: Tiny Cinema, Sleeper Lounge, Dining Car, Toy
  Pharmacy, Blank Gate, Lower Level.

## Terminal's "Pool Waiting" room doesn't exist yet

`terminal_pool_waiting.ogg` and `terminal_tex_pool_waiting_tile.png` were
delivered, but Terminal has no dedicated Pool Waiting room in the current
floor plan — I approximated by putting the audio on the Concourse and the
sleep-gate carpet took the texture slot instead. If Pool Waiting is meant to
be a real room, I need its floor-plan placement to build it properly.

## Bottom line for build.02

1. Main story chapters (II-V) + Backrooms art is the priority — nothing
   else matters as much for how the game actually reads while playing the
   critical path.
2. I'll handle re-skinning the 11 minigames with already-delivered art
   myself, no new commission needed there.
3. The flat-color leftovers above are a nice-to-have polish pass whenever
   convenient.
4. Confirm whether Pool Waiting is a real Terminal room before art is made
   for it.
