extends Resource
class_name ChapterConfig
## Data-driven per-chapter rules (Master Build Brief section 16.3). One
## .tres instance per numbered chapter, referenced by SceneLoader/GameRoot
## instead of hardcoding chapter-specific branches in gameplay scripts.

@export var chapter_id: String = ""
@export var display_name: String = ""

## res:// paths to this chapter's environment scene(s), in placement order.
## Most chapters have one; Chapter 4 (Double Airport) uses the same path
## twice to place two joined instances.
@export var environment_scenes: Array[String] = []

## How many real objectives must be found to satisfy the chapter. 0 means
## the chapter has no hidden-object objective (e.g. a pure walkthrough).
@export var required_object_count: int = 0

## Group names (see ChapterObjectiveSpawner) marker pools are drawn from.
## Kept as group names rather than direct node references so a chapter
## scene can be re-authored without touching this Resource.
@export var objective_marker_group: String = ""
@export var decoy_marker_group: String = ""

@export var no_clip_enabled: bool = false

## Relative weight/frequency for ambient Nightmares in this chapter. 0
## disables them entirely (only Chapter 1 does this per the brief).
@export var nightmare_weight: float = 1.0

## Name of a palette/material profile Resource applying this chapter's
## hue-shift/retile/relight pass (see resources/palettes/).
@export var palette_profile: String = ""
