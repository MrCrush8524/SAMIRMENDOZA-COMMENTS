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
##
## The 12 PSA posters get scattered as free-standing signs via
## PosterSpawner, which discovers real floor collision at runtime
## rather than using hand-placed spots - centered on "start" with a
## wide enough radius to reach into Level Fun too, whose track geometry
## has no confirmed floor per the note above; PosterSpawner's own floor
## check is what keeps a sign from ever landing over open air there.

const MeshMerger := preload("res://scenes/shared/MeshMerger.gd")
const PosterSpawner := preload("res://scenes/shared/PosterSpawner.gd")
const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			MeshMerger.merge_and_collide(node)
	WorldContainment.enclose(self, [self])
	PosterSpawner.attach(self)
