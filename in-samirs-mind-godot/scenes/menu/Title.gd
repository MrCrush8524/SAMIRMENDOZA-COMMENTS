extends Control
## MainMenu_States packet (2026 refresh #3): the balcony/sunset hero shot
## with Nathan and the three pets, now delivered as 8 full-frame variants
## - one per left-side menu item, each with that item's pill baked in
## highlighted (purple glow). There is no "nothing highlighted" variant,
## so HeroImage always shows whichever item last had mouse/keyboard focus,
## defaulting to New Dream at scene load. This replaced the old single
## title_hero.png + engine-drawn hover style entirely.
##
## Also added a dedicated "Choose Your Companion" entry (paw icon, 4th
## pill) - reuses the same CharacterSelect.tscn flow as New Dream, just
## as an explicit direct entry point instead of only reachable mid-flow.
##
## Regions measured directly against the 1672x941 source image (pixel
## ruler crops); re-measure all of REGIONS/STATE_TEXTURES if the art
## changes again. The globe language picker has no baked slot in this
## art (unlike the old packet), so it now sits over open sky in the
## top-right corner instead of a baked pill.
const IMAGE_SIZE := Vector2(1672, 941)
const REGIONS := {
	"BtnNewDream": [78, 280, 330, 50],
	"BtnContinue": [78, 350, 330, 50],
	"BtnChapters": [78, 418, 330, 50],
	"BtnCompanion": [78, 486, 330, 50],
	"BtnSettings": [78, 554, 330, 50],
	"BtnSoundtrack": [78, 620, 330, 50],
	"BtnExtras": [78, 688, 330, 50],
	"BtnExit": [78, 756, 330, 50],
	"LangOption": [1560, 20, 90, 60],
}

const STATE_TEXTURES := {
	"BtnNewDream": preload("res://assets/menu_art/title_new_dream.png"),
	"BtnContinue": preload("res://assets/menu_art/title_continue.png"),
	"BtnChapters": preload("res://assets/menu_art/title_chapters.png"),
	"BtnCompanion": preload("res://assets/menu_art/title_companion.png"),
	"BtnSettings": preload("res://assets/menu_art/title_settings.png"),
	"BtnSoundtrack": preload("res://assets/menu_art/title_soundtrack.png"),
	"BtnExtras": preload("res://assets/menu_art/title_extras.png"),
	"BtnExit": preload("res://assets/menu_art/title_exit.png"),
}

@onready var hero_image: TextureRect = %HeroImage
@onready var btn_new_dream: Button = %BtnNewDream
@onready var btn_continue: Button = %BtnContinue
@onready var btn_chapters: Button = %BtnChapters
@onready var btn_companion: Button = %BtnCompanion
@onready var btn_exit: Button = %BtnExit
@onready var btn_lore: Button = %BtnLore
@onready var lang_option: OptionButton = %LangOption
@onready var title_label: Label = %TitleLabel
@onready var tagline_label: Label = %TaglineLabel
@onready var lore_overlay: Control = %LoreOverlay
@onready var settings_overlay: Control = %SettingsOverlay
@onready var extras_overlay: Control = %ExtrasOverlay
@onready var soundtrack_overlay: Control = %SoundtrackOverlay
@onready var load_game_overlay: Control = %LoadGameOverlay

const MENU_MUSIC := preload("res://assets/audio/menu/menu_loop.ogg")

func _ready() -> void:
	# Continue is a real "resume exactly where I was" now that Chapters is
	# its own button - so it needs an actual save to do anything, unlike
	# Chapters (always open; a fresh install still gets to try any chapter).
	btn_continue.disabled = not SaveManager.has_any_save()
	btn_new_dream.pressed.connect(_on_new_dream)
	btn_continue.pressed.connect(_on_continue)
	btn_chapters.pressed.connect(_on_chapters)
	btn_companion.pressed.connect(_on_new_dream)
	btn_exit.pressed.connect(_on_exit)
	%BtnSettings.pressed.connect(settings_overlay.open)
	%BtnExtras.pressed.connect(extras_overlay.open)
	%BtnSoundtrack.pressed.connect(soundtrack_overlay.open)
	btn_lore.pressed.connect(lore_overlay.open)
	lang_option.item_selected.connect(_on_lang_selected)
	for node_name in STATE_TEXTURES:
		var control: Control = get_node(NodePath(node_name))
		control.mouse_entered.connect(_set_highlight.bind(node_name))
		control.focus_entered.connect(_set_highlight.bind(node_name))
	resized.connect(_layout_hotspots)
	_layout_hotspots()
	_apply_language()
	btn_new_dream.grab_focus()
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

func _set_highlight(node_name: String) -> void:
	hero_image.texture = STATE_TEXTURES[node_name]

func _on_new_dream() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/CharacterSelect.tscn")

func _on_exit() -> void:
	get_tree().quit()

func _on_continue() -> void:
	# Disabled (see _ready) whenever there's no save at all. More than one
	# named dream can exist, so this opens a picker rather than silently
	# resuming whichever one happens to be newest.
	load_game_overlay.open()

func _on_chapters() -> void:
	# The "try any chapter" menu - always available, save or no save, so
	# a fresh install isn't locked out of it. Loads whatever save exists
	# (if any) so its "Resume" entry reflects it; a missing/invalid save
	# just leaves GameState at fresh-profile defaults, fine since every
	# other entry starts a chapter from scratch anyway.
	#
	# Lives in the persistent UiRoot autoload (not a local child here)
	# so the in-game pause menu can open the exact same overlay to jump
	# chapters mid-run.
	SaveManager.load_game()
	UiRoot.chapter_select_overlay.open()

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
