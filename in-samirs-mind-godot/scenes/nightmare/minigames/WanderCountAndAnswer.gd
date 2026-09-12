extends NightmareMinigame
## "Count and Answer" — WANDER: count the marked objects in the room,
## then press the numbered pad matching the count. No punishment beyond
## the round clock for a wrong guess — just try again.

@export var base_round_time: float = 22.0

@onready var count_targets: Array[Node3D] = [$Countable0, $Countable1, $Countable2, $Countable3, $Countable4]
@onready var pads: Array[Area3D] = [$Pad1, $Pad2, $Pad3, $Pad4, $Pad5]

var _round_time: float = 0.0
var _correct_count: int = 0
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_round_time = maxf(10.0, base_round_time - float(depth - 1) * 1.5)
	_resolved_flag = false
	_reroll_count()
	UiRoot.set_prompt("Count what's lit, then press the matching number.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)

func _reroll_count() -> void:
	_correct_count = 1 + (randi() % count_targets.size())
	for i in count_targets.size():
		count_targets[i].visible = i < _correct_count

func _on_pad_selected(value: int) -> void:
	if _resolved_flag:
		return
	if value == _correct_count:
		_finish(true)
	else:
		_reroll_count()

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
