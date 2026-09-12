extends NightmareMinigame
## "Rising Water" — DECAY: the floor floods and climbs toward the
## ceiling. Reach the raised ledge before the water swallows the room;
## touching the water at any point ends the round immediately.

@export var base_round_time: float = 24.0
@export var base_rise_rate: float = 0.09

@onready var water: Area3D = $Water
@onready var safe_zone: Area3D = $SafeZone

var _round_time: float = 0.0
var _rise_rate: float = 0.09
var _water_height: float = 0.05
var _resolved_flag: bool = false

func _ready() -> void:
	water.body_entered.connect(_on_water_entered)
	safe_zone.body_entered.connect(_on_safe_entered)

func configure(depth: int) -> void:
	_round_time = maxf(14.0, base_round_time - float(depth - 1) * 2.0)
	_rise_rate = base_rise_rate + float(depth - 1) * 0.012
	_water_height = 0.05
	_apply_water_height()

func cancel() -> void:
	set_process(false)

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)
		return
	_water_height += _rise_rate * delta
	_apply_water_height()

func _apply_water_height() -> void:
	water.scale.y = _water_height
	water.position.y = _water_height * 0.5

func _on_water_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_finish(false)

func _on_safe_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_finish(true)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	set_process(false)
	resolved.emit(won)
