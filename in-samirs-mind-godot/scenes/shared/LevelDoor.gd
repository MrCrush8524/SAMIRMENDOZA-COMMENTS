extends Area3D
## A door in Chapter I leading to one of the standalone dreamcore levels.
## Same interact-when-inside pattern as MoonDoor/NightmareDoor, generic
## over destination so one script covers all of Level 4/Zoo/Terminal/
## Museum/Liminal Junction rather than needing a script each.

@export var chapter_id: String = ""
@export var spawn_marker: String = "start"
@export var random_spawn_candidates: Array[String] = []
@export var door_label: String = "a door"

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to step through %s." % door_label)
		if Input.is_action_just_pressed("interact"):
			_step_through()

func _step_through() -> void:
	UiRoot.set_prompt("")
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		SaveManager.save_game()
		game_root.enter_side_level(chapter_id, spawn_marker, random_spawn_candidates)
