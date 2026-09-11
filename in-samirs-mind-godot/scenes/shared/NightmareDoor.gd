extends Area3D
## An ordinary door that betrays into a hidden Nightmare Passage, per
## MASTER_REBUILD_BRIEF.md: "Ordinary doors can betray into hidden
## nightmare environments. Assignments can randomize per dream."
##
## The assignment is rolled once (first time this door is seen) and then
## kept in GameState.nightmare_assignments for the rest of the run, so
## reloading the chapter doesn't re-roll a door the player already knows.

@export var door_id: String = ""
@export var possible_types: Array[String] = ["decay", "wander", "arcade"]

@onready var glow: OmniLight3D = $Glow

var _player_inside: bool = false

func _ready() -> void:
	if door_id.is_empty():
		push_error("NightmareDoor: door_id must be set (used as the save-persisted assignment key)")
	if not GameState.nightmare_assignments.has(door_id):
		GameState.nightmare_assignments[door_id] = possible_types[randi() % possible_types.size()]
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside and not GameState.in_nightmare:
		UiRoot.set_prompt("Something's off about this door. Press E to open it.")
		if Input.is_action_just_pressed("interact"):
			_step_through()

func _step_through() -> void:
	UiRoot.set_prompt("")
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.enter_nightmare(GameState.nightmare_assignments[door_id])
