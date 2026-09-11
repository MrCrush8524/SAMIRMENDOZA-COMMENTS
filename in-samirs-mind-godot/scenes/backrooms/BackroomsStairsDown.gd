extends Area3D
## The map's "Long stairway down" — stepping onto it commits the player
## one level deeper into the Backrooms. Purely a counter for now
## (GameState.backrooms_level); once more level chunks exist, going
## deeper will mean loading harder/stranger geometry, same as chapters.

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		monitoring = false # one commit per visit — walking back over it doesn't stack
		GameState.backrooms_level += 1
		UiRoot.set_prompt("")
		UiRoot.show_journal("The stairs keep going. You're deeper now (level %d)." % GameState.backrooms_level)
