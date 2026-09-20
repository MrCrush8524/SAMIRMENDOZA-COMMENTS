extends Node3D
## Chapter II — Level 94 (Master Build Brief section 7). Full
## replacement of the old scenes/chapter02 content. Preserves the
## supplied Rec Room level as-is: a vast open area with tiny exterior-
## only houses scattered through it. No-clipping becomes active from
## this chapter onward.
##
## Section 18.1: Level 94 ships as ~3880 separate mesh instances (Rec
## Room's native shape-container export format) - merged down to one
## draw call per material via MeshMerger instead of shipped unchanged.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
