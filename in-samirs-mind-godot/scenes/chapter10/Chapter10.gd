extends Node3D
## Chapter X — Baby Blue Backrooms: Level 15 (Master Build Brief section
## 15). New standalone chapter, used by itself (no second scene
## attached). Level 15 is sparse and wide (471x357m footprint, only 10m
## tall) - a full-bbox raycast grid mostly missed its geometry, so its
## real floor slabs were located directly (lowest large flat
## MeshInstance3D pieces) for the spawn point, same technique as
## Chapter 9's Run.
##
## Section 18.1: Level 15 (~4335 meshes) ships as thousands of separate
## mesh instances - merged down to one draw call per material via
## MeshMerger instead of shipped unchanged.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
