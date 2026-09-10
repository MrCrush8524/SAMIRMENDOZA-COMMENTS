extends Control

@onready var cards: Array = [%CardBobby, %CardLuna, %CardMateo]
@onready var back_button: Button = %BackButton
@onready var heading: Label = %Heading

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]

func _ready() -> void:
	heading.text = LocalizationManager.t("select_dreamer")
	back_button.pressed.connect(_on_back)
	for i in cards.size():
		var card: BaseButton = cards[i]
		var dreamer_id: String = DREAMER_IDS[i]
		card.pressed.connect(_on_card_pressed.bind(dreamer_id))

func _on_card_pressed(dreamer_id: String) -> void:
	GameState.new_run(dreamer_id)
	SaveManager.save_game()
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

func _on_back() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
