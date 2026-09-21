extends Control
## Cards float in a dreamt backdrop instead of sitting on baked doors —
## a plain centered HBoxContainer, no per-image pixel regions to maintain.

const DREAMER_IDS := ["Bobby", "Luna", "Mateo"]
const FLOAT_AMPLITUDE := 10.0
const FLOAT_PERIOD := 3.2

@onready var cards: Array = [%CardBobby, %CardLuna, %CardMateo]
@onready var back_button: Button = %BackButton
@onready var heading: Label = %Heading

func _ready() -> void:
	heading.text = LocalizationManager.t("select_dreamer")
	back_button.pressed.connect(_on_back)
	for i in cards.size():
		var card: BaseButton = cards[i]
		var dreamer_id: String = DREAMER_IDS[i]
		card.pressed.connect(_on_card_pressed.bind(dreamer_id))
	# Wait one frame so the HBoxContainer has laid the cards out before we
	# read their resting position.y to float around.
	await get_tree().process_frame
	for i in cards.size():
		_start_float(cards[i], i)
	cards[0].grab_focus()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_on_back()
		get_viewport().set_input_as_handled()

func _start_float(card: Control, index: int) -> void:
	# Stagger the starting angle per card so they don't bob in lockstep.
	var phase: float = TAU * index / float(cards.size())
	var base_y := card.position.y
	var t := create_tween().set_loops()
	t.tween_method(
		func(angle: float) -> void:
			card.position.y = base_y + sin(angle + phase) * FLOAT_AMPLITUDE,
		0.0, TAU, FLOAT_PERIOD
	).set_trans(Tween.TRANS_LINEAR)

func _on_card_pressed(dreamer_id: String) -> void:
	GameState.new_run(dreamer_id)
	SaveManager.save_game()
	AudioManager.stop_menu()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/player/GameRoot.tscn")

func _on_back() -> void:
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
