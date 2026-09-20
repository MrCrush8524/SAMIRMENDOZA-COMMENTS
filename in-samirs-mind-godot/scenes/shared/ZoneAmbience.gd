extends Area3D
## Room-specific ambience — shuffles through a pool of takes while the
## player is standing in the zone, fades out when they leave. Layers on
## top of any chapter-wide AmbientLoop rather than replacing it.

const FADE_TIME := 0.8

@export var streams: Array[AudioStream] = []
@export var volume_db: float = 0.0

@onready var player: AudioStreamPlayer3D = $Player

var _fade_tween: Tween

func _ready() -> void:
	player.volume_db = -80
	player.finished.connect(_play_next)
	body_entered.connect(_on_entered)
	body_exited.connect(_on_exited)

func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player") or streams.is_empty():
		return
	_play_next()
	_fade(volume_db)

func _on_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		_fade(-80, player.stop)

func _play_next() -> void:
	if streams.is_empty():
		return
	player.stream = streams[randi() % streams.size()]
	player.play()

func _fade(to_db: float, on_done: Callable = Callable()) -> void:
	if _fade_tween:
		_fade_tween.kill()
	_fade_tween = create_tween()
	_fade_tween.tween_property(player, "volume_db", to_db, FADE_TIME)
	if on_done.is_valid():
		_fade_tween.tween_callback(on_done)
