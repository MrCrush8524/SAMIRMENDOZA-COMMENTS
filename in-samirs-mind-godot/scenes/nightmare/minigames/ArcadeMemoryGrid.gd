extends NightmareMinigame
const ArcadeUi := preload("res://scenes/nightmare/minigames/NightmareArcadeUi.gd")
## "Memory Grid" (brief 3.3): watch a flashed tile sequence, then repeat
## it by clicking/tapping the same tiles in order. Each completed round
## adds one more tile to the sequence ("longer patterns each round").
## Win by completing enough rounds; fail on the 3rd wrong input.

const GRID_SIZE := 3 # 3x3 = 9 tiles
const TILE_SIZE := 90.0
const TILE_GAP := 14.0
const ROUNDS_TO_WIN := 5
const MAX_MISTAKES := 3
const FLASH_TIME := 0.45
const FLASH_GAP := 0.2

var _layer: CanvasLayer
var _tiles: Array[ColorRect] = []
var _sequence: Array[int] = []
var _input_index := 0
var _round := 0
var _mistakes := 0
var _accepting_input := false
var _resolved_flag := false

func configure(_depth: int) -> void:
	_layer = ArcadeUi.build_layer("MEMORY GRID")
	add_child(_layer)

	var grid_root := Control.new()
	grid_root.set_anchors_preset(Control.PRESET_CENTER)
	var total: float = GRID_SIZE * TILE_SIZE + (GRID_SIZE - 1) * TILE_GAP
	grid_root.position = -Vector2(total, total) * 0.5
	_layer.add_child(grid_root)

	for i in GRID_SIZE * GRID_SIZE:
		var x := i % GRID_SIZE
		var y := i / GRID_SIZE
		var tile := ColorRect.new()
		tile.color = Color(0.3, 0.2, 0.4)
		tile.size = Vector2(TILE_SIZE, TILE_SIZE)
		tile.position = Vector2(x * (TILE_SIZE + TILE_GAP), y * (TILE_SIZE + TILE_GAP))
		tile.mouse_filter = Control.MOUSE_FILTER_STOP
		var idx := i
		tile.gui_input.connect(func(ev): _on_tile_input(ev, idx))
		grid_root.add_child(tile)
		_tiles.append(tile)

	ArcadeUi.status_label_of(_layer).text = "Watch the pattern..."
	_next_round()

func _next_round() -> void:
	_round += 1
	_sequence.append(randi() % _tiles.size())
	_input_index = 0
	_accepting_input = false
	await _play_sequence()
	if not is_instance_valid(self):
		return
	_accepting_input = true
	ArcadeUi.status_label_of(_layer).text = "Repeat it. (Round %d)" % _round

func _play_sequence() -> void:
	for idx in _sequence:
		if not is_instance_valid(self) or _resolved_flag:
			return
		_flash_tile(idx)
		await get_tree().create_timer(FLASH_TIME + FLASH_GAP).timeout

func _flash_tile(idx: int) -> void:
	if idx < 0 or idx >= _tiles.size():
		return
	var tile := _tiles[idx]
	tile.color = ArcadeUi.ACCENT_COLOR_2
	var t := get_tree().create_timer(FLASH_TIME)
	await t.timeout
	if is_instance_valid(tile):
		tile.color = Color(0.3, 0.2, 0.4)

func _on_tile_input(event: InputEvent, idx: int) -> void:
	if not _accepting_input or _resolved_flag:
		return
	if not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT) \
			and not (event is InputEventScreenTouch and event.pressed):
		return
	_flash_tile(idx)
	if idx == _sequence[_input_index]:
		_input_index += 1
		if _input_index >= _sequence.size():
			_accepting_input = false
			if _round >= ROUNDS_TO_WIN:
				_finish(true)
			else:
				ArcadeUi.status_label_of(_layer).text = "Good. Watch again..."
				await get_tree().create_timer(0.6).timeout
				if is_instance_valid(self) and not _resolved_flag:
					_next_round()
	else:
		_mistakes += 1
		_accepting_input = false
		ArcadeUi.status_label_of(_layer).text = "Wrong. (%d of %d)" % [_mistakes, MAX_MISTAKES]
		if _mistakes >= MAX_MISTAKES:
			_finish(false)
			return
		await get_tree().create_timer(0.8).timeout
		if is_instance_valid(self) and not _resolved_flag:
			_input_index = 0
			_accepting_input = true

func cancel() -> void:
	_resolved_flag = true

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	resolved.emit(won)
