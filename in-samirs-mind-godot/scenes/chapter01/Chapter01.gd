extends Node3D
## Chapter I — Memory Laundromat + Small City (Master Build Brief
## section 6). Full replacement of the old "Memory Atrium" build: the
## brief's chapter map uses entirely different worlds under the same
## chapter ids, not an extension of the old content.
##
## The laundromat and the 4 tiled city blocks are raw imported GLBs with
## no authored collision, so it's generated once here at load time -
## same technique as NoClipPrisonEnvironment.gd uses for the backrooms_vr
## pool. No-clipping is OFF for the entire chapter (brief section 6/17.3
## - "No no-clip event may occur in Chapter 1").

const PosterSpawner := preload("res://scenes/shared/PosterSpawner.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = false
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			_generate_collision(node)
	PosterSpawner.attach(self, "../start", 25.0)

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)
