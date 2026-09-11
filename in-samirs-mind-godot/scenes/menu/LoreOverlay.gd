extends Control
## Rotating Lore & Controls page, opened from the Title screen. The four
## images are finished compositions (title/lore/controls baked in) — this
## script only crossfades between them and never draws anything over the
## baked text.
##
## Menu music continuity: this overlay never touches AudioManager in any
## way. It is a child Control of Title, shown/hidden in place — opening
## or closing it is not a scene change, so the persistent menu music
## player in the AudioManager autoload is never restarted, stopped, or
## duplicated. That guarantee comes from what this script does NOT do,
## not from any code path here.

const HOLD_SECONDS := 18.0
const CROSSFADE_SECONDS := 1.2

const IMAGE_PATHS := [
	"res://assets/lore/01_laundromat.png",
	"res://assets/lore/02_pool.png",
	"res://assets/lore/03_shopping_arcade.png",
	"res://assets/lore/04_suburb.png",
]

@onready var layer_a: TextureRect = $ImageA
@onready var layer_b: TextureRect = $ImageB
@onready var back_button: Button = $NavStrip/BackButton
@onready var prev_button: Button = $NavStrip/PrevButton
@onready var pause_button: Button = $NavStrip/PauseButton
@onready var next_button: Button = $NavStrip/NextButton

var _textures: Array[Texture2D] = []
var _index: int = 0
var _front_is_a: bool = true
var _hold_timer: float = 0.0
var _paused: bool = false
var _fade_tween: Tween = null

signal closed

func _ready() -> void:
	for path in IMAGE_PATHS:
		_textures.append(load(path) as Texture2D)
	back_button.pressed.connect(_on_back)
	prev_button.pressed.connect(func(): _manual_advance(-1))
	next_button.pressed.connect(func(): _manual_advance(1))
	pause_button.pressed.connect(_on_pause_toggle)
	visible = false
	set_process(false)

func open() -> void:
	if visible:
		return # never stack a second set of timers/tweens on repeated opens
	visible = true
	set_process(true)
	_index = 0
	_paused = false
	pause_button.text = "Pause"
	layer_a.texture = _textures[0]
	layer_a.modulate.a = 1.0
	layer_b.modulate.a = 0.0
	_front_is_a = true
	_hold_timer = HOLD_SECONDS

func close() -> void:
	if not visible:
		return
	if _fade_tween:
		_fade_tween.kill()
		_fade_tween = null
	visible = false
	set_process(false)
	closed.emit()

func _on_back() -> void:
	close()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		close()
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if _paused or _fade_tween:
		return
	_hold_timer -= delta
	if _hold_timer <= 0.0:
		_advance(1)

func _on_pause_toggle() -> void:
	_paused = not _paused
	pause_button.text = "Resume" if _paused else "Pause"

func _manual_advance(direction: int) -> void:
	_advance(direction)
	_hold_timer = HOLD_SECONDS

func _advance(direction: int) -> void:
	if _fade_tween:
		return # a crossfade is already committed; ignore until it finishes
	var next_index := (_index + direction + _textures.size()) % _textures.size()
	var next_texture := _textures[next_index]
	if next_texture == null:
		return # failed to load — skip gracefully, keep showing the current image

	var front: TextureRect = layer_a if _front_is_a else layer_b
	var back: TextureRect = layer_b if _front_is_a else layer_a
	back.texture = next_texture # load before fading — never a blank frame
	back.modulate.a = 0.0

	_fade_tween = create_tween()
	_fade_tween.set_parallel(true)
	_fade_tween.tween_property(front, "modulate:a", 0.0, CROSSFADE_SECONDS)
	_fade_tween.tween_property(back, "modulate:a", 1.0, CROSSFADE_SECONDS)
	_fade_tween.set_parallel(false)
	_fade_tween.tween_callback(func():
		_fade_tween = null
		_front_is_a = not _front_is_a
		_index = next_index
		_hold_timer = HOLD_SECONDS
	)
