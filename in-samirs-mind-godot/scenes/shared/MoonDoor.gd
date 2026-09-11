extends Area3D
## Asleep until the required discoveries are made; then lights up and
## announces itself, per MASTER_REBUILD_BRIEF.md's Moon Door requirement.

@onready var glow: OmniLight3D = $Glow

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(delta: float) -> void:
	var ready_to_open := GameState.journals.size() >= 3 and GameState.memory_cats.size() >= 1
	glow.light_energy = (0.9 + sin(Time.get_ticks_msec() * 0.004) * 0.3) if ready_to_open else 0.05
	if ready_to_open and _player_inside:
		UiRoot.set_prompt("The Moon Door is awake. Press E to step through.")
		if Input.is_action_just_pressed("interact"):
			_trigger_transition()

func _trigger_transition() -> void:
	UiRoot.show_journal("The Moon Door opens onto a hallway that was not there before.")
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_chapter("chapter02")
