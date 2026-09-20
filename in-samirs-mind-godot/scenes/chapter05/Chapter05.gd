extends Node3D
## Chapter V — Cyber Mega City (Master Build Brief section 10). New
## chapter (the old "Pastel Dreamscape" chapter05 content is retired per
## the full-replacement decision). One continuous cyberpunk_city.glb;
## at least 5 required hidden items drawn from a larger validated pool,
## distributed across the block rather than clustered.

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			_generate_collision(node)

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)
