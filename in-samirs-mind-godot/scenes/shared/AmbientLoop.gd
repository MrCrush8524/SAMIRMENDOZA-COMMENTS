extends AudioStreamPlayer3D
## Always-on background ambience for a chapter (mall muzak, terminal
## hall tone, etc.) — shuffles through a pool of takes back-to-back for
## the whole time the chapter is loaded, rather than looping one file
## note-for-note forever.

@export var streams: Array[AudioStream] = []

func _ready() -> void:
	finished.connect(_play_next)
	_play_next()

func _play_next() -> void:
	if streams.is_empty():
		return
	stream = streams[randi() % streams.size()]
	play()
