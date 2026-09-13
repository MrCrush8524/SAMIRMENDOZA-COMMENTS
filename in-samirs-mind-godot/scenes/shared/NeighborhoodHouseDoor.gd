extends Area3D
## One of the neighborhood's houses — locked and unremarkable until the
## player has found all of the required discoveries, then it wakes up and
## becomes the real entrance into Chapter III. Same asleep-then-lit pattern
## as MoonDoor.gd, but framed as a house that was always there rather than
## a new teleport.

## The 3 required House/Porch Discoveries (see StoryProp.gd) — shoes,
## mail, wind chime. Checked by exact id rather than a raw count so the
## older ambient park/gazebo/field discoveries (still around as bonus
## flavor) can't accidentally satisfy the gate on their own.
const REQUIRED_IDS := ["porch_shoes", "porch_mail", "porch_chime"]

@onready var glow: OmniLight3D = $Glow

var _player_inside: bool = false

func _is_ready_to_open() -> bool:
	for id in REQUIRED_IDS:
		if not GameState.neighborhood_discoveries.has(id):
			return false
	return true

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	var ready_to_open := _is_ready_to_open()
	glow.light_energy = (0.9 + sin(Time.get_ticks_msec() * 0.004) * 0.3) if ready_to_open else 0.05
	if ready_to_open and _player_inside:
		UiRoot.set_prompt("A house that was always here has its door open now. Press E to step through.")
		if Input.is_action_just_pressed("interact"):
			_trigger_transition()

func _trigger_transition() -> void:
	UiRoot.show_journal("The house that was never home to anyone lets you in.")
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_chapter("chapter03")
