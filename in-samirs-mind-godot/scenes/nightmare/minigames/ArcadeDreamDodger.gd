extends NightmareMinigame
const ArcadeUi := preload("res://scenes/nightmare/minigames/NightmareArcadeUi.gd")
## "Dream Dodger" (brief 3.3): move between lanes to survive falling
## obstacles. Win by surviving ~45 seconds; fail on the 3rd collision.
## Obstacle fall speed rises over the round to keep it from going stale.

const LANE_COUNT := 3
const SURVIVE_TIME := 45.0
const MAX_COLLISIONS := 3
const SPAWN_INTERVAL_START := 1.1
const SPAWN_INTERVAL_MIN := 0.45
const FALL_SPEED_START := 260.0
const FALL_SPEED_MAX := 620.0

var _layer: CanvasLayer
var _lanes: Array[Control] = []
var _player_lane := 1
var _player_marker: ColorRect
var _obstacles: Array[Dictionary] = []
var _obstacle_layer: Control
var _elapsed := 0.0
var _collisions := 0
var _spawn_timer := 0.0
var _resolved_flag := false
var _lane_width := 0.0
var _play_height := 0.0

func configure(_depth: int) -> void:
	_layer = ArcadeUi.build_layer("DREAM DODGER")
	add_child(_layer)
	var vp: Vector2 = get_viewport().get_visible_rect().size
	_lane_width = vp.x / float(LANE_COUNT)
	_play_height = vp.y - 140.0

	_obstacle_layer = Control.new()
	_obstacle_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(_obstacle_layer)

	for i in LANE_COUNT:
		var divider := ColorRect.new()
		divider.color = Color(1, 1, 1, 0.08)
		divider.position = Vector2(_lane_width * i, 100)
		divider.size = Vector2(2, _play_height)
		_obstacle_layer.add_child(divider)

	_player_marker = ColorRect.new()
	_player_marker.color = ArcadeUi.ACCENT_COLOR_2
	_player_marker.size = Vector2(48, 48)
	_obstacle_layer.add_child(_player_marker)
	_update_player_position()

	ArcadeUi.status_label_of(_layer).text = "A/D or the D-pad to switch lanes. Survive."

func _update_player_position() -> void:
	_player_marker.position = Vector2(
		_lane_width * _player_lane + _lane_width * 0.5 - 24.0,
		_play_height + 100.0 - 60.0
	)

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	if Input.is_action_just_pressed("move_left") and _player_lane > 0:
		_player_lane -= 1
		_update_player_position()
	if Input.is_action_just_pressed("move_right") and _player_lane < LANE_COUNT - 1:
		_player_lane += 1
		_update_player_position()

	_elapsed += delta
	if _elapsed >= SURVIVE_TIME:
		_finish(true)
		return

	var progress: float = clampf(_elapsed / SURVIVE_TIME, 0.0, 1.0)
	var spawn_interval: float = lerp(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, progress)
	var fall_speed: float = lerp(FALL_SPEED_START, FALL_SPEED_MAX, progress)

	_spawn_timer -= delta
	if _spawn_timer <= 0.0:
		_spawn_timer = spawn_interval
		_spawn_obstacle()

	for obs in _obstacles.duplicate():
		obs["node"].position.y += fall_speed * delta
		if obs["node"].position.y > _play_height + 100.0:
			if obs["lane"] == _player_lane:
				_collisions += 1
				ArcadeUi.status_label_of(_layer).text = "Hit! (%d of %d)" % [_collisions, MAX_COLLISIONS]
				if _collisions >= MAX_COLLISIONS:
					obs["node"].queue_free()
					_obstacles.erase(obs)
					_finish(false)
					return
			obs["node"].queue_free()
			_obstacles.erase(obs)

func _spawn_obstacle() -> void:
	var lane := randi() % LANE_COUNT
	var node := ColorRect.new()
	node.color = ArcadeUi.ACCENT_COLOR
	node.size = Vector2(48, 48)
	node.position = Vector2(_lane_width * lane + _lane_width * 0.5 - 24.0, 100.0)
	_obstacle_layer.add_child(node)
	_obstacles.append({"node": node, "lane": lane})

func cancel() -> void:
	_resolved_flag = true
	set_process(false)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	resolved.emit(won)
