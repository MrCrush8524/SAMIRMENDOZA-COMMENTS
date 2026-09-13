extends Area3D
## Chapter III's Back Exit — the Moon Door's equivalent, but deliberately
## unremarkable: an ordinary back door, present from the start, locked
## until the house has shown itself 3 times over (3 Journal Fragments +
## 3 Room Checks). Never teleports the player — it just unlocks in place
## and waits for them to walk back through the changed house to it.

@onready var deadbolt_light: OmniLight3D = $Light

var _player_inside: bool = false
var _was_ready: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)
	_was_ready = _is_ready_to_open()
	GameState.chapter3_back_exit_unlocked = _was_ready

func _is_ready_to_open() -> bool:
	return GameState.journals.has(3) and GameState.journals.has(4) and GameState.journals.has(5) \
		and GameState.chapter3_room_checks.size() >= 3

func _process(_delta: float) -> void:
	var ready_to_open := _is_ready_to_open()
	if ready_to_open and not _was_ready:
		_unlock()
	_was_ready = ready_to_open

	deadbolt_light.light_energy = (0.6 + sin(Time.get_ticks_msec() * 0.003) * 0.2) if ready_to_open else 0.0

	if _player_inside:
		if ready_to_open:
			UiRoot.set_prompt("The back door is open. Press E to leave.")
			if Input.is_action_just_pressed("interact"):
				_trigger_transition()
		else:
			UiRoot.set_prompt("The handle moves. It doesn't open.")
			if Input.is_action_just_pressed("interact"):
				UiRoot.flash_toast("You can go back. Find the way.")

func _unlock() -> void:
	GameState.chapter3_back_exit_unlocked = true
	UiRoot.flash_toast("Somewhere in the house, a deadbolt turns.", 2.2)
	SaveManager.save_game()

func _trigger_transition() -> void:
	UiRoot.show_journal("The back door is open. The light outside is wrong.")
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_chapter("chapter04")
