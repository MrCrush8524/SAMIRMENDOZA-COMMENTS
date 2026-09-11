extends Area3D
## Chapter II+ "Doubt Catch" mechanic: if Doubt touches the player, it's
## not an instant effect — it drops them into a quick minigame instead.
## Win: a Dream Token (unlocks something later, TBD). Lose: respawn
## nearby, no token. Attach this alongside a Doubt sprite's own
## collision in whichever chapter it's meant to be genuinely dangerous
## in — per design note, that starts at Chapter II, not Chapter I.

var _triggered: bool = false

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if _triggered or not body.is_in_group("player"):
		return
	_triggered = true
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root:
		game_root.start_doubt_catch()

## Call after the catch resolves if this Doubt should be able to catch
## the player again (e.g. it wanders back into range later).
func reset() -> void:
	_triggered = false
