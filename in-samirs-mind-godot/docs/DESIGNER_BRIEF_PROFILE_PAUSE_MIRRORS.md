# In Samir's Mind — Designer Brief: Profile Screen, Pause Menu, Mirrors

**Status update — see `docs/MASTER_ASSET_BRIEF.md` for current state.**
The backgrounds (§1/§2) and the mirror frame + glass overlay (§3, minus
character art) are delivered and integrated. Still open: the
character-specific reflection cutouts (§3) and the pause-specific
character cards (§2b) — both explicitly not fabricated by the designer
without canon source art. The rest of this document is kept as the
exact spec for those two remaining pieces.

Three new systems just went into the engine (save profiles, mid-run
character swapping, reflective mirrors). All three work — code is done,
committed, headlessly tested — but all three are wearing placeholder art
or, in the mirror's case, are actively **misusing existing art in a way
that will look broken** until new pieces land. This brief is the
exact, numeric spec for what to draw, at what size, at what pixel
dimensions, so it drops into the engine with zero guesswork on my end —
same rule as every prior packet.

Nothing here blocks the game from running. It blocks these three
features from looking like they belong in the game instead of like a
debug menu.

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
`chapterXX_tex_/prop_/sign_` convention from the main-chapters brief —
same "one asset = one file, no contact sheets" rule applies.

---

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

---

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

---

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
is currently reusing the full 1086×1448px `_character_card.webp` art
at a world scale that makes it roughly **3.76m tall and 2.82m wide** —
next to a mirror that's only **1.4m wide × 2.2m tall**. That means right
now the reflection is a giant card looming out of frame in every
direction, not a body standing in a mirror. I've temporarily rescaled
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

## Delivery notes

- Same non-negotiable rule as every previous packet: **one asset per
  file**, no contact sheets, no multi-character grids for the reflection
  cutouts or pause cards — three separate files even though they're the
  "same" asset three times.
- All transparent assets need real alpha (not a solid-color fill
  pretending to be a background) — I'm compositing these at runtime, a
  baked-in background will show as a visible box.
- If it's easier on your end to rough out the three reflection cutouts
  and three pause cards as one pass per character (i.e. deliver
  `dreamer_reflection_bobby.png` and `ui_pausecard_bobby.png` together,
  then Luna, then Mateo) that's completely fine — they don't need to
  arrive as three separate character-complete batches, just correctly
  named and correctly sized whenever they land.
