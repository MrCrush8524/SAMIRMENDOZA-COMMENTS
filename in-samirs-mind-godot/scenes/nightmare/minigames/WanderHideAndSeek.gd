extends NightmareMinigame
## "Hide and Seek" — WANDER: something wanders the room. Reach the exit
## before it finds you, or before the round clock runs out.

@export var base_round_time: float = 26.0

@onready var seeker: Sprite3D = $Seeker
@onready var exit_zone: Area3D = $ExitZone

var _round_time: float = 0.0
var _resolved_flag: bool = false

func _ready() -> void:
	exit_zone.body_entered.connect(_on_exit_entered)

func configure(depth: int) -> void:
	_round_time = maxf(14.0, base_round_time - float(depth - 1) * 2.0)
	seeker.speed = 1.2 + float(depth - 1) * 0.15
	UiRoot.set_prompt("Reach the exit. Don't let it see you.")

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)

func _on_exit_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_finish(true)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
