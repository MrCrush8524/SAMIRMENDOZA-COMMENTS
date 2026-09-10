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

var _pending_pickup: Node = null

func _ready() -> void:
	journal_close.pressed.connect(_on_journal_close)
	track_save_btn.pressed.connect(_on_track_save)
	track_play_btn.pressed.connect(_on_track_play)
	prompt_label.text = ""
	journal_popup.visible = false
	track_popup.visible = false
	save_toast.visible = false

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
