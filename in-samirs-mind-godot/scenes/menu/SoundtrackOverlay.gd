extends Control
## Lists unlocked Dream Tracks (GameState.dream_tracks) and lets the
## player replay one from the menu. Only one Dream Track exists as an
## actual in-world pickup so far (01_lint_roller_reverie in Chapter I) —
## this registry mirrors that, not the full 10 named in the master
## brief, since the other 9 aren't implemented as findable objects yet.

const IMAGE_SIZE := Vector2(1920, 1080)
const REGIONS := {
	"TracksButton": [832, 197, 348, 78],
	"NowPlayingButton": [832, 299, 348, 78],
	"BackButton": [832, 403, 348, 78],
}

const TRACK_REGISTRY := {
	"01_lint_roller_reverie": {
		"name": "Lint Roller Reverie",
		"stream": "res://assets/audio/dream_tracks/01_lint_roller_reverie.ogg",
	},
}

@onready var tracks_button: Button = %TracksButton
@onready var now_playing_button: Button = %NowPlayingButton
@onready var back_button: Button = %BackButton
@onready var status_label: Label = %StatusLabel

signal closed

func _ready() -> void:
	resized.connect(_layout_hotspots)
	visible = false
	back_button.pressed.connect(close)
	tracks_button.pressed.connect(_show_tracks)
	now_playing_button.pressed.connect(_show_now_playing)
	status_label.visible = false

func open() -> void:
	if visible:
		return
	visible = true
	status_label.visible = false
	_layout_hotspots()
	tracks_button.grab_focus()

func close() -> void:
	visible = false
	closed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		close()
		get_viewport().set_input_as_handled()

func _show_tracks() -> void:
	var unlocked: Array = GameState.dream_tracks.filter(func(id): return TRACK_REGISTRY.has(id))
	if unlocked.is_empty():
		_set_status("Nothing found yet.")
		return
	# Only one track exists right now; play it directly. A real list UI
	# is the next step once more Dream Tracks are findable in-world.
	var entry: Dictionary = TRACK_REGISTRY[unlocked[0]]
	_set_status("Playing: %s" % entry["name"])
	AudioManager.dream_track_player.stream = load(entry["stream"])
	AudioManager.dream_track_player.volume_db = 0
	AudioManager.dream_track_player.play()

func _show_now_playing() -> void:
	_set_status("A Dream Track is playing." if AudioManager.dream_track_player.playing else "Nothing playing.")

func _set_status(text: String) -> void:
	status_label.text = text
	status_label.visible = true

func _layout_hotspots() -> void:
	for node_name in REGIONS:
		var control: Control = get_node(NodePath("%" + node_name))
		var rect := HeroLayout.map_rect(REGIONS[node_name], size, IMAGE_SIZE)
		control.position = rect.position
		control.size = rect.size
