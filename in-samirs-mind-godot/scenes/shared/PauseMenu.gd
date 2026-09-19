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
##
## Also the only way out of a run mid-chapter: Escape used to only offer
## a character swap, with no path back to the Title screen short of
## alt-F4. Quit to Menu saves first (so Continue picks up exactly here)
## then returns to Title. A quick volume/reduced-motion row covers the
## rest of what Settings offers, without needing Title's overlay (that
## one's laid out against Title's own hero art, not reachable mid-run).

@onready var bobby_button: BaseButton = %PauseCardBobby
@onready var luna_button: BaseButton = %PauseCardLuna
@onready var mateo_button: BaseButton = %PauseCardMateo
@onready var resume_button: Button = %PauseResumeButton
@onready var quit_button: Button = %PauseQuitButton
@onready var current_label: Label = %PauseCurrentLabel
@onready var volume_slider: HSlider = %PauseVolumeSlider
@onready var reduced_motion_check: CheckButton = %PauseReducedMotionCheck

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]

signal closed

func _ready() -> void:
	visible = false
	bobby_button.pressed.connect(_on_card_pressed.bind("Bobby"))
	luna_button.pressed.connect(_on_card_pressed.bind("Luna"))
	mateo_button.pressed.connect(_on_card_pressed.bind("Mateo"))
	resume_button.pressed.connect(close)
	quit_button.pressed.connect(_on_quit_to_menu)

	# Same linear 0..1 slider as SettingsOverlay - see
	# SettingsManager.set_master_volume_linear for why raw dB is wrong here.
	volume_slider.min_value = 0.0
	volume_slider.max_value = 1.0
	volume_slider.step = 0.01
	volume_slider.value_changed.connect(SettingsManager.set_master_volume_linear)
	reduced_motion_check.toggled.connect(SettingsManager.set_reduced_motion)

func open() -> void:
	visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	volume_slider.value = SettingsManager.get_master_volume_linear()
	reduced_motion_check.button_pressed = SettingsManager.reduced_motion
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

func _on_quit_to_menu() -> void:
	SaveManager.save_game()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	visible = false
	closed.emit()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
