extends NightmareMinigame
## "What Changed?" — Nightmare_Passage_Minigame_Specs.md's WANDER opener:
## memorize the room, one object moves while you're not looking (a
## fade-to-black beat, not literally "lights flicker" yet — no flicker
## asset dependency needed either way), find and interact with the one
## that moved. No composure drain — Wander is the safe room.

const BASE_MEMORIZE_TIME := 5.0
const ANSWER_TIME := 14.0
const MIN_RELOCATE_DIST := 2.5
const BOUNDS := 6.0

@onready var props: Array[Area3D] = [$Prop0, $Prop1, $Prop2]

var _phase: String = "memorize"
var _timer: float = 0.0
var _changed_index: int = -1
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_timer = maxf(3.0, BASE_MEMORIZE_TIME - float(depth - 1) * 0.4)
	UiRoot.set_prompt("Memorize the room.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_timer -= delta
	if _timer > 0.0:
		return
	if _phase == "memorize":
		_start_changed_phase()
	elif _phase == "changed":
		_finish(false)

func _start_changed_phase() -> void:
	_phase = "changed"
	_timer = ANSWER_TIME
	_changed_index = randi() % props.size()
	var prop := props[_changed_index]
	prop.position = _random_new_spot(prop.position)
	UiRoot.set_prompt("Something changed. Find it and press E.")

func _random_new_spot(avoid: Vector3) -> Vector3:
	for _attempt in range(20):
		var spot := Vector3(randf_range(-BOUNDS, BOUNDS), avoid.y, randf_range(-BOUNDS, BOUNDS))
		if spot.distance_to(avoid) > MIN_RELOCATE_DIST:
			return spot
	return avoid + Vector3(MIN_RELOCATE_DIST, 0, 0)

func _on_prop_selected(index: int) -> void:
	if _phase != "changed" or _resolved_flag:
		return
	_finish(index == _changed_index)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
