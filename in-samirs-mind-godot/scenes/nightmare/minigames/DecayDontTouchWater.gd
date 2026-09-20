extends NightmareMinigame
## "Don't Touch The Water" — Nightmare_Passage_Minigame_Specs.md's DECAY
## opener: cross the room to the safe zone without stepping in a
## corrupted puddle. Puddles reshuffle on a timer; both the round timer
## and the reshuffle timer tighten with nightmare_depth.

const ROOM_HALF_X := 5.5
const ROOM_MIN_Z := -4.5
const ROOM_MAX_Z := 3.5
const SAFE_ZONE_CLEARANCE := 2.2
const START_CLEARANCE := 2.2

@export var puddle_count: int = 5
@export var base_round_time: float = 26.0
@export var base_move_interval: float = 4.0

@onready var safe_zone: Area3D = $SafeZone
@onready var puddles_root: Node3D = $Puddles
@onready var start_marker: Marker3D = $StartRef

var _round_time: float = 0.0
var _move_timer: float = 0.0
var _move_interval: float = 4.0
var _puddles: Array[Area3D] = []
var _resolved_flag: bool = false

func _ready() -> void:
	for child in puddles_root.get_children():
		if child is Area3D:
			_puddles.append(child)
			child.body_entered.connect(_on_puddle_entered)
	safe_zone.body_entered.connect(_on_safe_zone_entered)

func configure(depth: int) -> void:
	_round_time = maxf(12.0, base_round_time - float(depth - 1) * 2.5)
	_move_interval = maxf(1.5, base_move_interval - float(depth - 1) * 0.35)
	_reshuffle_puddles()

func cancel() -> void:
	set_process(false)

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)
		return
	_move_timer -= delta
	if _move_timer <= 0.0:
		_move_timer = _move_interval
		_reshuffle_puddles()

func _reshuffle_puddles() -> void:
	_move_timer = _move_interval
	for puddle in _puddles:
		puddle.position = _random_valid_spot()

func _random_valid_spot() -> Vector3:
	for _attempt in range(20):
		var x := randf_range(-ROOM_HALF_X, ROOM_HALF_X)
		var z := randf_range(ROOM_MIN_Z, ROOM_MAX_Z)
		var spot := Vector3(x, 0.06, z)
		if spot.distance_to(safe_zone.position) < SAFE_ZONE_CLEARANCE:
			continue
		if spot.distance_to(start_marker.position) < START_CLEARANCE:
			continue
		return spot
	return Vector3(0, 0.06, 0)

func _on_puddle_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_finish(false)

func _on_safe_zone_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_finish(true)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	set_process(false)
	resolved.emit(won)
