extends Node3D
## Applies a per-dreamer fur texture to the rigged low-poly cat body
## (assets/models/lowpoly_cat/cat_rigged.fbx) - the mesh ships with real
## UVs but no material at all, so each dreamer just needs their own
## texture assigned here rather than a tint (unlike PersonRecolor.gd's
## Nathan statues, these have real per-character fur patterns, not a
## single shared photo re-tinted).

@export var fur_texture: Texture2D
@export var mesh_node_path: NodePath

func _ready() -> void:
	var mesh_node: MeshInstance3D = get_node_or_null(mesh_node_path)
	if not mesh_node:
		push_warning("DreamerCatSkin: mesh_node_path did not resolve on %s" % name)
		return
	if not fur_texture:
		return
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = fur_texture
	mat.roughness = 0.9
	mesh_node.set_surface_override_material(0, mat)
