extends Node3D
## Generic "walks alongside the target" companion behavior, independent
## of whatever visual model/rig sits under this node. `top_level = true`
## decouples this node's global transform from its parent (the Player
## CharacterBody3D) so it can trail a beat behind rather than being
## rigidly glued to the camera the way a worn body is.
##
## This script owns: following, desired position relative to the target,
## distance/catch-up handling, species identity, and below-world
## recovery. Visual/animation specifics belong to whichever species
## wrapper (BobbyVisual/MateoVisual/LunaVisual, see CompanionVisual.gd)
## is currently instanced as this node's child - see set_species below.
## A legacy scrub_anim_name path is kept for the old single lowpoly-cat
## visual (rollback only; no longer used by Bobby/Mateo/Luna selection).

@export var follow_target_path: NodePath
@export var offset := Vector3(0.7, 0.0, 0.9) # local to the player's facing: +x right, +z behind
@export var follow_lerp := 5.0
## Distance beyond which this snaps straight to the target's side
## instead of lerping - covers "catches up safely" after a chapter
## transition or any other instant target teleport, where lerping from
## the old position would otherwise visibly crawl/slide across the map.
@export var catch_up_snap_distance := 12.0
## Mirrors Player.VOID_FALL_Y: this companion has no collision of its
## own (see class doc), so it can't trigger a floor check, but if its
## lerp target ever puts it below the same threshold the player uses,
## recover by snapping to the target instead of drifting endlessly.
@export var void_fall_y := -15.0

## Legacy path only - a fixed clip name to scrub on whatever
## AnimationPlayer is found under this node's CURRENT child, used only
## when that child is not a CompanionVisual (i.e. the old lowpoly cat,
## kept available for rollback per the integration brief - selecting
## Bobby/Mateo/Luna never takes this path since all three go through
## set_species() -> CompanionVisual instead).
@export var scrub_anim_name := ""
@export var scrub_cycles_per_meter := 0.7

## Wraps one embodiment so Player.gd can swap which one is "worn" (rigid,
## fixed local transform, moves with the camera) vs "companion" (this
## script's own trailing/follow behavior) without needing two different
## scripts per body - see set_following below. Only ever relevant for
## NathanSlot; CatSlot is always following, never worn.
@export var worn_transform := Transform3D.IDENTITY

## Bobby/Mateo/Luna's game-ready wrapper scenes - each just instances its
## own untouched source GLB with a CompanionVisual.gd adapter configured
## with that species' real clip names (see assets/characters/game_ready/).
const SPECIES_VISUALS := {
	"Bobby": preload("res://assets/characters/game_ready/BobbyVisual.tscn"),
	"Mateo": preload("res://assets/characters/game_ready/MateoVisual.tscn"),
	"Luna": preload("res://assets/characters/game_ready/LunaVisual.tscn"),
}
## Ground speed (m/s) above which the companion is considered "walking"
## for semantic state purposes - well below real companion movement
## speed, well above floating-point lerp settling noise.
const MOVING_SPEED_THRESHOLD := 0.15

var _target: Node3D = null
var _anim: AnimationPlayer = null
var _last_pos := Vector3.ZERO
## The current species' CompanionVisual adapter, if the active child
## implements request_state()/scrub_by_distance() - null when running
## the legacy single-cat rollback path instead.
var _visual: Node = null
var _active_species: String = ""

func _ready() -> void:
	if not follow_target_path.is_empty():
		_target = get_node(follow_target_path)
	_last_pos = global_position
	_setup_legacy_scrub() # only does anything if a static child + scrub_anim_name already exist (rollback path)
	set_following(false) # Default to "worn" until Player.gd says otherwise.

func _setup_legacy_scrub() -> void:
	if scrub_anim_name.is_empty():
		return
	_anim = find_child("AnimationPlayer", true, false)
	if _anim and _anim.has_animation(scrub_anim_name):
		_anim.get_animation(scrub_anim_name).loop_mode = Animation.LOOP_LINEAR
		_anim.play(scrub_anim_name)
		_anim.pause()

## Swaps which species visual this companion shows - replaces whatever
## child is currently present (nothing, the legacy static cat, or a
## previously-selected species) with the requested one's wrapper scene.
## Idempotent: calling with the already-active species does nothing.
func set_species(species_id: String) -> void:
	if species_id == _active_species:
		return
	if not SPECIES_VISUALS.has(species_id):
		push_warning("CompanionFollower.set_species: no visual registered for '%s'" % species_id)
		return
	for c in get_children():
		remove_child(c)
		c.queue_free()
	_anim = null
	var new_visual: Node = SPECIES_VISUALS[species_id].instantiate()
	add_child(new_visual)
	_visual = new_visual if new_visual.has_method("request_state") else null
	_active_species = species_id

func get_visual() -> Node:
	return _visual

## active=true: trails the target as a loose companion (top_level, so its
## global transform is independent of the Player root it's parented
## under). active=false: rigidly worn at worn_transform - only ever used
## by NathanSlot; CatSlot never wears anything.
func set_following(active: bool) -> void:
	top_level = active
	set_physics_process(active)
	if not active:
		transform = worn_transform

func _physics_process(delta: float) -> void:
	if not is_instance_valid(_target):
		return
	var basis: Basis = _target.global_transform.basis
	var desired: Vector3 = _target.global_position \
		+ basis.x * offset.x + basis.z * offset.z + Vector3(0, offset.y, 0)
	# Below the world, or too far to reasonably lerp back (the target
	# teleported - a chapter load, a void-fall recovery, a nightmare/
	# backrooms transition): snap straight there instead of visibly
	# crawling across the map or drifting forever beneath the floor.
	if global_position.y < void_fall_y or global_position.distance_to(desired) > catch_up_snap_distance:
		global_position = desired
	else:
		global_position = global_position.lerp(desired, clampf(follow_lerp * delta, 0.0, 1.0))
	rotation.y = _target.rotation.y

	var moved := global_position.distance_to(_last_pos)
	var moving := (moved / maxf(delta, 0.0001)) > MOVING_SPEED_THRESHOLD
	if _visual:
		_visual.request_state("walk" if moving else "idle")
		_visual.scrub_by_distance(moved)
	elif _anim and _anim.has_animation(scrub_anim_name):
		var anim_length: float = _anim.get_animation(scrub_anim_name).length
		var advance: float = moved * scrub_cycles_per_meter * anim_length
		var new_pos: float = fmod(_anim.current_animation_position + advance, anim_length)
		_anim.seek(new_pos, true)
	_last_pos = global_position
