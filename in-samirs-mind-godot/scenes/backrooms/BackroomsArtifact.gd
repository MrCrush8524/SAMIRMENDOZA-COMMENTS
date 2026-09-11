extends Area3D
## One of the 10 (eventually) scattered Backrooms artifacts. Exactly one
## id matches GameState.backrooms_artifact_target each trip — finding
## that one lets the player return to their exact last-safe spot without
## hunting for the exit door. Every other artifact is a harmless decoy:
## flavor text only, doesn't get consumed, so a wrong guess costs nothing
## but the detour.

@export var artifact_id: String = ""
@export var flavor_name: String = "something small"

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to pick up %s." % flavor_name)
		if Input.is_action_just_pressed("interact"):
			_pick_up()

func _pick_up() -> void:
	UiRoot.set_prompt("")
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if artifact_id == GameState.backrooms_artifact_target:
		if game_root:
			game_root.exit_backrooms_via_artifact()
	else:
		UiRoot.show_journal("Just %s. Not what you were looking for." % flavor_name)
