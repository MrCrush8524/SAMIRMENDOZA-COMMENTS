extends Control
## Buttons baked into settings_hero.png; real controls layered underneath
## each one via HeroLayout, same pattern as Title/CharacterSelect. Never
## touches AudioManager's menu player — only the Master bus volume and
## persisted settings, so opening/closing this has no effect on music
## continuity.

const IMAGE_SIZE := Vector2(1920, 1080)
const REGIONS := {
	"VolumeSlider": [655, 185, 380, 78],
	"LangOption": [655, 292, 380, 78],
	"ReducedMotionCheck": [655, 399, 380, 78],
	"BackButton": [655, 507, 380, 78],
}

@onready var volume_slider: HSlider = %VolumeSlider
@onready var lang_option: OptionButton = %LangOption
@onready var reduced_motion_check: CheckButton = %ReducedMotionCheck
@onready var back_button: Button = %BackButton

signal closed

func _ready() -> void:
	resized.connect(_layout_hotspots)
	visible = false
	back_button.pressed.connect(close)

	# Linear 0..1 slider (perceptual loudness), not raw dB - see
	# SettingsManager.set_master_volume_linear for why: dB is
	# logarithmic, so a slider mapped straight to dB spends most of its
	# travel in already-silent territory and reads as an on/off switch.
	volume_slider.min_value = 0.0
	volume_slider.max_value = 1.0
	volume_slider.step = 0.01
	volume_slider.value = SettingsManager.get_master_volume_linear()
	volume_slider.value_changed.connect(SettingsManager.set_master_volume_linear)

	lang_option.item_count = 3
	lang_option.set_item_text(0, "English")
	lang_option.set_item_text(1, "Español")
	lang_option.set_item_text(2, "Português (BR)")
	lang_option.item_selected.connect(_on_lang_selected)

	reduced_motion_check.text = "Reduced Motion"
	reduced_motion_check.button_pressed = SettingsManager.reduced_motion
	reduced_motion_check.toggled.connect(SettingsManager.set_reduced_motion)

func open() -> void:
	if visible:
		return
	var codes := ["en", "es", "pt-BR"]
	lang_option.selected = codes.find(LocalizationManager.current_lang)
	visible = true
	_layout_hotspots()
	volume_slider.grab_focus()

func close() -> void:
	visible = false
	closed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		close()
		get_viewport().set_input_as_handled()

func _on_lang_selected(index: int) -> void:
	var codes := ["en", "es", "pt-BR"]
	LocalizationManager.set_language(codes[index])

func _layout_hotspots() -> void:
	for node_name in REGIONS:
		var control: Control = get_node(NodePath("%" + node_name))
		var rect := HeroLayout.map_rect(REGIONS[node_name], size, IMAGE_SIZE)
		control.position = rect.position
		if node_name == "LangOption":
			continue # OptionButton enforces its own minimum width (see Title.gd)
		control.size = rect.size
