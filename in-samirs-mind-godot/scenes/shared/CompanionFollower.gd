extends Node3D
## Generic "walks alongside the target" companion behavior, independent
## of whatever visual model/rig sits under this node (currently the cat;
## designed so a future replacement model plugs in without touching this
## script - see set_following/worn_transform below for the one thing it
## still shares with a body that can also be "worn"). `top_level = true`
## decouples this node's global transform from its parent (the Player
## CharacterBody3D) so it can trail a beat behind rather than being
## rigidly glued to the camera the way a worn body is.
##
## This script owns: following, desired position relative to the target,
## distance/catch-up handling, and below-world recovery. It deliberately
## does NOT know anything about the visual model's skeleton beyond an
## optional named animation to scrub (scrub_anim_name) - swapping the
## child model later should not require editing this file.

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

## When set, this node's own animation is scrubbed by distance moved
## (same technique Player.gd uses for the worn cat body) rather than
## left to auto-loop on its own - the cat's DreamerCatSkin doesn't drive
## playback itself, unlike Nathan's PersonRecolor (which already starts
## its own looping walk cycle in _ready).
@export var scrub_anim_name := ""
@export var scrub_cycles_per_meter := 0.7

## Wraps one embodiment (Nathan or the cat) so Player.gd can swap which
## one is "worn" (rigid, fixed local transform, moves with the camera)
## vs "companion" (this script's own trailing/follow behavior) without
## needing two different scripts per body - see set_following below.
@export var worn_transform := Transform3D.IDENTITY

var _target: Node3D = null
var _anim: AnimationPlayer = null
var _last_pos := Vector3.ZERO

func _ready() -> void:
	if not follow_target_path.is_empty():
		_target = get_node(follow_target_path)
	_last_pos = global_position
	if not scrub_anim_name.is_empty():
		_anim = find_child("AnimationPlayer", true, false)
		if _anim and _anim.has_animation(scrub_anim_name):
			_anim.get_animation(scrub_anim_name).loop_mode = Animation.LOOP_LINEAR
			_anim.play(scrub_anim_name)
			_anim.pause()
	set_following(false) # Default to "worn" until Player.gd says otherwise.

## active=true: trails the target as a loose companion (top_level, so its
## global transform is independent of the Player root it's parented
## under). active=false: rigidly worn at worn_transform, same as the
## original fixed-offset DreamerBody behavior.
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

	if _anim and _anim.has_animation(scrub_anim_name):
		var moved := global_position.distance_to(_last_pos)
		var anim_length: float = _anim.get_animation(scrub_anim_name).length
		var advance: float = moved * scrub_cycles_per_meter * anim_length
		var new_pos: float = fmod(_anim.current_animation_position + advance, anim_length)
		_anim.seek(new_pos, true)
	_last_pos = global_position
