extends Control

@onready var btn_new_dream: Button = %BtnNewDream
@onready var btn_continue: Button = %BtnContinue
@onready var lang_option: OptionButton = %LangOption
@onready var title_label: Label = %TitleLabel
@onready var tagline_label: Label = %TaglineLabel

const MENU_MUSIC := preload("res://assets/audio/menu/menu_loop.ogg")

func _ready() -> void:
	btn_continue.disabled = not SaveManager.has_valid_save()
	btn_new_dream.pressed.connect(_on_new_dream)
	btn_continue.pressed.connect(_on_continue)
	lang_option.item_selected.connect(_on_lang_selected)
	_apply_language()
	AudioManager.play_menu(MENU_MUSIC)

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
	title_label.text = LocalizationManager.t("title")
	tagline_label.text = LocalizationManager.t("tagline")
	btn_new_dream.text = LocalizationManager.t("new_dream")
	btn_continue.text = LocalizationManager.t("continue")
