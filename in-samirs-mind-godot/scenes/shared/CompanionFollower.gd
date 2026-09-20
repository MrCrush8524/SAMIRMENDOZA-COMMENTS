extends Node3D
## Master Build Brief 4.3: whichever of Nathan/the cat isn't the current
## embodiment (GameState.embodiment, see Player.set_embodiment) walks
## alongside as a paired companion instead of vanishing. `top_level =
## true` decouples this node's global transform from its parent (the
## Player CharacterBody3D) so it can trail a beat behind rather than
## being rigidly glued to the camera the way the "worn" body is.

@export var follow_target_path: NodePath
@export var offset := Vector3(0.7, 0.0, 0.9) # local to the player's facing: +x right, +z behind
@export var follow_lerp := 5.0

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
	global_position = global_position.lerp(desired, clampf(follow_lerp * delta, 0.0, 1.0))
	rotation.y = _target.rotation.y

	if _anim and _anim.has_animation(scrub_anim_name):
		var moved := global_position.distance_to(_last_pos)
		var anim_length: float = _anim.get_animation(scrub_anim_name).length
		var advance: float = moved * scrub_cycles_per_meter * anim_length
		var new_pos: float = fmod(_anim.current_animation_position + advance, anim_length)
		_anim.seek(new_pos, true)
	_last_pos = global_position
