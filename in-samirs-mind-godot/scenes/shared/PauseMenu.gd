extends Control
## Escape-key pause menu, reachable during normal exploration only (see
## UiRoot._unhandled_input's guard against in_nightmare/in_backrooms — a
## Nightmare Passage already claims Escape for exit_nightmare, and the
## Backrooms deliberately has no player-initiated exit).
##
## Uses the dedicated front/three-quarter portrait art from the locked
## character body asset pack (distinct from the bigger Character Select
## door cards) — picking a card swaps GameState.dreamer and calls
## Player.refresh_dreamer_visuals() live, no chapter reload needed.

@onready var bobby_button: BaseButton = %PauseCardBobby
@onready var luna_button: BaseButton = %PauseCardLuna
@onready var mateo_button: BaseButton = %PauseCardMateo
@onready var resume_button: Button = %PauseResumeButton
@onready var current_label: Label = %PauseCurrentLabel

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]

signal closed

func _ready() -> void:
	visible = false
	bobby_button.pressed.connect(_on_card_pressed.bind("Bobby"))
	luna_button.pressed.connect(_on_card_pressed.bind("Luna"))
	mateo_button.pressed.connect(_on_card_pressed.bind("Mateo"))
	resume_button.pressed.connect(close)

func open() -> void:
	visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_refresh()

func close() -> void:
	visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	closed.emit()

func _refresh() -> void:
	current_label.text = "Currently: %s" % GameState.dreamer

func _on_card_pressed(dreamer_id: String) -> void:
	if dreamer_id == GameState.dreamer:
		return
	GameState.dreamer = dreamer_id
	if GameState.current_player:
		GameState.current_player.refresh_dreamer_visuals()
	_refresh()
