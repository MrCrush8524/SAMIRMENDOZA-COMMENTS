extends Control
## Opened from Title's Continue button. Lists every named save under
## user://saves/ (including the silent Autosave slot every gameplay
## checkpoint writes to) and lets the player pick which dream to
## resume by name, instead of silently loading whichever is newest.

const CHAPTER_LABELS := {
	"chapter01": "Chapter I", "chapter02": "Chapter II", "chapter03": "Chapter III",
	"chapter04": "Chapter IV", "chapter05": "Chapter V", "chapter06": "Chapter VI",
	"chapter07": "Chapter VII", "chapter08": "Chapter VIII", "chapter09": "Chapter IX",
	"chapter10": "Chapter X",
}

@onready var title_label: Label = %CardTitle
@onready var subtitle_label: Label = %CardSubtitle
@onready var prev_button: Button = %PrevButton
@onready var next_button: Button = %NextButton
@onready var select_button: Button = %SelectButton
@onready var delete_button: Button = %DeleteButton
@onready var back_button: Button = %BackButton
@onready var empty_label: Label = %EmptyLabel

signal closed

var _saves: Array[Dictionary] = []
var _index: int = 0

func _ready() -> void:
	visible = false
	prev_button.pressed.connect(func(): _move(-1))
	next_button.pressed.connect(func(): _move(1))
	select_button.pressed.connect(_on_select)
	delete_button.pressed.connect(_on_delete)
	back_button.pressed.connect(close)

func open() -> void:
	_saves = SaveManager.list_saves()
	_index = 0
	visible = true
	_refresh()

func close() -> void:
	visible = false
	closed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		close()
		get_viewport().set_input_as_handled()

func _move(delta: int) -> void:
	if _saves.is_empty():
		return
	_index = wrapi(_index + delta, 0, _saves.size())
	_refresh()

func _refresh() -> void:
	var has_saves := not _saves.is_empty()
	prev_button.disabled = _saves.size() <= 1
	next_button.disabled = _saves.size() <= 1
	select_button.disabled = not has_saves
	delete_button.disabled = not has_saves
	empty_label.visible = not has_saves
	title_label.visible = has_saves
	subtitle_label.visible = has_saves
	if not has_saves:
		empty_label.text = "No saved dreams yet."
		return
	var s: Dictionary = _saves[_index]
	title_label.text = String(s.get("save_name", "Unnamed Dream"))
	var chapter_label: String = CHAPTER_LABELS.get(s.get("chapter", ""), s.get("chapter", ""))
	subtitle_label.text = "%s — %s" % [s.get("dreamer", ""), chapter_label]

func _on_select() -> void:
	if _saves.is_empty():
		return
	var s: Dictionary = _saves[_index]
	if not SaveManager.load_game_file(s["file"]):
		return
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

func _on_delete() -> void:
	if _saves.is_empty():
		return
	SaveManager.delete_save(_saves[_index]["file"])
	_saves = SaveManager.list_saves()
	_index = 0
	_refresh()
