extends Node3D
## Chapter VIII — Level 0 (Master Build Brief section 13). New standalone
## chapter, used by itself with no second major scene attached. A dense
## floor-height scan during authoring found a consistent flat floor at
## y~3.6 across most of the level's huge footprint (with scattered
## elevated platforms around y~8.9), used for the spawn point.
##
## Section 18.1: Level 0 (~7385 meshes) ships as thousands of separate
## mesh instances - merged down to one draw call per material via
## MeshMerger instead of shipped unchanged.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")
const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
	WorldContainment.enclose(self, [self])
