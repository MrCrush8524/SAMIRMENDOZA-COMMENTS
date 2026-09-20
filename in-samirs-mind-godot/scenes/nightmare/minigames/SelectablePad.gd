extends Area3D
## Generic interactable pad that reports its own value back to the parent
## minigame controller, which must implement _on_pad_selected(value).
## Reused by any minigame with a "press the right one(s), in order or
## not" mechanic instead of a bespoke selection script per minigame.

@export var pad_value: int = 0

func interact() -> void:
	get_parent()._on_pad_selected(pad_value)
