extends Node3D
## Applies a per-dreamer fur look to the rigged low-poly cat body
## (assets/models/lowpoly_cat/cat_rigged.fbx) - the mesh ships with real
## UVs and real skin weights but no material at all.
##
## Two modes:
## - Uniform coat (Luna, Mateo): body_texture == points_texture, so the
##   shader's blend is a no-op and the whole cat just gets one texture.
## - Two-tone "points" coat (Bobby): a lighter body_texture and a darker
##   points_texture, blended per-vertex by dreamer_cat_fur.gdshader using
##   a mask this script bakes from the mesh's own bone weights - whichever
##   bone influences a vertex most decides body vs. points, so it's
##   accurate regardless of the mesh's rest pose (unlike guessing from
##   raw vertex position).
##
## The vertex-color mask only depends on the mesh's own rig, never on
## which dreamer is selected, so it's baked once in _ready(). Switching
## dreamers later (Player.refresh_dreamer_visuals, via the pause menu)
## just calls set_textures() again to swap the material's two textures -
## no need to rebuild the mesh a second time.

@export var body_texture: Texture2D
@export var points_texture: Texture2D
@export var mesh_node_path: NodePath
@export var skeleton_path: NodePath

## Bone name substrings that count as "points" (ears/face/legs/tail);
## everything else (pelvis/body/neck) is the base coat color.
const POINTS_BONE_KEYWORDS := ["leg_", "tail_", "ear_", "head"]

@onready var _mesh_node: MeshInstance3D = get_node_or_null(mesh_node_path)
@onready var _skel: Skeleton3D = get_node_or_null(skeleton_path)
var _material: ShaderMaterial

func _ready() -> void:
	if not _mesh_node or not _skel:
		push_warning("DreamerCatSkin: mesh_node_path/skeleton_path did not resolve on %s" % name)
		return
	_bake_points_mask()
	_material = ShaderMaterial.new()
	_material.shader = load("res://scenes/shared/dreamer_cat_fur.gdshader")
	_mesh_node.set_surface_override_material(0, _material)
	if body_texture and points_texture:
		set_textures(body_texture, points_texture)

func set_textures(new_body_texture: Texture2D, new_points_texture: Texture2D) -> void:
	body_texture = new_body_texture
	points_texture = new_points_texture
	if not _material:
		return
	_material.set_shader_parameter("body_texture", body_texture)
	_material.set_shader_parameter("points_texture", points_texture)

func _bake_points_mask() -> void:
	var mesh: ArrayMesh = _mesh_node.mesh
	var arrays := mesh.surface_get_arrays(0)
	var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
	var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
	var vertex_count: int = arrays[Mesh.ARRAY_VERTEX].size()

	var points_bone_ids := {}
	for i in _skel.get_bone_count():
		var bone_name := _skel.get_bone_name(i).to_lower()
		for kw in POINTS_BONE_KEYWORDS:
			if kw in bone_name:
				points_bone_ids[i] = true
				break

	var colors := PackedColorArray()
	colors.resize(vertex_count)
	for v in vertex_count:
		# 4 bone/weight slots per vertex (Godot's default skin format);
		# pick whichever slot has the highest weight for this vertex.
		var best_bone := -1
		var best_weight := -1.0
		for slot in 4:
			var idx = v * 4 + slot
			if weights[idx] > best_weight:
				best_weight = weights[idx]
				best_bone = bones[idx]
		var is_points: bool = points_bone_ids.has(best_bone)
		colors[v] = Color(1.0, 0.0, 0.0) if is_points else Color(0.0, 0.0, 0.0)

	arrays[Mesh.ARRAY_COLOR] = colors
	var new_mesh := ArrayMesh.new()
	new_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	# Re-bind the skeleton skin so the recreated surface still deforms
	# with the rig instead of rendering in bind pose.
	_mesh_node.mesh = new_mesh
	_mesh_node.skin = _mesh_node.skin if _mesh_node.skin else _skel.create_skin_from_rest_transforms()
