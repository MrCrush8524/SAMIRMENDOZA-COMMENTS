extends Control
## character_select_hero.png bakes the background, heading, and the three
## doors; only Back is a baked button (Menu_Chapter_Art brief). Cards are
## NOT baked into the art — positioned here over the three doors, sized
## from this image's actual door placement (visually estimated, same
## caveat as button_regions.json: verify in engine, not pixel-exact).

const IMAGE_SIZE := Vector2(1920, 1080)
const BACK_REGION := [52, 948, 216, 75]
const CARD_REGIONS := {
	"CardBobby": [322, 260, 260, 380],
	"CardLuna": [835, 260, 260, 380],
	"CardMateo": [1352, 260, 260, 380],
}

@onready var cards: Array = [%CardBobby, %CardLuna, %CardMateo]
@onready var back_button: Button = %BackButton
@onready var heading: Label = %Heading

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]

func _ready() -> void:
	heading.text = LocalizationManager.t("select_dreamer")
	heading.visible = LocalizationManager.current_lang != "en" # baked "CHOOSE YOUR DREAMER" covers English
	back_button.pressed.connect(_on_back)
	resized.connect(_layout_hotspots)
	_layout_hotspots()
	for i in cards.size():
		var card: BaseButton = cards[i]
		var dreamer_id: String = DREAMER_IDS[i]
		card.pressed.connect(_on_card_pressed.bind(dreamer_id))

func _layout_hotspots() -> void:
	var back_rect := HeroLayout.map_rect(BACK_REGION, size, IMAGE_SIZE)
	back_button.position = back_rect.position
	back_button.size = back_rect.size
	for node_name in CARD_REGIONS:
		var control: Control = get_node(NodePath(node_name))
		var rect := HeroLayout.map_rect(CARD_REGIONS[node_name], size, IMAGE_SIZE)
		control.position = rect.position
		control.size = rect.size

func _on_card_pressed(dreamer_id: String) -> void:
	GameState.new_run(dreamer_id)
	SaveManager.save_game()
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

func _on_back() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
