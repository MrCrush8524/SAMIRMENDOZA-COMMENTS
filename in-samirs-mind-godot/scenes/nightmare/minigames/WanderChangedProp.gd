extends Area3D
## One selectable object in "What Changed?" — reports its own index back
## to the minigame controller when interacted with, same
## has_method("interact") contract Player._try_interact already uses
## for pickups/doors.

@export var prop_index: int = 0

func interact() -> void:
	get_parent()._on_prop_selected(prop_index)
