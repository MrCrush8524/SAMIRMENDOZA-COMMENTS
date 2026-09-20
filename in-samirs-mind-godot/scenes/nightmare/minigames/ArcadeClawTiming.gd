extends NightmareMinigame
## "Claw Timing" — ARCADE: a claw sweeps back and forth over the prize
## row. Interact while it's over the marked slot to win a round; a
## sweep counter caps how many passes you get before the machine locks
## you out.

@export var base_round_time: float = 20.0
@export var base_speed: float = 2.2
@export var sweep_range: float = 5.0
@export var target_tolerance: float = 0.6

@onready var claw: Node3D = $Claw
@onready var target: Node3D = $Target
@onready var interact_zone: Area3D = $InteractZone

var _round_time: float = 0.0
var _speed: float = 2.2
var _direction: float = 1.0
var _player_inside: bool = false
var _resolved_flag: bool = false

func _ready() -> void:
	interact_zone.body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	interact_zone.body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func configure(depth: int) -> void:
	_round_time = maxf(10.0, base_round_time - float(depth - 1) * 1.5)
	_speed = base_speed + float(depth - 1) * 0.25
	claw.position.x = -sweep_range
	_direction = 1.0
	UiRoot.set_prompt("Press E when the claw lines up with the marker.")

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
	claw.position.x += _speed * _direction * delta
	if claw.position.x > sweep_range:
		claw.position.x = sweep_range
		_direction = -1.0
	elif claw.position.x < -sweep_range:
		claw.position.x = -sweep_range
		_direction = 1.0
	if _player_inside and Input.is_action_just_pressed("interact"):
		if absf(claw.position.x - target.position.x) <= target_tolerance:
			_finish(true)
		else:
			_finish(false)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
