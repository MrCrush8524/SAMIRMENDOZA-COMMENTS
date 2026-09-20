# In Samir's Mind — Designer Brief: Chapter Three, "The House That Knows You"

Chapter III's rooms, walls, and the completion loop (3 Journal Fragments,
3 Room Checks, a gated Back Exit + Roof Hatch, escalating mutation
stages, real climbable stairs between floors) are all built and working
in the engine right now. What's missing is real material art — every
existing `chapter03_tex_*` file is a near-solid flat color with faint
photo-noise grain and, at most, a couple of thin lines. None of them
have the actual surface detail Chapter I's laundromat set has (visible
tile grout, worn grain, printed signage). That's why the house currently
reads as flat pastel blocks instead of a house.

Same rules as every other brief in this project — see
`docs/DESIGNER_BRIEF_CHAPTER_TWO_FAMILIAR_STREET.md` §0 for the full
list, repeated in short here because it's the exact list that would fix
this chapter:

1. **One material per file, full bleed, no reference sheet.** Deliver
   each texture as its own file that's nothing but the tileable pattern,
   edge to edge — no label, caption, ruler, or neighboring swatch in
   frame.
2. **Say whether it's a tileable material or a one-off mural.** Every
   texture below is a repeating material (wall, floor, wallpaper) — this
   chapter doesn't currently have any one-off illustrated murals like
   Chapter I's bench nook or utility sink, so all of it is `_tex_`.
3. **Every floor needs a clean variant.** None of Chapter III's floors
   are supposed to be dirty/distressed per the design brief (this is a
   lived-in house, not a laundromat) — so this only matters if a
   specific floor is deliberately meant to look worn (the attic, maybe).
4. **Tile scale**: design assuming a repeat every **0.4–0.6m** at
   in-game scale (real tile/plank/carpet-pattern size), not the 8–12m
   rule used for outdoor zones.

## The actual texture list (all `assets/textures/chapter03/`, replace in place — same filenames, same ext_resource slots, nothing else needs to change)

- `chapter03_tex_wall_shared.png` — **the most important one.** Used on
  every interior wall in the entire house (all three floors). Needs to
  read as an actual painted-drywall or wallpapered surface with some
  visible texture/grain at close range — right now it's indistinguishable
  from a color swatch.
- `chapter03_tex_ground_floor.png` — base hallway/corridor floor,
  ground level. Suggest a warm wood-plank or entry-carpet look.
- `chapter03_tex_foyer_floor.png` — entry foyer floor, distinct from the
  general ground floor.
- `chapter03_tex_living_rug.png` — living room area rug over whatever
  base floor shows at the edges.
- `chapter03_tex_kitchen_tile.png` — kitchen floor, small tile pattern.
- `chapter03_tex_courtyard_paving.png` — the interior courtyard's stone/
  paving floor.
- `chapter03_tex_sunroom_floor.png` — sunroom floor, lighter/brighter
  material fitting a glassed-in room.
- `chapter03_tex_mirrorhall_floor.png` — second-floor mirror hall floor;
  a slight sheen would suit the room's theme.
- `chapter03_tex_child_wallpaper.png` — child's room wallpaper, a
  distinct pattern from the shared wall texture.
- `chapter03_tex_memory_floor.png` — second-floor memory room floor.
- `chapter03_tex_sitting_floor.png` — second-floor sitting room floor.
- `chapter03_tex_attic_floor.png`, `chapter03_tex_attic_wall.png` —
  attic floor/wall; this is the one place a worn/dusty look is actually
  appropriate (unfinished attic).
- `chapter03_tex_duplicate_corridor.png` — the attic's "duplicate
  corridor" — same base material family as the attic, since the room's
  wrongness should come from its geometry/lighting, not a different
  texture.
- `chapter03_tex_view_floor.png` — attic's "view" nook floor.
- `chapter03_tex_liftpad.png` — **now unused** — the teleport-pad
  "lifts" this texture was for were replaced with real stairs this
  session, so this file can be dropped from the ask, freeing budget for
  the wall texture above.

## One new ask: a Back Exit / Roof Hatch door texture

Both of Chapter III's exits are currently flat placeholder colors (no
texture at all) — I didn't have a suitable existing asset to reuse and
used plain `albedo_color` values rather than requesting one at the time.
Ask: `chapter03_tex_exit_door.png`, a plain interior door (same style for
both — the Back Exit is an ordinary-looking door and the Roof Hatch
already has its own hatch texture and doesn't need this). Deliver per
the same one-material-per-file rule above; I'll apply it to both the
Back Exit door mesh and reuse it if the Roof Hatch's existing hatch
texture ever needs a refresh.

## Priority if this has to land in batches

1. `chapter03_tex_wall_shared.png` — every room in the house uses it,
   biggest visual impact for one file.
2. The per-room floor textures — even a modest upgrade from flat color
   to a real material makes each room read as distinct.
3. `chapter03_tex_exit_door.png` — smallest ask, only affects one prop.
4. Attic wall/floor/duplicate-corridor — lowest priority since the
   attic's "wrongness" already comes from its geometry (the corridor
   that keeps going) rather than needing rich material detail.
