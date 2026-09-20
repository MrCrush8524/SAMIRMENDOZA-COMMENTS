extends Area3D
## Occasional one-shot audio cue while the player is in the zone — the
## Museum's "something moves" stingers, not a loop. Fires at a random
## interval within [min_interval, max_interval] for as long as the
## player stays inside.

@export var streams: Array[AudioStream] = []
@export var min_interval: float = 12.0
@export var max_interval: float = 30.0

@onready var player: AudioStreamPlayer3D = $Player

var _player_inside: bool = false
var _timer: float = 0.0

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _enter())
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _enter() -> void:
	_player_inside = true
	_reset_timer()

func _reset_timer() -> void:
	_timer = randf_range(min_interval, max_interval)

func _process(delta: float) -> void:
	if not _player_inside or streams.is_empty():
		return
	_timer -= delta
	if _timer <= 0.0:
		player.stream = streams[randi() % streams.size()]
		player.play()
		_reset_timer()
