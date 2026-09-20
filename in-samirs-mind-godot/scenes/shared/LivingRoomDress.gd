extends Node3D
## Dresses the "InteriorTest" living room FBX for use as a Downtown
## anomaly prop. The source .rar shipped only the .fbx - none of the
## Texture/ files its materials reference - so every surface imports
## untextured. Rather than leave it grey/pink (Godot's missing-texture
## fallback), this applies flat pastel tints by node-name heuristic so
## it reads as a real room in the game's own palette, not a broken one.
##
## Also strips the FBX's own Camera3D/SpotLight3D helper nodes (authored
## for a render-preview, not gameplay - the camera defaults to inactive
## so it can't hijack the viewport, but there's no reason to carry the
## dead nodes or light cost into a background prop) and the 4 "Spot*"
## lamp-fixture meshes that ship with a corrupted transform stretching
## them to ~4096 units tall (confirmed via an AABB probe - everything
## else in this file is a normal few-meters room; only these are
## broken) - a MESH_SIZE_LIMIT sanity check catches anything similarly
## degenerate rather than hardcoding those 4 names.

const FLOOR_TINT := Color(0.82, 0.68, 0.5)
const WALL_TINT := Color(0.94, 0.9, 0.85)
const CARPET_TINT := Color(0.85, 0.72, 0.78)
const TILE_TINT := Color(0.88, 0.86, 0.82)
const MISC_TINT := Color(0.75, 0.78, 0.85)

## The genuine room geometry tops out around 8 units (its longest wall);
## anything past this is the broken lamp geometry, not real furniture.
const MESH_SIZE_LIMIT := 20.0

## The +Z wall (named exactly "Wall", facing the direction a player
## walking the street from the entrance actually approaches from) is
## the one wall DowntownCity.tscn gives no collision to, so this is a
## real doorless opening rather than a solid-looking wall you can
## nonsensically walk through - the mesh has to go, not just the shape.
const OPEN_WALL_NODE_NAME := "Wall"

func _ready() -> void:
	_dress(self)

func _dress(node: Node) -> void:
	for child in node.get_children():
		if child is Camera3D or child is Light3D:
			child.queue_free()
			continue
		if child is MeshInstance3D and child.name == OPEN_WALL_NODE_NAME:
			child.queue_free()
			continue
		if child is MeshInstance3D and child.mesh:
			if _local_size(child) > MESH_SIZE_LIMIT:
				child.queue_free()
				continue
			var tint := _tint_for(child.name)
			for i in child.mesh.get_surface_count():
				var mat := StandardMaterial3D.new()
				mat.albedo_color = tint
				mat.roughness = 0.85
				child.set_surface_override_material(i, mat)
		_dress(child)

func _local_size(mesh_node: MeshInstance3D) -> float:
	var aabb: AABB = mesh_node.transform * mesh_node.get_aabb()
	return maxf(aabb.size.x, maxf(aabb.size.y, aabb.size.z))

func _tint_for(node_name: String) -> Color:
	var lower := node_name.to_lower()
	if lower.begins_with("floor"):
		return FLOOR_TINT
	if lower.begins_with("wall") or lower.begins_with("plafon"):
		return WALL_TINT
	if lower.begins_with("carpet"):
		return CARPET_TINT
	if lower.begins_with("sidetegel"):
		return TILE_TINT
	return MISC_TINT
