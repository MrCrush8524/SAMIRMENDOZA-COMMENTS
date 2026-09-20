extends Area3D
## A Chapter III Room Check — a scripted moment where the house shows the
## player it has changed. Walking into the volume completes it once; no
## interact prompt, since a discovery beat like this reads better as
## something that simply happens to the player rather than something they
## have to ask for.

@export var check_id: String = ""
@export var check_text: String = ""

const REQUIRED_CHECKS := 3

func _ready() -> void:
	body_entered.connect(_on_entered)

func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if GameState.chapter3_room_checks.has(check_id):
		return
	GameState.chapter3_room_checks.append(check_id)
	GameState.chapter3_mutation_stage = GameState.chapter3_room_checks.size()
	UiRoot.show_journal(check_text)
	UiRoot.flash_toast("Room Check complete. (%d of %d)" % [GameState.chapter3_room_checks.size(), REQUIRED_CHECKS])
	SaveManager.save_game()
