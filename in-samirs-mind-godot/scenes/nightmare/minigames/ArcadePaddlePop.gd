extends NightmareMinigame
const ArcadeUi := preload("res://scenes/nightmare/minigames/NightmareArcadeUi.gd")
## "Paddle Pop" (brief 3.3): breakout-style paddle + ball with a real
## collision/score loop. Clear the whole brick field to win; lose 3
## balls to fail.

const BRICK_ROWS := 4
const BRICK_COLS := 7
const BRICK_SIZE := Vector2(64, 24)
const BRICK_GAP := 6.0
const PADDLE_SIZE := Vector2(120, 20)
const PADDLE_SPEED := 620.0
const BALL_RADIUS := 8.0
const BALL_SPEED_START := 360.0
const MAX_BALLS_LOST := 3

var _layer: CanvasLayer
var _field: Control
var _paddle: ColorRect
var _ball: ColorRect
var _ball_vel := Vector2.ZERO
var _bricks: Array[ColorRect] = []
var _balls_lost := 0
var _play_size := Vector2.ZERO
var _resolved_flag := false
var _serving := true

func configure(_depth: int) -> void:
	_layer = ArcadeUi.build_layer("PADDLE POP")
	add_child(_layer)
	_play_size = get_viewport().get_visible_rect().size

	_field = Control.new()
	_field.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(_field)

	var field_width: float = BRICK_COLS * (BRICK_SIZE.x + BRICK_GAP) - BRICK_GAP
	var left_margin: float = (_play_size.x - field_width) * 0.5
	for row in BRICK_ROWS:
		for col in BRICK_COLS:
			var brick := ColorRect.new()
			brick.color = ArcadeUi.ACCENT_COLOR.lerp(ArcadeUi.ACCENT_COLOR_2, float(row) / float(BRICK_ROWS))
			brick.size = BRICK_SIZE
			brick.position = Vector2(
				left_margin + col * (BRICK_SIZE.x + BRICK_GAP),
				110.0 + row * (BRICK_SIZE.y + BRICK_GAP)
			)
			_field.add_child(brick)
			_bricks.append(brick)

	_paddle = ColorRect.new()
	_paddle.color = Color(0.95, 0.95, 1.0)
	_paddle.size = PADDLE_SIZE
	_paddle.position = Vector2((_play_size.x - PADDLE_SIZE.x) * 0.5, _play_size.y - 80.0)
	_field.add_child(_paddle)

	_ball = ColorRect.new()
	_ball.color = Color(1, 1, 1)
	_ball.size = Vector2(BALL_RADIUS, BALL_RADIUS) * 2.0
	_field.add_child(_ball)
	_serve_ball()

	ArcadeUi.status_label_of(_layer).text = "A/D to move. Clear every brick."

func _serve_ball() -> void:
	_serving = true
	_ball.position = Vector2(
		_paddle.position.x + PADDLE_SIZE.x * 0.5 - BALL_RADIUS,
		_paddle.position.y - BALL_RADIUS * 2.0 - 4.0
	)
	_ball_vel = Vector2(BALL_SPEED_START * (1 if randf() < 0.5 else -1), -BALL_SPEED_START)

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	var move := Input.get_action_strength("move_right") - Input.get_action_strength("move_left")
	_paddle.position.x = clampf(_paddle.position.x + move * PADDLE_SPEED * delta, 0.0, _play_size.x - PADDLE_SIZE.x)

	if _serving:
		_ball.position.x = _paddle.position.x + PADDLE_SIZE.x * 0.5 - BALL_RADIUS
		if Input.is_action_just_pressed("interact") or Input.is_action_just_pressed("ui_accept"):
			_serving = false
		return

	_ball.position += _ball_vel * delta

	if _ball.position.x <= 0.0:
		_ball.position.x = 0.0
		_ball_vel.x = abs(_ball_vel.x)
	elif _ball.position.x + BALL_RADIUS * 2.0 >= _play_size.x:
		_ball.position.x = _play_size.x - BALL_RADIUS * 2.0
		_ball_vel.x = -abs(_ball_vel.x)
	if _ball.position.y <= 100.0:
		_ball.position.y = 100.0
		_ball_vel.y = abs(_ball_vel.y)

	var ball_rect := Rect2(_ball.position, _ball.size)
	if ball_rect.intersects(Rect2(_paddle.position, PADDLE_SIZE)) and _ball_vel.y > 0.0:
		_ball_vel.y = -abs(_ball_vel.y)
		var hit_offset: float = (_ball.position.x + BALL_RADIUS - (_paddle.position.x + PADDLE_SIZE.x * 0.5)) / (PADDLE_SIZE.x * 0.5)
		_ball_vel.x = clampf(hit_offset, -1.0, 1.0) * BALL_SPEED_START

	for brick in _bricks.duplicate():
		if ball_rect.intersects(Rect2(brick.position, BRICK_SIZE)):
			_ball_vel.y = -_ball_vel.y
			brick.queue_free()
			_bricks.erase(brick)
			if _bricks.is_empty():
				_finish(true)
				return
			break

	if _ball.position.y > _play_size.y:
		_balls_lost += 1
		ArcadeUi.status_label_of(_layer).text = "Lost a ball. (%d of %d)" % [_balls_lost, MAX_BALLS_LOST]
		if _balls_lost >= MAX_BALLS_LOST:
			_finish(false)
			return
		_serve_ball()

func cancel() -> void:
	_resolved_flag = true
	set_process(false)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	resolved.emit(won)
