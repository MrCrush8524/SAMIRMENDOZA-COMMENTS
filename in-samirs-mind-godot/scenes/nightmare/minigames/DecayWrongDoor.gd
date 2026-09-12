extends NightmareMinigame
## "Wrong Door" — DECAY: three identical doors, only one leads out. The
## wrong two are decoys with no tell beyond a coin flip — picking one
## ends the round immediately, same as running out of time.

const DOOR_COUNT := 3

@export var base_round_time: float = 18.0

@onready var doors: Array[Area3D] = [$Door0, $Door1, $Door2]

var _round_time: float = 0.0
var _correct_index: int = 0
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_round_time = maxf(8.0, base_round_time - float(depth - 1) * 1.5)
	_correct_index = randi() % DOOR_COUNT
	_resolved_flag = false
	UiRoot.set_prompt("Pick a door.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)

func _on_pad_selected(index: int) -> void:
	if _resolved_flag:
		return
	_finish(index == _correct_index)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
