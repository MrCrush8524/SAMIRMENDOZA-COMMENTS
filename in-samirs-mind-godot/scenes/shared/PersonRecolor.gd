extends Node3D
## Tints an imported person model's existing material (keeping its real
## texture detail) so the same source mesh can stand in for multiple
## distinct-looking background figures instead of importing/duplicating
## the asset once per color. Multiplies the base albedo texture by
## `tint`, same effect as the project's pastel-recolor pass elsewhere,
## just done at material level instead of baking new texture files.

const NORMAL_MAP := preload("res://assets/models/people/nathan/tex/rp_nathan_animated_003_norm.jpg")
const WALK_ANIM := "Take 001"

@export var tint: Color = Color.WHITE
@export var mesh_node_path: NodePath

## true (Player.gd's worn NathanBody): the walk cycle is paused and left
## for an external controller (Player._update_body_animation) to scrub
## by distance moved, mirroring how DreamerBody's cat cycle already
## works - so a stationary player doesn't keep walking in place, and
## movement speed matches stride speed instead of a flat loop rate.
## false (a decorative background figure, if this script is ever reused
## for one): keeps the original free-running loop with a randomized
## start offset so multiple instances don't move in unison.
@export var movement_driven: bool = true

func _ready() -> void:
	var mesh_node: MeshInstance3D = get_node_or_null(mesh_node_path)
	if not mesh_node:
		push_warning("PersonRecolor: mesh_node_path did not resolve on %s" % name)
		return
	var base: Material = mesh_node.mesh.surface_get_material(0)
	var mat := StandardMaterial3D.new()
	if base is BaseMaterial3D:
		mat.albedo_texture = base.albedo_texture
		mat.roughness = base.roughness
	mat.albedo_color = Color(tint.r, tint.g, tint.b, 1.0)
	# The FBX import only auto-wires albedo; the real high-poly detail
	# (wrinkles, seams, fabric weave) is in the normal map, unused unless
	# hooked up by hand.
	mat.normal_enabled = true
	mat.normal_texture = NORMAL_MAP
	mesh_node.set_surface_override_material(0, mat)
	_prepare_walk_anim()

## Nothing plays this FBX's own animation by default (autoplay is blank,
## same as every other FBX import) - left alone, the rig just sits in
## its raw rest pose, which for this asset is a mid-stride keyframe with
## one arm thrown almost straight out to the side, not a neutral stand.
## Setting LOOP_LINEAR and parking at frame 0 gives a single fixed pose
## to stand in whenever movement_driven leaves scrubbing to an external
## controller (frame 0 is the best available neutral-ish stand-in among
## this clip's keyframes without a rendered check - flag for Samir to
## confirm visually and adjust if it still reads as mid-stride).
func _prepare_walk_anim() -> void:
	var anim_player: AnimationPlayer = get_node_or_null("AnimationPlayer")
	if not anim_player or not anim_player.has_animation(WALK_ANIM):
		return
	var anim: Animation = anim_player.get_animation(WALK_ANIM)
	anim.loop_mode = Animation.LOOP_LINEAR
	if movement_driven:
		anim_player.play(WALK_ANIM)
		anim_player.seek(0.0, true)
		anim_player.pause()
	else:
		anim_player.play(WALK_ANIM)
		anim_player.seek(randf() * anim.length, true)
