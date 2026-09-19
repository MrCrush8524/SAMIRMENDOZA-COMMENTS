extends Control
## Buttons are baked into title_hero.png (Menu_Chapter_Art packet); these
## are transparent click regions positioned exactly under the baked art
## via HeroLayout, using the source-pixel rectangles from
## Menu_Chapter_Art/button_regions.json (verified against the delivered
## 1920x1080 image before use).

## Pool/motel title art (2026 refresh #2) - a horizontal pill-button row
## replaced the old right-side stack, and added a dedicated Chapters
## button (Continue no longer doubles as the chapter picker - see
## _on_continue/_on_chapters). Measured directly against this exact
## 1671x941 source image; re-measure both if the art changes again.
const IMAGE_SIZE := Vector2(1671, 941)
const REGIONS := {
	"BtnNewDream": [70, 838, 210, 62],
	"BtnContinue": [320, 838, 205, 62],
	"BtnChapters": [563, 838, 205, 62],
	"BtnSettings": [809, 838, 199, 62],
	"BtnSoundtrack": [1047, 838, 230, 62],
	"BtnExtras": [1313, 838, 187, 62],
	"LangOption": [1548, 839, 64, 61],
}

@onready var btn_new_dream: Button = %BtnNewDream
@onready var btn_continue: Button = %BtnContinue
@onready var btn_chapters: Button = %BtnChapters
@onready var btn_lore: Button = %BtnLore
@onready var lang_option: OptionButton = %LangOption
@onready var title_label: Label = %TitleLabel
@onready var tagline_label: Label = %TaglineLabel
@onready var lore_overlay: Control = %LoreOverlay
@onready var settings_overlay: Control = %SettingsOverlay
@onready var extras_overlay: Control = %ExtrasOverlay
@onready var soundtrack_overlay: Control = %SoundtrackOverlay
@onready var chapter_select_overlay: Control = %ChapterSelectOverlay
@onready var name_prompt_overlay: Control = %NamePromptOverlay

const MENU_MUSIC := preload("res://assets/audio/menu/menu_loop.ogg")

func _ready() -> void:
	# Continue is a real "resume exactly where I was" now that Chapters is
	# its own button - so it needs an actual save to do anything, unlike
	# Chapters (always open; a fresh install still gets to try any chapter).
	btn_continue.disabled = not SaveManager.has_valid_save()
	btn_new_dream.pressed.connect(_on_new_dream)
	btn_continue.pressed.connect(_on_continue)
	btn_chapters.pressed.connect(_on_chapters)
	%BtnSettings.pressed.connect(settings_overlay.open)
	%BtnExtras.pressed.connect(extras_overlay.open)
	%BtnSoundtrack.pressed.connect(soundtrack_overlay.open)
	btn_lore.pressed.connect(lore_overlay.open)
	lang_option.item_selected.connect(_on_lang_selected)
	resized.connect(_layout_hotspots)
	_layout_hotspots()
	_apply_language()
	# Title.tscn is a real scene (not an overlay) - stepping into Character
	# Select and hitting Back reloads it from scratch, which would restart
	# this track from position 0 with a fresh fade-in every time if we
	# always called play_menu here, even though the same loop was already
	# playing seconds ago.
	if AudioManager.menu_player.stream != MENU_MUSIC or not AudioManager.menu_player.playing:
		AudioManager.play_menu(MENU_MUSIC)

func _layout_hotspots() -> void:
	for node_name in REGIONS:
		var control: Control = get_node(NodePath(node_name))
		var rect := HeroLayout.map_rect(REGIONS[node_name], size, IMAGE_SIZE)
		control.position = rect.position
		if node_name == "LangOption":
			# OptionButton enforces its own minimum width for the selected
			# item's text, which is wider than the baked globe icon —
			# forcing .size here would silently no-op on width. Anchor it
			# at the globe's position instead of pretending it fits inside it.
			continue
		control.size = rect.size

func _on_new_dream() -> void:
	# "Create a profile" is just naming the save before picking a dreamer
	# — the actual transition to Character Select happens once they
	# confirm (see _on_name_confirmed), not immediately here.
	if not name_prompt_overlay.confirmed.is_connected(_on_name_confirmed):
		name_prompt_overlay.confirmed.connect(_on_name_confirmed, CONNECT_ONE_SHOT)
	name_prompt_overlay.open()

func _on_name_confirmed() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/CharacterSelect.tscn")

func _on_continue() -> void:
	# Disabled (see _ready) whenever there's no valid save, so reaching
	# here means a real save exists - go straight back into it, exactly
	# where GameState.last_position/chapter left off, no picker in between.
	if not SaveManager.load_game():
		btn_continue.disabled = true
		return
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

func _on_chapters() -> void:
	# The "try any chapter" menu - always available, save or no save, so
	# a fresh install isn't locked out of it. Loads whatever save exists
	# (if any) so its "Resume" entry reflects it; a missing/invalid save
	# just leaves GameState at fresh-profile defaults, fine since every
	# other entry starts a chapter from scratch anyway.
	SaveManager.load_game()
	chapter_select_overlay.open()

func _on_lang_selected(index: int) -> void:
	var codes := ["en", "es", "pt-BR"]
	LocalizationManager.set_language(codes[index])
	_apply_language()

func _apply_language() -> void:
	# title_hero.png bakes "IN SAMIR'S MIND / Walk through dreams" in
	# English only (Menu_Chapter_Art brief: baked English text does not
	# translate itself). Show our own labels only when they'd add
	# information the art doesn't already give in the selected language.
	var is_english := LocalizationManager.current_lang == "en"
	title_label.visible = not is_english
	tagline_label.visible = not is_english
	title_label.text = LocalizationManager.t("title")
	tagline_label.text = LocalizationManager.t("tagline")
