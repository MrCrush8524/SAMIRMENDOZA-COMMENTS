extends Control
## Plays the two publisher logos in sequence right after Boot, before
## Title — the "presented by" beat, distinct from Godot's own native
## boot_splash (project.godot's boot_splash/image, which is a single
## static frame the engine shows itself while still loading and can't
## sequence or fade). Skippable with any input, same as a normal game
## studio intro.

const HOLD_TIME := 1.6
const FADE_TIME := 0.5

@onready var logo: TextureRect = %Logo

var _slides: Array[Texture2D] = [
	preload("res://assets/branding/studio_logo_bobby_luna_mateo.png"),
	preload("res://assets/branding/division_logo_smr_entertainment.png"),
]
var _skipped: bool = false

func _ready() -> void:
	_play_sequence()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey or event is InputEventMouseButton or event is InputEventScreenTouch:
		if event.is_pressed():
			_skipped = true
			get_viewport().set_input_as_handled()

func _play_sequence() -> void:
	for slide in _slides:
		if _skipped:
			break
		logo.texture = slide
		logo.modulate.a = 0.0
		var fade_in := create_tween()
		fade_in.tween_property(logo, "modulate:a", 1.0, FADE_TIME)
		await fade_in.finished
		await _wait_or_skip(HOLD_TIME)
		if _skipped:
			break
		var fade_out := create_tween()
		fade_out.tween_property(logo, "modulate:a", 0.0, FADE_TIME)
		await fade_out.finished
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")

func _wait_or_skip(seconds: float) -> void:
	var elapsed := 0.0
	while elapsed < seconds and not _skipped:
		await get_tree().process_frame
		elapsed += get_process_delta_time()
