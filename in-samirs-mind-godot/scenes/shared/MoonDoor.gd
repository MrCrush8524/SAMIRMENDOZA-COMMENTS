extends Area3D
## Asleep until the required discoveries are made; then lights up and
## announces itself, per MASTER_REBUILD_BRIEF.md's Moon Door requirement.

@onready var glow: OmniLight3D = $Glow

var _player_inside: bool = false
var _was_ready: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)
	_was_ready = _is_ready_to_open()

func _is_ready_to_open() -> bool:
	return GameState.journals.size() >= 3 and GameState.memory_cats.size() >= 3

func _process(_delta: float) -> void:
	var ready_to_open := _is_ready_to_open()
	if ready_to_open and not _was_ready:
		_awaken()
	_was_ready = ready_to_open

	glow.light_energy = (0.9 + sin(Time.get_ticks_msec() * 0.004) * 0.3) if ready_to_open else 0.05
	if _player_inside:
		if ready_to_open:
			UiRoot.set_prompt("The Moon Door is awake. Press E to step through.")
			if Input.is_action_just_pressed("interact"):
				_trigger_transition()
		else:
			UiRoot.set_prompt("The door is asleep.")
			if Input.is_action_just_pressed("interact"):
				UiRoot.flash_toast("The door is asleep. It isn't ready for you yet.")

## Fires once, the moment the 3rd Memory Cat or Journal Fragment (whichever
## completes both sets) is found — not tied to the player being nearby,
## since the discovery that completes it could happen anywhere in the
## laundromat. The vestibule itself lighting up is what draws them back.
func _awaken() -> void:
	UiRoot.flash_toast("Something in the Moon Vestibule just woke up.", 2.2)

func _trigger_transition() -> void:
	UiRoot.show_journal("The Moon Door opens onto a hallway that was not there before.")
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_chapter("chapter02")
