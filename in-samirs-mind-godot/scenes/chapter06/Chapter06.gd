extends Node3D
## Chapter VI — Circus: Level Fun + Kitty's House (Master Build Brief
## section 11). New chapter (retires the old "Pink Hallway" chapter06
## content). Level Fun turned out to be mostly an elevated tube/track
## structure rather than a ground-level floor - a dense raycast scan
## during authoring found its one genuinely flat, walkable floor patch
## around (x -60..-45, z -30..-15, y~17.24), so Kitty's House is
## attached there rather than at the naive bbox-derived "ground level".
##
## Section 18.1: Level Fun (~5258 meshes) + Kitty's House (~2830 meshes)
## ship as thousands of separate mesh instances - merged down to one
## draw call per material via MeshMerger instead of shipped unchanged.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
