extends NightmareMinigame
const ArcadeUi := preload("res://scenes/nightmare/minigames/NightmareArcadeUi.gd")
## "Signal Sort" (brief 3.3): colored signals drift across a sort zone.
## Send magenta left, cyan right, while it's inside the zone. Win by
## sorting enough before the timer runs out; fail on too many strikes
## (wrong direction or missed entirely) or the timer expiring. Pace
## increases over the round.

const SORT_TARGET := 12
const MAX_STRIKES := 3
const TIME_LIMIT := 60.0
const SPAWN_INTERVAL_START := 1.4
const SPAWN_INTERVAL_MIN := 0.6
const SIGNAL_SPEED_START := 180.0
const SIGNAL_SPEED_MAX := 380.0
const SIGNAL_SIZE := Vector2(40, 40)
const ZONE_HALF_WIDTH := 60.0

var _layer: CanvasLayer
var _field: Control
var _zone_x := 0.0
var _play_size := Vector2.ZERO
var _signals: Array[Dictionary] = []
var _elapsed := 0.0
var _spawn_timer := 0.0
var _score := 0
var _strikes := 0
var _resolved_flag := false

func configure(_depth: int) -> void:
	_layer = ArcadeUi.build_layer("SIGNAL SORT")
	add_child(_layer)
	_play_size = get_viewport().get_visible_rect().size
	_zone_x = _play_size.x * 0.5

	_field = Control.new()
	_field.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(_field)

	var zone := ColorRect.new()
	zone.color = Color(1, 1, 1, 0.12)
	zone.size = Vector2(ZONE_HALF_WIDTH * 2.0, 90.0)
	zone.position = Vector2(_zone_x - ZONE_HALF_WIDTH, _play_size.y * 0.5 - 45.0)
	_field.add_child(zone)

	ArcadeUi.status_label_of(_layer).text = "Magenta -> A. Cyan -> D. Sort %d." % SORT_TARGET

func _spawn_signal() -> void:
	var is_left := randf() < 0.5 # true = magenta = sort left
	var node := ColorRect.new()
	node.color = ArcadeUi.ACCENT_COLOR if is_left else ArcadeUi.ACCENT_COLOR_2
	node.size = SIGNAL_SIZE
	node.position = Vector2(-SIGNAL_SIZE.x, _play_size.y * 0.5 - SIGNAL_SIZE.y * 0.5)
	_field.add_child(node)
	_signals.append({"node": node, "sort_left": is_left, "judged": false})

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_elapsed += delta
	if _elapsed >= TIME_LIMIT:
		_finish(false)
		return

	var progress: float = clampf(_elapsed / TIME_LIMIT, 0.0, 1.0)
	var spawn_interval: float = lerp(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, progress)
	var speed: float = lerp(SIGNAL_SPEED_START, SIGNAL_SPEED_MAX, progress)

	_spawn_timer -= delta
	if _spawn_timer <= 0.0:
		_spawn_timer = spawn_interval
		_spawn_signal()

	var pressed_left := Input.is_action_just_pressed("move_left")
	var pressed_right := Input.is_action_just_pressed("move_right")

	for sig in _signals.duplicate():
		var node: ColorRect = sig["node"]
		node.position.x += speed * delta
		var center: float = node.position.x + SIGNAL_SIZE.x * 0.5
		var in_zone: bool = absf(center - _zone_x) <= ZONE_HALF_WIDTH

		if not sig["judged"] and in_zone and (pressed_left or pressed_right):
			var correct: bool = (pressed_left and sig["sort_left"]) or (pressed_right and not sig["sort_left"])
			sig["judged"] = true
			if correct:
				_score += 1
				node.queue_free()
				_signals.erase(sig)
				if _score >= SORT_TARGET:
					_finish(true)
					return
			else:
				_register_strike()
				node.queue_free()
				_signals.erase(sig)
				if _resolved_flag:
					return
			continue

		if node.position.x > _play_size.x:
			if not sig["judged"]:
				_register_strike()
			node.queue_free()
			_signals.erase(sig)
			if _resolved_flag:
				return

func _register_strike() -> void:
	_strikes += 1
	ArcadeUi.status_label_of(_layer).text = "Missed. (%d of %d strikes, %d/%d sorted)" % [_strikes, MAX_STRIKES, _score, SORT_TARGET]
	if _strikes >= MAX_STRIKES:
		_finish(false)

func cancel() -> void:
	_resolved_flag = true
	set_process(false)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	resolved.emit(won)
