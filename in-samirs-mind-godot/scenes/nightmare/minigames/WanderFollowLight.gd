extends NightmareMinigame
## "Follow the Light" — WANDER: several lamps burn at different
## brightnesses; the dimmest one is the way through. No composure risk —
## picking wrong just resets the room's lamps, per Wander's safe framing,
## except the round clock keeps running.

@export var base_round_time: float = 20.0

@onready var lamps: Array[Area3D] = [$Lamp0, $Lamp1, $Lamp2, $Lamp3]

var _round_time: float = 0.0
var _correct_index: int = 0
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_round_time = maxf(10.0, base_round_time - float(depth - 1) * 1.5)
	_resolved_flag = false
	_reroll_lamps()
	UiRoot.set_prompt("Follow the dimmest light.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)

func _reroll_lamps() -> void:
	_correct_index = randi() % lamps.size()
	for i in lamps.size():
		var light: OmniLight3D = lamps[i].get_node("Light")
		light.light_energy = 0.2 if i == _correct_index else randf_range(0.7, 1.1)

func _on_pad_selected(index: int) -> void:
	if _resolved_flag:
		return
	if index == _correct_index:
		_finish(true)
	else:
		_reroll_lamps()

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
