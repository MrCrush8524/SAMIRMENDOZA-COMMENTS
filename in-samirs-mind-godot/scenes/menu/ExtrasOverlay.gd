extends Control
## Gallery/Trophies have no real content yet — the object-use reward
## loop (menu backgrounds, alternate portraits, hidden journal pages,
## etc. from the master brief) isn't built. Rather than pretend these
## buttons do something, they show an honest "nothing yet" message.

const IMAGE_SIZE := Vector2(1920, 1080)
const REGIONS := {
	"GalleryButton": [780, 287, 370, 78],
	"TrophiesButton": [780, 390, 370, 78],
	"BackButton": [780, 493, 370, 78],
}

@onready var gallery_button: Button = %GalleryButton
@onready var trophies_button: Button = %TrophiesButton
@onready var back_button: Button = %BackButton
@onready var empty_label: Label = %EmptyLabel

signal closed

func _ready() -> void:
	resized.connect(_layout_hotspots)
	visible = false
	back_button.pressed.connect(close)
	gallery_button.pressed.connect(func(): _show_empty("Nothing found yet."))
	trophies_button.pressed.connect(func(): _show_empty("Nothing found yet."))
	empty_label.visible = false

func open() -> void:
	if visible:
		return
	visible = true
	empty_label.visible = false
	_layout_hotspots()

func close() -> void:
	visible = false
	closed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		close()
		get_viewport().set_input_as_handled()

func _show_empty(text: String) -> void:
	empty_label.text = text
	empty_label.visible = true

func _layout_hotspots() -> void:
	for node_name in REGIONS:
		var control: Control = get_node(NodePath("%" + node_name))
		var rect := HeroLayout.map_rect(REGIONS[node_name], size, IMAGE_SIZE)
		control.position = rect.position
		control.size = rect.size
