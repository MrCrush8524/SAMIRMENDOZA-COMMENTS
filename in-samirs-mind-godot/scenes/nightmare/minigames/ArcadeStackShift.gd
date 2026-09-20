extends NightmareMinigame
const ArcadeUi := preload("res://scenes/nightmare/minigames/NightmareArcadeUi.gd")
## "Stack Shift" (brief 3.3): a block sweeps left/right; press to lock it
## in place. The overlap with the layer below survives, the overhang is
## cut away, same as the classic block-stacking format. Win by reaching
## ~12 layers; fail if the stack's width reaches zero or too many bad
## placements pile up.

const LAYER_HEIGHT := 34.0
const START_WIDTH := 220.0
const LAYERS_TO_WIN := 12
const MAX_BAD_PLACEMENTS := 2
const BAD_OVERLAP_RATIO := 0.35 # overlap below this fraction of current width counts as "bad"
const SWEEP_SPEED_START := 220.0
const SWEEP_SPEED_MAX := 420.0

var _layer: CanvasLayer
var _stack_root: Control
var _current_bar: ColorRect
var _cur_x := 0.0
var _cur_width := START_WIDTH
var _direction := 1
var _speed := SWEEP_SPEED_START
var _base_y := 0.0
var _layers_built := 0
var _bad_count := 0
var _resolved_flag := false
var _play_width := 0.0
var _prev_left := 0.0
var _prev_width := START_WIDTH

func configure(_depth: int) -> void:
	_layer = ArcadeUi.build_layer("STACK SHIFT")
	add_child(_layer)
	var vp: Vector2 = get_viewport().get_visible_rect().size
	_play_width = vp.x
	_base_y = vp.y - 100.0

	_stack_root = Control.new()
	_stack_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(_stack_root)

	# Foundation layer, centered.
	_prev_left = (_play_width - START_WIDTH) * 0.5
	_prev_width = START_WIDTH
	var base := ColorRect.new()
	base.color = ArcadeUi.ACCENT_COLOR_2
	base.size = Vector2(_prev_width, LAYER_HEIGHT)
	base.position = Vector2(_prev_left, _base_y)
	_stack_root.add_child(base)

	_spawn_moving_bar()
	ArcadeUi.status_label_of(_layer).text = "Press E (or tap) to drop the block."

func _spawn_moving_bar() -> void:
	_cur_width = _prev_width
	_cur_x = 0.0
	_direction = 1
	_current_bar = ColorRect.new()
	_current_bar.color = ArcadeUi.ACCENT_COLOR
	_current_bar.size = Vector2(_cur_width, LAYER_HEIGHT)
	_current_bar.position = Vector2(0, _base_y - LAYER_HEIGHT * (_layers_built + 1))
	_stack_root.add_child(_current_bar)

func _process(delta: float) -> void:
	if _resolved_flag or not is_instance_valid(_current_bar):
		return
	_cur_x += _direction * _speed * delta
	if _cur_x <= 0.0:
		_cur_x = 0.0
		_direction = 1
	elif _cur_x + _cur_width >= _play_width:
		_cur_x = _play_width - _cur_width
		_direction = -1
	_current_bar.position.x = _cur_x

	if Input.is_action_just_pressed("interact") or Input.is_action_just_pressed("ui_accept"):
		_lock_current()

func _lock_current() -> void:
	var new_left: float = maxf(_cur_x, _prev_left)
	var new_right: float = minf(_cur_x + _cur_width, _prev_left + _prev_width)
	var new_width: float = new_right - new_left

	if new_width <= 0.0:
		_finish(false)
		return

	var overlap_ratio: float = new_width / _cur_width
	if overlap_ratio < BAD_OVERLAP_RATIO:
		_bad_count += 1
		ArcadeUi.status_label_of(_layer).text = "Sloppy. (%d of %d misses)" % [_bad_count, MAX_BAD_PLACEMENTS]
		if _bad_count >= MAX_BAD_PLACEMENTS:
			_finish(false)
			return

	_current_bar.position.x = new_left
	_current_bar.size.x = new_width
	_prev_left = new_left
	_prev_width = new_width
	_layers_built += 1

	if _layers_built >= LAYERS_TO_WIN:
		_finish(true)
		return

	var progress: float = float(_layers_built) / float(LAYERS_TO_WIN)
	_speed = lerp(SWEEP_SPEED_START, SWEEP_SPEED_MAX, progress)
	_spawn_moving_bar()

func cancel() -> void:
	_resolved_flag = true
	set_process(false)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	resolved.emit(won)
