extends Node3D
## Tints an imported person model's existing material (keeping its real
## texture detail) so the same source mesh can stand in for multiple
## distinct-looking background figures instead of importing/duplicating
## the asset once per color. Multiplies the base albedo texture by
## `tint`, same effect as the project's pastel-recolor pass elsewhere,
## just done at material level instead of baking new texture files.

const NORMAL_MAP := preload("res://assets/models/people/nathan/tex/rp_nathan_animated_003_norm.jpg")

@export var tint: Color = Color.WHITE
@export var mesh_node_path: NodePath

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
