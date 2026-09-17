extends Area3D
## The far end of a walkway in Chapter I's Impossible Door Gallery,
## leading to one of the standalone dreamcore levels. No door, no
## interact prompt - each gallery opening is a real corridor now, and
## reaching the end of it steps you through immediately, the way
## actually walking somewhere should work. Generic over destination so
## one script covers all of Level 4/Zoo/Terminal/Museum/Liminal
## Junction rather than needing a script each.

@export var chapter_id: String = ""
@export var spawn_marker: String = "start"
@export var random_spawn_candidates: Array[String] = []

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		SaveManager.save_game()
		game_root.enter_side_level(chapter_id, spawn_marker, random_spawn_candidates)
