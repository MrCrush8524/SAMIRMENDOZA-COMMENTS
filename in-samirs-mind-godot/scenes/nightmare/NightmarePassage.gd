class_name NightmarePassage
extends Node3D
## Shared behavior for every Nightmare Passage (Decay/Wander/Arcade):
## Escape always returns the player to their exact entry point, and
## composure drains only where a subclass scene sets a nonzero rate
## (Decay; Arcade a little; Wander none) per MASTER_REBUILD_BRIEF.md.
## Dream Charm (GameState.inventory has "dream_charm") blocks collapse
## entirely, per "Dream Charm can protect against composure collapse."

@export var composure_drain_per_sec: float = 0.0

func _process(delta: float) -> void:
	if composure_drain_per_sec <= 0.0:
		return
	if GameState.inventory.has("dream_charm"):
		return
	GameState.composure = maxf(0.0, GameState.composure - composure_drain_per_sec * delta)
	if GameState.composure <= 0.0:
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.collapse_from_nightmare()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		var game_root: Node = get_tree().get_first_node_in_group("game_root")
		if game_root:
			game_root.exit_nightmare()
		get_viewport().set_input_as_handled()
