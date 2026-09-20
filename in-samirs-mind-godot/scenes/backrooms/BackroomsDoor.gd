extends Area3D
## One of several scattered Backrooms exit doors. Exactly one id matches
## GameState.backrooms_door_target each trip — going through that one
## leads the player out to the GENERAL area they were in before (a small
## random nudge from their exact spot), not the precise position the way
## the artifact does. Every other door is a decoy: it just doesn't open.

@export var door_id: String = ""
@export var flavor_name: String = "a door"

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to try %s." % flavor_name)
		if Input.is_action_just_pressed("interact"):
			_try_door()

func _try_door() -> void:
	UiRoot.set_prompt("")
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if door_id == GameState.backrooms_door_target:
		if game_root:
			game_root.exit_backrooms_via_door()
	else:
		UiRoot.show_journal("%s doesn't open onto anywhere real." % flavor_name.capitalize())
