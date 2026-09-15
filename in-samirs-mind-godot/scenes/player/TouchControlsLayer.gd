extends CanvasLayer
## On-screen move/interact/sprint buttons for touch devices - native
## mobile exports and, just as importantly, the Web export opened in an
## iPhone/iPad/Android browser, where OS.get_name() still reports "Web"
## but DisplayServer.is_touchscreen_available() correctly says yes.
## Free-look itself needs no button: Player.gd already turns any drag
## outside these buttons' hit areas into camera look via
## InputEventScreenDrag.

const BTN_RADIUS := 42.0
const DPAD_GAP := 6.0
const EDGE_MARGIN := 28.0

@onready var btn_up: TouchScreenButton = $BtnUp
@onready var btn_down: TouchScreenButton = $BtnDown
@onready var btn_left: TouchScreenButton = $BtnLeft
@onready var btn_right: TouchScreenButton = $BtnRight
@onready var btn_interact: TouchScreenButton = $BtnInteract
@onready var btn_sprint: TouchScreenButton = $BtnSprint

func _ready() -> void:
	visible = DisplayServer.is_touchscreen_available()
	if not visible:
		return
	_layout()
	get_viewport().size_changed.connect(_layout)

func _layout() -> void:
	var vp := get_viewport().get_visible_rect().size
	var dpad_step := BTN_RADIUS * 2.0 + DPAD_GAP
	var dpad_cx := EDGE_MARGIN + BTN_RADIUS + dpad_step
	var dpad_cy := vp.y - EDGE_MARGIN - BTN_RADIUS - dpad_step
	btn_up.position = Vector2(dpad_cx, dpad_cy - dpad_step)
	btn_down.position = Vector2(dpad_cx, dpad_cy + dpad_step)
	btn_left.position = Vector2(dpad_cx - dpad_step, dpad_cy)
	btn_right.position = Vector2(dpad_cx + dpad_step, dpad_cy)

	var action_cx := vp.x - EDGE_MARGIN - BTN_RADIUS
	btn_sprint.position = Vector2(action_cx, vp.y - EDGE_MARGIN - BTN_RADIUS)
	btn_interact.position = Vector2(action_cx, vp.y - EDGE_MARGIN - BTN_RADIUS - dpad_step)
