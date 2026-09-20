extends Area3D
## A Chapter IV rooftop discovery — grounded, physical finds (an
## abandoned chair, a family photograph, a weather station reading)
## rather than journal fragments. Walking up to one and completing it
## once advances chapter4_mutation_stage, the same escalating-stage
## pattern Chapter III's Room Checks use.

@export var discovery_id: String = ""
@export var discovery_text: String = ""

const REQUIRED_DISCOVERIES := 3

func _ready() -> void:
	body_entered.connect(_on_entered)

func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if GameState.chapter4_discoveries.has(discovery_id):
		return
	GameState.chapter4_discoveries.append(discovery_id)
	GameState.chapter4_mutation_stage = GameState.chapter4_discoveries.size()
	UiRoot.show_journal(discovery_text)
	UiRoot.flash_toast("Discovery found. (%d of %d)" % [GameState.chapter4_discoveries.size(), REQUIRED_DISCOVERIES])
	SaveManager.save_game()
