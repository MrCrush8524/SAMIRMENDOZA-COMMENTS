extends Node3D
## Chapter IV — Double Airport (Master Build Brief section 9). Full
## replacement of the old "Above the Street" content. Two instances of
## the same airport scene are placed end-to-end along its long axis (Z,
## ~808m) with a 20m overlap at the shared tarmac - confirmed flat and
## continuous there via a floor-height raycast scan during authoring -
## so the player walks continuously from Airport A into Airport B.

const PosterSpawner := preload("res://scenes/shared/PosterSpawner.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			_generate_collision(node)
	PosterSpawner.attach(self, "../start", 30.0)

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)
