# In Samir's Mind — Asset Request for Build 02

Audit date: this session, after wiring the full "FINAL CLAUDE ASSET DELIVERY"
payload (audio runtime, core UI, Chapter III/IV floorplans, Dreamcore Mall,
Nightmare Passages, Nightmare Minigames, Dreamcore Level 4, Clouds Zoo,
Dreamcore Terminal, Nightmare Museum, Liminal Junction) into the live build.
Everything in that delivery is now integrated and verified working. This is
what's still missing or worth commissioning next.

## Highest priority: the main story chapters have zero art — ✅ RESOLVED

Chapters II–V and the Lost Passage are all now delivered and integrated
— see `docs/MASTER_ASSET_BRIEF.md` for current status. Section kept
below as historical record of what was asked for and why.

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

## Delivered art now wired into the actual minigames — done

~~The Nightmare Minigames zip includes real art~~ This is now wired in:
corrupted-water tile onto both water hazards' shader, decay debris as
Decay set-dressing (Wrong Door, Freeze), colored floor tiles onto Simon
Reversed's four pads (matching their light colors), arcade icon strips as
marquees (Happy Forever on Simon Reversed, Dream Diver shapes on
Whack-a-Mole, Dream Diver arrows on Claw Timing, Memory Mart symbols on
Count and Answer), the destination-zone decal on every win/exit zone
(Don't Touch the Water, Rising Water, Hide and Seek, Claw Timing's
target), and the five extra Wander props (books/phone/plant/table/teddy)
replacing Count and Answer's plain glowing cubes. All 9 affected
minigames re-verified headlessly.

## Remaining flat-color materials in the six side levels

Batch 01 (Mall, Clouds Zoo, Nightmare Museum) delivered and integrated —
see `docs/MASTER_ASSET_BRIEF.md` Part C. Still open, no Batch 02 yet:

- **Liminal Junction**: Carousel Lounge, Garden Platform, Lost Luggage,
  Observation Deck.
- **Dreamcore Terminal**: Tiny Cinema, Sleeper Lounge, Dining Car, Toy
  Pharmacy, Blank Gate, Lower Level.

## Terminal's "Pool Waiting" room — built, placement unconfirmed

Terminal had no dedicated Pool Waiting room in the original floor plan, so
I built one myself (a small room at the open corner past the Lower Level,
with the real `terminal_pool_waiting.ogg` ambience, the real
`terminal_tex_pool_waiting_tile.png` floor, and the airport-seating prop
moved over from the Concourse to sit in it properly) rather than leave
that texture and track homeless. If you have an actual floor-plan spot for
it, let me know and I'll relocate the room — the placement right now is my
best guess, not confirmed against a real layout.

## Bottom line for build.02

1. Main story chapters (II-V) + Backrooms art is the priority — nothing
   else matters as much for how the game actually reads while playing the
   critical path.
2. Minigame reskin and Terminal's Pool Waiting room are both done.
3. The flat-color leftovers above are a nice-to-have polish pass whenever
   convenient.
