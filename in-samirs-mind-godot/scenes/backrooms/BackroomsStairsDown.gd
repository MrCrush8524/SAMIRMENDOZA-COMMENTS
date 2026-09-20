extends Area3D
## The map's "Long stairway down" — stepping onto it commits the player
## one level deeper into the Backrooms, actually loading level2's own
## geometry (darker, tighter, more hazards) rather than just bumping a
## counter with nothing behind it.

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		monitoring = false # one commit per visit — walking back over it doesn't stack
		UiRoot.set_prompt("")
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.backrooms_go_deeper()
		UiRoot.show_journal("The stairs keep going. You're deeper now.")
