extends Control
## Buttons are baked into title_hero.png (Menu_Chapter_Art packet); these
## are transparent click regions positioned exactly under the baked art
## via HeroLayout, using the source-pixel rectangles from
## Menu_Chapter_Art/button_regions.json (verified against the delivered
## 1920x1080 image before use).

const IMAGE_SIZE := Vector2(1920, 1080)
const REGIONS := {
	"BtnNewDream": [1298, 164, 529, 101],
	"BtnContinue": [1298, 290, 529, 101],
	"BtnSettings": [1298, 415, 529, 101],
	"BtnExtras": [1298, 541, 529, 101],
	"BtnSoundtrack": [1298, 666, 529, 101],
	"BtnLore": [1298, 791, 529, 101],
	"LangOption": [47, 941, 85, 83],
}

@onready var btn_new_dream: Button = %BtnNewDream
@onready var btn_continue: Button = %BtnContinue
@onready var btn_lore: Button = %BtnLore
@onready var lang_option: OptionButton = %LangOption
@onready var title_label: Label = %TitleLabel
@onready var tagline_label: Label = %TaglineLabel
@onready var lore_overlay: Control = %LoreOverlay
@onready var settings_overlay: Control = %SettingsOverlay
@onready var extras_overlay: Control = %ExtrasOverlay
@onready var soundtrack_overlay: Control = %SoundtrackOverlay

const MENU_MUSIC := preload("res://assets/audio/menu/menu_loop.ogg")

func _ready() -> void:
	btn_continue.disabled = not SaveManager.has_valid_save()
	btn_new_dream.pressed.connect(_on_new_dream)
	btn_continue.pressed.connect(_on_continue)
	btn_lore.pressed.connect(_on_lore)
	%BtnSettings.pressed.connect(settings_overlay.open)
	%BtnExtras.pressed.connect(extras_overlay.open)
	%BtnSoundtrack.pressed.connect(soundtrack_overlay.open)
	lang_option.item_selected.connect(_on_lang_selected)
	resized.connect(_layout_hotspots)
	_layout_hotspots()
	_apply_language()
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

func _on_lore() -> void:
	# LoreOverlay never touches AudioManager — opening/closing it is not a
	# scene change, so the menu music already playing is untouched.
	lore_overlay.open()

func _on_new_dream() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/CharacterSelect.tscn")

func _on_continue() -> void:
	if not SaveManager.load_game():
		btn_continue.disabled = true
		return
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

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
