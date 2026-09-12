extends Area3D
## The way back from level2 to level1 — climbing up, not finding an
## artifact/door (those exit the Backrooms entirely; this just backs
## off one level of depth).

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		monitoring = false
		UiRoot.set_prompt("")
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.backrooms_go_up()
		UiRoot.show_journal("The stairs lead back up. Level 1 again.")
