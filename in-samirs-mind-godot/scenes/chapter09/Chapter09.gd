extends Node3D
## Chapter IX — Fuchsia Backrooms: Run + classic Backrooms + PSX Backroom
## (Master Build Brief section 14). New chapter. Run turned out to be an
## enormous (463x844x802m), sparse platform/track structure rather than
## a simple room - a full raycast grid across its bounding box mostly
## missed its actual geometry entirely, so its real floor slabs were
## found directly (lowest large flat MeshInstance3D pieces) rather than
## by raycast sampling. Because Run's own bounding volume dwarfs both
## Backrooms and the PSX Backroom, those two are placed just outside
## Run's full bbox (not merely near its found floor slabs) to avoid
## interpenetrating its geometry, with a small overlap margin at each
## seam - the best verifiable placement given how sparse and irregular
## Run's own structure is.
##
## Retiles/relights the classic Backrooms and PSX Backroom toward the
## fuchsia palette via each chapter's own environment tint rather than
## editing the source materials, keeping them nondestructive per
## section 18.2.
##
## Section 18.1: Run (~10270 meshes) plus Backrooms/PSX ship as
## thousands of separate mesh instances - merged down to one draw call
## per material via MeshMerger before retiling, instead of shipped
## unchanged.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")
const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")
const FUCHSIA_TINT := Color(1.15, 0.65, 0.95, 1.0)

@export var environment_roots: Array[NodePath] = []
@export var retile_fuchsia_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
	WorldContainment.enclose(self, [self])
	# Retiling must happen after merging: MeshMerger puts each merged
	# group's material on the MeshInstance3D's own surface override, not
	# on the merged ArrayMesh resource itself.
	for path in retile_fuchsia_roots:
		var node := get_node_or_null(path)
		if node:
			_retile_fuchsia(node)

## Nondestructive hue-shift toward the chapter's fuchsia identity
## (section 18.2/14) - multiplies each surface's existing albedo texture
## by a magenta-leaning tint rather than editing the source material, so
## Backrooms/PSX Backroom read as part of the same dream world as Run
## without altering assets/models/imported themselves.
func _retile_fuchsia(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		for i in node.mesh.get_surface_count():
			var base: Material = node.get_surface_override_material(i)
			if base == null:
				base = node.mesh.surface_get_material(i)
			var mat := StandardMaterial3D.new()
			if base is BaseMaterial3D:
				mat.albedo_texture = base.albedo_texture
				mat.roughness = base.roughness
			mat.albedo_color = FUCHSIA_TINT
			node.set_surface_override_material(i, mat)
	for c in node.get_children():
		_retile_fuchsia(c)
