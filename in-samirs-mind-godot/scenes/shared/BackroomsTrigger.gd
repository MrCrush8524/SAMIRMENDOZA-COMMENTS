extends Area3D
## The Lost Passage's entrance has no fixture — it's an invisible spot
## that relocates to a new candidate position every time the chapter
## loads, so the player can't just remember where it was. Walking into
## it drops them straight into the Backrooms, no prompt, no choice —
## "you no clip into it" per the design note. Unlike NightmareDoor, this
## is chance-of-location, not chance-of-triggering: finding it always
## triggers it.

@export var candidate_positions: Array[Vector3] = []

func _ready() -> void:
	if not candidate_positions.is_empty():
		position = candidate_positions[randi() % candidate_positions.size()]
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.enter_backrooms()
