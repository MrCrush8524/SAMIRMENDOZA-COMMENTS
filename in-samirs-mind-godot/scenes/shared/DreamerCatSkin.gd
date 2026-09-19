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

@export var body_texture: Texture2D
@export var points_texture: Texture2D
@export var mesh_node_path: NodePath
@export var skeleton_path: NodePath

## Bone name substrings that count as "points" (ears/face/legs/tail);
## everything else (pelvis/body/neck) is the base coat color.
const POINTS_BONE_KEYWORDS := ["leg_", "tail_", "ear_", "head"]

func _ready() -> void:
	var mesh_node: MeshInstance3D = get_node_or_null(mesh_node_path)
	var skel: Skeleton3D = get_node_or_null(skeleton_path)
	if not mesh_node or not skel:
		push_warning("DreamerCatSkin: mesh_node_path/skeleton_path did not resolve on %s" % name)
		return
	if not body_texture or not points_texture:
		return

	var mesh: ArrayMesh = mesh_node.mesh
	var arrays := mesh.surface_get_arrays(0)
	var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
	var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
	var vertex_count: int = arrays[Mesh.ARRAY_VERTEX].size()

	var points_bone_ids := {}
	for i in skel.get_bone_count():
		var bone_name := skel.get_bone_name(i).to_lower()
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
	mesh_node.mesh = new_mesh
	mesh_node.skin = mesh_node.skin if mesh_node.skin else skel.create_skin_from_rest_transforms()

	var mat := ShaderMaterial.new()
	mat.shader = load("res://scenes/shared/dreamer_cat_fur.gdshader")
	mat.set_shader_parameter("body_texture", body_texture)
	mat.set_shader_parameter("points_texture", points_texture)
	mesh_node.set_surface_override_material(0, mat)
