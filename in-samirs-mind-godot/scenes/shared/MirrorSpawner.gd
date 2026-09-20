extends Node3D
## Randomly seeds MirrorSurface instances at a curated set of candidate
## spots. Curated, not literal random world coordinates, so a mirror can
## never spawn clipped into a wall or blocking a doorway — each child
## Marker3D under this node is a designer-approved spot already flush
## against a wall and clear of geometry; this script just rolls, per
## spot, whether a mirror actually appears there this run.

const MIRROR_SCENE := preload("res://scenes/shared/MirrorSurface.tscn")

## Fraction of candidate spots that get a mirror each time this level
## loads — re-rolled fresh every visit, so "which walls reflect" varies
## run to run without ever changing where the *candidates* are.
@export_range(0.0, 1.0) var spawn_chance: float = 0.6

func _ready() -> void:
	for spot in get_children():
		if not (spot is Marker3D):
			continue
		if randf() < spawn_chance:
			var mirror := MIRROR_SCENE.instantiate()
			mirror.transform = spot.transform
			get_parent().add_child.call_deferred(mirror)
