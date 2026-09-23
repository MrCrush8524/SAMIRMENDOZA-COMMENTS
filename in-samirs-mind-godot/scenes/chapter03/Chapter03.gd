extends Node3D
## Chapter III — Giant Poolrooms + Level 37 + Japroom (Master Build
## Brief section 8). Full replacement of the old "House That Knows You"
## content. Poolrooms and Level 37 are placed so their floors align and
## their footprints overlap at the shared edge (verified via floor-height
## raycast scans during authoring - poolrooms' floor sits at world y~1.25
## everywhere, Level 37's local floor at ~4.5, offset accordingly) rather
## than joined through any single named "door" node - neither source
## asset has hand-authored connector geometry, so a validated overlap
## seam is the simplest Godot-native stand-in the brief allows.
##
## The Japroom door location is fixed rather than randomized: the brief
## permits ("may randomize") rather than requires it.

const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			_generate_collision(node)
	WorldContainment.enclose(self, [self])

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)
