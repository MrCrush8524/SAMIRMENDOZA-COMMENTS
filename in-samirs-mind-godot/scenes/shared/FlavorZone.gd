extends Area3D
## Ambient signage for a themed zone (a mall wing, a museum gallery...) —
## shows a line of flavor text while the player is standing in it, no
## interaction required. Cheap way to carry the source map's per-room
## labels into the game before any real signage art exists.

@export var flavor_text: String = ""

func _ready() -> void:
	body_entered.connect(_on_entered)
	body_exited.connect(_on_exited)

func _on_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		UiRoot.set_prompt(flavor_text)

func _on_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		UiRoot.set_prompt("")
