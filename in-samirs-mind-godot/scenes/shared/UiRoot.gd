extends CanvasLayer
## Persistent HUD/overlay layer: interaction prompt, journal popup, Dream
## Track popup, save toast. Lives above whatever chapter is currently
## loaded. TVs handle their own broadcast audio/prompt (see TVScreen.gd)
## since there's no in-engine video decoder to project a fullscreen feed.

@onready var prompt_label: Label = $Prompt
@onready var journal_popup: Panel = $JournalPopup
@onready var journal_text: Label = $JournalPopup/Margin/VBox/JournalText
@onready var journal_close: Button = $JournalPopup/Margin/VBox/CloseButton
@onready var track_popup: Panel = $TrackPopup
@onready var track_name_label: Label = $TrackPopup/Margin/VBox/TrackName
@onready var track_save_btn: Button = $TrackPopup/Margin/VBox/Row/SaveButton
@onready var track_play_btn: Button = $TrackPopup/Margin/VBox/Row/PlayButton
@onready var save_toast: Label = $SaveToast
@onready var nightmare_ui: ColorRect = $NightmareUI
@onready var nightmare_big_label: Label = $NightmareUI/BigLabel
@onready var nightmare_cashout_row: HBoxContainer = $NightmareUI/CashoutRow
@onready var pause_menu: Control = $PauseMenu

var _pending_pickup: Node = null

func _ready() -> void:
	journal_close.pressed.connect(_on_journal_close)
	track_save_btn.pressed.connect(_on_track_save)
	track_play_btn.pressed.connect(_on_track_play)
	prompt_label.text = ""
	journal_popup.visible = false
	track_popup.visible = false
	save_toast.visible = false

## Escape opens/closes the "change character" pause menu, but only during
## plain exploration — a Nightmare Passage already claims Escape for its
## own exit_nightmare (see NightmarePassage.gd), and the Backrooms is
## deliberately inescapable by player input, so both are excluded here.
## Also stays out of the way of any other popup already using the mouse
## (journal, dream track card) rather than stacking on top of them.
func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_cancel"):
		return
	if pause_menu.visible:
		pause_menu.close()
		get_viewport().set_input_as_handled()
		return
	if GameState.in_nightmare or GameState.in_backrooms:
		return
	if journal_popup.visible or track_popup.visible:
		return
	pause_menu.open()
	get_viewport().set_input_as_handled()

func set_prompt(text: String) -> void:
	prompt_label.text = text
	prompt_label.visible = not text.is_empty()

func show_journal(text: String) -> void:
	journal_text.text = text
	journal_popup.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _on_journal_close() -> void:
	journal_popup.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	SaveManager.save_game()

func show_dream_track_popup(track_name: String, stream: AudioStream, pickup_ref: Node) -> void:
	_pending_pickup = pickup_ref
	track_name_label.text = track_name
	track_popup.set_meta("stream", stream)
	track_popup.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _on_track_save() -> void:
	if _pending_pickup:
		_pending_pickup.confirm_dream_track_taken()
	track_popup.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _on_track_play() -> void:
	var stream: AudioStream = track_popup.get_meta("stream")
	if _pending_pickup:
		_pending_pickup.confirm_dream_track_taken()
	track_popup.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	AudioManager.play_dream_track_now(stream, func(): pass)

func flash_save_toast() -> void:
	save_toast.visible = true
	var t := create_tween()
	t.tween_interval(1.2)
	t.tween_callback(func(): save_toast.visible = false)

## Nightmare Passage minigame ladder UI — a soft color wash + centered
## label, faded in/out rather than snapped, to stay in the same gentle
## dreamcore language as the rest of the menu system (LoreOverlay's
## crossfades, the overlays' fades) instead of a stark countdown HUD.

const NIGHTMARE_FADE := 0.28

func _nightmare_fade_in() -> void:
	nightmare_ui.visible = true
	var t := create_tween()
	t.tween_property(nightmare_ui, "color:a", 0.55, NIGHTMARE_FADE)
	t.parallel().tween_property(nightmare_big_label, "modulate:a", 1.0, NIGHTMARE_FADE)
	await t.finished

func _nightmare_fade_out() -> void:
	var t := create_tween()
	t.tween_property(nightmare_ui, "color:a", 0.0, NIGHTMARE_FADE)
	t.parallel().tween_property(nightmare_big_label, "modulate:a", 0.0, NIGHTMARE_FADE)
	await t.finished
	nightmare_ui.visible = false
	nightmare_big_label.text = ""

func show_nightmare_countdown() -> void:
	await _nightmare_fade_in()
	for step in ["READY?", "3", "2", "1", "GO"]:
		nightmare_big_label.text = step
		await get_tree().create_timer(0.55).timeout
	await _nightmare_fade_out()

func show_nightmare_result(won: bool) -> void:
	await _nightmare_fade_in()
	nightmare_big_label.text = "CLEAR" if won else "FAILED"
	await get_tree().create_timer(0.6).timeout
	nightmare_big_label.text = "DEEPER" if won else "BACK ONE LEVEL"
	await get_tree().create_timer(0.7).timeout
	await _nightmare_fade_out()

## Returns true for "Go Deeper", false for "Wake Up".
func show_cashout_choice() -> bool:
	return await show_yes_no_choice("Keep going deeper?", "Go Deeper", "Wake Up")

## Generic reuse of the same fade/prompt/two-button UI for any binary
## choice (the Nightmare cash-out, the Doubt Catch token-immunity
## offer, whatever needs it next) — true picks yes_label, false picks
## no_label.
func show_yes_no_choice(prompt: String, yes_label: String, no_label: String) -> bool:
	await _nightmare_fade_in()
	nightmare_big_label.text = prompt
	var go_deeper_btn: Button = %GoDeeperButton
	var wake_up_btn: Button = %WakeUpButton
	go_deeper_btn.text = yes_label
	wake_up_btn.text = no_label
	nightmare_cashout_row.visible = true
	nightmare_cashout_row.modulate.a = 0.0
	var fade_row := create_tween()
	fade_row.tween_property(nightmare_cashout_row, "modulate:a", 1.0, NIGHTMARE_FADE)

	var result: bool = await _await_cashout_press()

	nightmare_cashout_row.visible = false
	await _nightmare_fade_out()
	return result

func _await_cashout_press() -> bool:
	var go_deeper_btn: Button = %GoDeeperButton
	var wake_up_btn: Button = %WakeUpButton
	var result := {"value": false}
	var on_go := func(): result["value"] = true; _cashout_chosen.emit()
	var on_wake := func(): result["value"] = false; _cashout_chosen.emit()
	go_deeper_btn.pressed.connect(on_go)
	wake_up_btn.pressed.connect(on_wake)
	await _cashout_chosen
	go_deeper_btn.pressed.disconnect(on_go)
	wake_up_btn.pressed.disconnect(on_wake)
	return result["value"]

signal _cashout_chosen

## Called by GameRoot when a Nightmare Passage ladder is interrupted
## (Escape, or a composure collapse) so no minigame UI await is left
## dangling forever waiting for a button press that will never come.
func force_close_nightmare_ui() -> void:
	if nightmare_cashout_row.visible:
		_cashout_chosen.emit()
	nightmare_ui.visible = false
	nightmare_ui.color.a = 0.0
	nightmare_big_label.modulate.a = 0.0
	nightmare_big_label.text = ""
	nightmare_cashout_row.visible = false
