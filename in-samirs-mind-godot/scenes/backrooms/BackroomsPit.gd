extends Area3D
## A floor gap in the Backrooms ("Bottomless pool", the map's other
## marked holes/crevices). Per the design note: falling in punishes
## exploration progress hard — resets backrooms_level to 1 regardless of
## how deep the player had gotten — but never sends them all the way
## back to the real chapter. Players must actively avoid these.

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.backrooms_pit_fall()
