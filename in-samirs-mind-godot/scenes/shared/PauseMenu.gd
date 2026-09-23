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
## Also the only way out of a run mid-chapter, with four real options
## instead of just a character swap:
## - Save: writes a deliberately player-named save (SaveManager.save_game_as),
##   separate from the silent Autosave slot every pickup/door already
##   maintains, so a player can keep several named dreams side by side.
## - Main Menu / Exit: both route through _confirm_leave, which always
##   asks "save before leaving?" first rather than silently discarding
##   whatever wasn't yet autosaved since the last checkpoint.
## A quick volume/reduced-motion row covers the rest of what Settings
## offers, without needing Title's overlay (that one's laid out against
## Title's own hero art, not reachable mid-run).

@onready var bobby_button: BaseButton = %PauseCardBobby
@onready var luna_button: BaseButton = %PauseCardLuna
@onready var mateo_button: BaseButton = %PauseCardMateo
@onready var resume_button: Button = %PauseResumeButton
@onready var save_button: Button = %PauseSaveButton
@onready var chapters_button: Button = %PauseChaptersButton
@onready var main_menu_button: Button = %PauseMainMenuButton
@onready var exit_button: Button = %PauseExitButton
@onready var current_label: Label = %PauseCurrentLabel
@onready var volume_slider: HSlider = %PauseVolumeSlider
@onready var reduced_motion_check: CheckButton = %PauseReducedMotionCheck

@onready var confirm_leave_panel: Control = %ConfirmLeavePanel
@onready var save_and_leave_button: Button = %SaveAndLeaveButton
@onready var dont_save_button: Button = %DontSaveButton
@onready var cancel_leave_button: Button = %CancelLeaveButton

@onready var save_name_panel: Control = %SaveNamePanel
@onready var save_name_edit: LineEdit = %SaveNameEdit
@onready var save_confirm_button: Button = %SaveConfirmButton
@onready var save_cancel_button: Button = %SaveCancelButton

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]

signal closed

## "" once a name dialog closes with just a save (Save button); "menu"
## or "quit" when it was opened via Main Menu/Exit's "Save & Leave" so
## _on_save_confirm knows to leave afterward instead of staying open.
var _pending_leave: String = ""
var _last_save_name: String = ""

func _ready() -> void:
	visible = false
	bobby_button.pressed.connect(_on_card_pressed.bind("Bobby"))
	luna_button.pressed.connect(_on_card_pressed.bind("Luna"))
	mateo_button.pressed.connect(_on_card_pressed.bind("Mateo"))
	resume_button.pressed.connect(close)
	save_button.pressed.connect(func(): _open_save_dialog(""))
	# Shares the exact overlay Title's own Chapters button opens - see
	# UiRoot.gd, which owns the instance for that reason. Left visible
	# underneath while it's open (its own opaque background fully covers
	# the screen either way), so cancelling it lands back on this pause
	# menu instead of dropping straight back into gameplay.
	chapters_button.pressed.connect(func(): UiRoot.chapter_select_overlay.open(chapters_button))
	main_menu_button.pressed.connect(func(): _confirm_leave("menu"))
	exit_button.pressed.connect(func(): _confirm_leave("quit"))

	save_and_leave_button.pressed.connect(func(): _open_save_dialog(_pending_leave))
	dont_save_button.pressed.connect(func(): _leave(_pending_leave))
	cancel_leave_button.pressed.connect(func(): confirm_leave_panel.visible = false)

	save_confirm_button.pressed.connect(_on_save_confirm)
	save_cancel_button.pressed.connect(func(): save_name_panel.visible = false)
	save_name_edit.text_submitted.connect(func(_t): _on_save_confirm())

	# Same linear 0..1 slider as SettingsOverlay - see
	# SettingsManager.set_master_volume_linear for why raw dB is wrong here.
	volume_slider.min_value = 0.0
	volume_slider.max_value = 1.0
	volume_slider.step = 0.01
	volume_slider.value_changed.connect(SettingsManager.set_master_volume_linear)
	reduced_motion_check.toggled.connect(SettingsManager.set_reduced_motion)

func open() -> void:
	visible = true
	confirm_leave_panel.visible = false
	save_name_panel.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	volume_slider.value = SettingsManager.get_master_volume_linear()
	reduced_motion_check.button_pressed = SettingsManager.reduced_motion
	_refresh()
	resume_button.grab_focus()

func close() -> void:
	visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	closed.emit()

func _refresh() -> void:
	current_label.text = "Companion: %s" % GameState.dreamer

func _on_card_pressed(dreamer_id: String) -> void:
	if dreamer_id == GameState.dreamer:
		return
	GameState.dreamer = dreamer_id
	if GameState.current_player:
		GameState.current_player.refresh_dreamer_visuals()
	_refresh()

func _confirm_leave(dest: String) -> void:
	_pending_leave = dest
	confirm_leave_panel.visible = true
	cancel_leave_button.grab_focus()

func _open_save_dialog(dest: String) -> void:
	_pending_leave = dest
	confirm_leave_panel.visible = false
	var default_name := _last_save_name if not _last_save_name.is_empty() else "%s's Dream" % GameState.dreamer
	save_name_edit.text = default_name
	save_name_panel.visible = true
	save_name_edit.grab_focus()
	save_name_edit.select_all()

func _on_save_confirm() -> void:
	var typed := save_name_edit.text.strip_edges()
	var save_name := typed if not typed.is_empty() else "%s's Dream" % GameState.dreamer
	_last_save_name = save_name
	SaveManager.save_game_as(save_name)
	save_name_panel.visible = false
	if not _pending_leave.is_empty():
		_leave(_pending_leave)

func _leave(dest: String) -> void:
	confirm_leave_panel.visible = false
	if dest.is_empty():
		return
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	visible = false
	closed.emit()
	if dest == "quit":
		get_tree().quit()
	else:
		get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
