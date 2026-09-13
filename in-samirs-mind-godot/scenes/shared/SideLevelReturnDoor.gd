extends Area3D
## Sends the player back to the Impossible Door Gallery, at the exact
## spot they stood when they stepped through this level's entry door —
## the position GameRoot.enter_side_level() stashed on the way in.

@export var return_label: String = "the way back to the laundromat"

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to return to %s." % return_label)
		if Input.is_action_just_pressed("interact"):
			_step_through()

func _step_through() -> void:
	UiRoot.set_prompt("")
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.exit_side_level()
