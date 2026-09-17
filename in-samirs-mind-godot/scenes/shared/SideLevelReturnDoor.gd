extends Area3D
## The far end of the walkway back to the Impossible Door Gallery, at
## the exact spot the player stood when they stepped through this
## level's entry corridor - the position GameRoot.enter_side_level()
## stashed on the way in. No door, no interact prompt - walking through
## steps you back immediately, matching the entry corridor's own
## walk-through behavior.

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.exit_side_level()
