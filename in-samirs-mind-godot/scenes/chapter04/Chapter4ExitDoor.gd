extends Area3D
## Chapter IV exit — the Final Observation Roof's railing gap, unlocked
## once the roofline has given up all 3 of its journal fragments and all
## 3 rooftop discoveries. Same shape as Chapter III's BackExitDoor.gd,
## kept as its own small script since that one's unlock condition is
## hardcoded to Chapter III's own journal ids and room-check count.

@export var locked_prompt: String = "Whatever is up here, it is not finished with you yet."
@export var locked_toast: String = "Find what the roofs are hiding first."
@export var unlocked_prompt: String = "The sky past the railing is open. Press E to go through."
@export var unlock_toast: String = "The last discovery settles into place. The way up opens."
@export var transition_text: String = "You step past the railing, and the roofline stops being under you."
@export var destination_chapter: String = "chapter05"
@export var destination_spawn_marker: String = "start"

@onready var deadbolt_light: OmniLight3D = $Light

var _player_inside: bool = false
var _was_ready: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)
	_was_ready = _is_ready_to_open()
	GameState.chapter4_exit_unlocked = _was_ready

func _is_ready_to_open() -> bool:
	return GameState.journals.has(6) and GameState.journals.has(7) and GameState.journals.has(8) \
		and GameState.chapter4_discoveries.size() >= 3

func _process(_delta: float) -> void:
	var ready_to_open := _is_ready_to_open()
	if ready_to_open and not _was_ready:
		_unlock()
	_was_ready = ready_to_open

	deadbolt_light.light_energy = (0.6 + sin(Time.get_ticks_msec() * 0.003) * 0.2) if ready_to_open else 0.0

	if _player_inside:
		if ready_to_open:
			UiRoot.set_prompt(unlocked_prompt)
			if Input.is_action_just_pressed("interact"):
				_trigger_transition()
		else:
			UiRoot.set_prompt(locked_prompt)
			if Input.is_action_just_pressed("interact"):
				UiRoot.flash_toast(locked_toast)

func _unlock() -> void:
	GameState.chapter4_exit_unlocked = true
	UiRoot.flash_toast(unlock_toast, 2.2)
	SaveManager.save_game()

func _trigger_transition() -> void:
	UiRoot.show_journal(transition_text)
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_chapter(destination_chapter, destination_spawn_marker)
