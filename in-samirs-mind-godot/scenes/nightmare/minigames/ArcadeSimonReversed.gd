extends NightmareMinigame
## "Simon Says (Reversed)" — ARCADE: the cabinet flashes a sequence and
## its posted instructions say to repeat it in order. The cabinet lies —
## the correct input is the sequence played backwards. A single wrong
## press ends the round.

const SEQUENCE_LENGTH_BASE := 3

@export var base_round_time: float = 20.0

@onready var pads: Array[Area3D] = [$Pad0, $Pad1, $Pad2, $Pad3]

var _round_time: float = 0.0
var _sequence: Array[int] = []
var _expected: Array[int] = []
var _answer_progress: int = 0
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_round_time = maxf(10.0, base_round_time - float(depth - 1) * 1.0)
	var length := SEQUENCE_LENGTH_BASE + int(depth / 2)
	_sequence.clear()
	for _i in length:
		_sequence.append(randi() % pads.size())
	_expected = _sequence.duplicate()
	_expected.reverse()
	_answer_progress = 0
	_resolved_flag = false
	_play_sequence()

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _play_sequence() -> void:
	UiRoot.set_prompt("Watch the cabinet. Press in order... or maybe not.")
	for i in _sequence.size():
		var pad := pads[_sequence[i]]
		var light: OmniLight3D = pad.get_node("Light")
		light.light_energy = 1.2
		await get_tree().create_timer(0.4).timeout
		light.light_energy = 0.1
		await get_tree().create_timer(0.15).timeout
	if not _resolved_flag:
		UiRoot.set_prompt("Press the pads. (The sign lies.)")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)

func _on_pad_selected(index: int) -> void:
	if _resolved_flag or _answer_progress >= _expected.size():
		return
	if index != _expected[_answer_progress]:
		_finish(false)
		return
	_answer_progress += 1
	if _answer_progress >= _expected.size():
		_finish(true)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
