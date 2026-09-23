extends Area3D
## Master Build Brief 3.1/17.1: a validated-marker spawn that is either a
## real objective (advances the chapter) or a decoy (launches a Nightmare
## Arcade mini-game). Both use the identical interaction prompt/outline so
## the UI never reveals which is which - is_decoy is set once at spawn
## time by ChapterObjectiveSpawner, never surfaced to the player.
##
## Deliberately no class_name: this project runs Godot headlessly from
## the command line for testing, and a brand-new class_name isn't
## resolvable until the editor has regenerated its global script class
## cache - see NightmareArcadeUi.gd for the same reasoning. Other scripts
## reference this one structurally or via preload instead.

signal resolved(objective, was_decoy)

@export var is_decoy: bool = false

var _chapter_id: String = ""
var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true; _update_prompt())
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false; UiRoot.set_prompt(""))

func configure(chapter_id: String, decoy: bool) -> void:
	_chapter_id = chapter_id
	is_decoy = decoy

func _update_prompt() -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to search.")

func interact() -> void:
	UiRoot.set_prompt("")
	if is_decoy:
		# Freeze the 3D world under the same countdown/result UI the void-
		# fall catch and Nightmare Passage ladder already use, so Nightmare
		# Arcade sessions read as one consistent system rather than a
		# bespoke overlay per trigger context.
		var last_pos: Vector3 = GameState.last_position
		var last_yaw: float = GameState.last_yaw
		var has_return_point: bool = GameState.has_last_position
		await UiRoot.show_nightmare_countdown()
		var mg_scene: PackedScene = load(NightmareArcadePool.random_game())
		var minigame: NightmareMinigame = mg_scene.instantiate()
		get_parent().add_child(minigame)
		# Without this the minigame sits at its own .tscn authored local
		# origin under the chapter, unrelated to where this decoy (and the
		# player standing at it) actually is - place it right here so its
		# interact-zone gating lines up with the player.
		minigame.global_position = global_position
		if is_instance_valid(GameState.current_player):
			minigame.rotation.y = GameState.current_player.rotation.y
		minigame.configure(1)
		var won: bool = await minigame.resolved
		if is_instance_valid(minigame):
			minigame.queue_free()
		await UiRoot.show_nightmare_result(won)
		# Ordinary mini-game failure is a mild in-chapter setback - return
		# to the last safe spot - NOT the Evil Larry chapter-decrement path
		# (brief section 3.3/17.2). Winning leaves the player exactly
		# where they were; there is no reward beyond having dodged the
		# setback, matching "Nightmare Arcade failure is NOT punishment".
		if not won and has_return_point and is_instance_valid(GameState.current_player):
			GameState.current_player.set_spawn(last_pos, last_yaw)
		resolved.emit(self, true)
		queue_free()
	else:
		GameState.record_chapter_objective(_chapter_id, name)
		UiRoot.flash_toast("Found. (%d of %d)" % [
			GameState.chapter_objectives_found.get(_chapter_id, []).size(),
			GameState.chapter_required_counts.get(_chapter_id, 0),
		])
		resolved.emit(self, false)
		SaveManager.save_game()
		queue_free()
