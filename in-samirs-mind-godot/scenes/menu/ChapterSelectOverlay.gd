extends Control
## Opened from Title's Continue button once a save is loaded. First entry
## is always "Resume" (the player's exact saved position, chapter
## untouched) — everything after it is one entry per chapter the player
## has actually visited (GameState.visited_chapters), letting them jump
## back into any earlier chapter's start instead of only their last spot.
##
## Full-bleed chapter card art (chapterXX_card.png, 1920x1080, same class
## as title_hero.png etc.) has no baked buttons — unlike Title/Settings/
## etc. this overlay draws its own plain UI on top rather than using
## HeroLayout hotspot regions, since the card art is background-only.

const CHAPTER_INFO := {
	"chapter01": {"title": "Chapter I", "subtitle": "Memory Atrium"},
	"chapter02": {"title": "Chapter II", "subtitle": "The Infinite Neighborhood"},
	"chapter03": {"title": "Chapter III", "subtitle": "House That Knows You"},
	"chapter04": {"title": "Chapter IV", "subtitle": "Above the Street"},
	"chapter05": {"title": "Chapter V", "subtitle": "Pastel Dreamscape"},
	"chapter06": {"title": "Chapter VI", "subtitle": "Pink Hallway"},
	"mall": {"title": "Side Level", "subtitle": "Dreamcore Mall"},
	"zoo": {"title": "Side Level", "subtitle": "Clouds Zoo"},
	"terminal": {"title": "Side Level", "subtitle": "Dreamcore Terminal"},
	"museum": {"title": "Side Level", "subtitle": "Nightmare Museum"},
	"liminal_junction": {"title": "Side Level", "subtitle": "Liminal Junction"},
	"downtown": {"title": "Side Level", "subtitle": "Downtown"},
}
## Kept in fixed story order regardless of the (possibly out-of-order)
## order chapters were actually first visited in. All entries always show
## here (a dev-facing "try any chapter" menu) rather than being filtered
## to GameState.visited_chapters - there is no in-fiction reason to gate
## replay access, and testing every chapter from a fresh save otherwise
## requires playing the whole game first.
const CHAPTER_ORDER := [
	"chapter01", "chapter02", "chapter03", "chapter04", "chapter05", "chapter06",
	"mall", "zoo", "terminal", "museum", "liminal_junction", "downtown",
]

@onready var card_image: TextureRect = %CardImage
@onready var title_label: Label = %CardTitle
@onready var subtitle_label: Label = %CardSubtitle
@onready var prev_button: Button = %PrevButton
@onready var next_button: Button = %NextButton
@onready var select_button: Button = %SelectButton
@onready var back_button: Button = %BackButton

signal closed

var _entries: Array[String] = []  # "" means the special Resume entry
var _index: int = 0

func _ready() -> void:
	visible = false
	prev_button.pressed.connect(func(): _move(-1))
	next_button.pressed.connect(func(): _move(1))
	select_button.pressed.connect(_on_select)
	back_button.pressed.connect(close)

func open() -> void:
	_entries = [""]
	_entries.append_array(CHAPTER_ORDER)
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
	_index = wrapi(_index + delta, 0, _entries.size())
	_refresh()

func _refresh() -> void:
	var id := _entries[_index]
	prev_button.disabled = _entries.size() <= 1
	next_button.disabled = _entries.size() <= 1
	if id == "":
		var info: Dictionary = CHAPTER_INFO.get(GameState.chapter, {})
		title_label.text = "Resume"
		subtitle_label.text = "Continue exactly where you left off — %s" % info.get("subtitle", "")
		card_image.texture = _load_card(GameState.chapter)
		select_button.text = "Resume"
	else:
		var info: Dictionary = CHAPTER_INFO.get(id, {})
		title_label.text = info.get("title", id)
		subtitle_label.text = info.get("subtitle", "")
		card_image.texture = _load_card(id)
		select_button.text = "Replay From Start"

func _load_card(chapter_id: String) -> Texture2D:
	var path := "res://assets/menu_art/%s_card.png" % chapter_id.replace("chapter0", "chapter")
	if ResourceLoader.exists(path):
		return load(path)
	return null

func _on_select() -> void:
	var id := _entries[_index]
	if id != "":
		GameState.chapter = id
		GameState.spawn_id = "start"
		GameState.has_last_position = false
	AudioManager.stop_menu()
	# This overlay now lives in the persistent UiRoot autoload (so the
	# in-game pause menu can open it too), not inside Title's own scene
	# tree - Title unloading used to erase this visible=true state for
	# free on a scene change, but UiRoot never unloads, so it must be
	# cleared explicitly or it'd still be covering the screen once the
	# new chapter finishes loading.
	visible = false
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")
