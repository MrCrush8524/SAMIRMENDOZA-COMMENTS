extends NightmareMinigame
## "Freeze" — DECAY: something is scanning the room. Stand completely
## still inside the zone until the hold meter fills; any real movement
## resets it. Running out of round time first ends the round.

@export var base_round_time: float = 22.0
@export var base_hold_time: float = 6.0
@export var move_tolerance: float = 0.05

@onready var zone: Area3D = $Zone

var _round_time: float = 0.0
var _hold_time: float = 6.0
var _hold_progress: float = 0.0
var _last_player_pos: Vector3 = Vector3.ZERO
var _player_ref: Node3D = null
var _resolved_flag: bool = false

func _ready() -> void:
	zone.body_entered.connect(_on_zone_entered)
	zone.body_exited.connect(_on_zone_exited)

func configure(depth: int) -> void:
	_round_time = maxf(12.0, base_round_time - float(depth - 1) * 1.5)
	_hold_time = base_hold_time + float(depth - 1) * 0.5
	_hold_progress = 0.0
	UiRoot.set_prompt("Stand still. Don't move.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)
		return
	if _player_ref == null:
		return
	var moved := _player_ref.global_position.distance_to(_last_player_pos)
	_last_player_pos = _player_ref.global_position
	if moved > move_tolerance:
		_hold_progress = 0.0
	else:
		_hold_progress += delta
		if _hold_progress >= _hold_time:
			_finish(true)

func _on_zone_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_player_ref = body
		_last_player_pos = body.global_position

func _on_zone_exited(body: Node3D) -> void:
	if body == _player_ref:
		_player_ref = null
		_hold_progress = 0.0

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
