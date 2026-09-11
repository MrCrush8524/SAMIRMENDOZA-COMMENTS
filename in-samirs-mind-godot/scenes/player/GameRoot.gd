extends Node3D
## Instances the player once, then hands chapter loading to SceneLoader.
## The chapter scene provides a "start" Marker3D the player spawns at
## (or the save's stored transform, once validated).

const PLAYER_SCENE := preload("res://scenes/player/Player.tscn")
const MAIN_SOUNDTRACK := preload("res://assets/audio/main_soundtrack/main_soundtrack.ogg")

var player: CharacterBody3D

## Where to put the player back when a Nightmare Passage ends — set by
## enter_nightmare, consumed by _return_from_nightmare.
var _nightmare_return_chapter: String = ""
var _nightmare_return_position: Vector3 = Vector3.ZERO
var _nightmare_return_yaw: float = 0.0

## Nightmare_Passage_Minigame_Specs.md's per-room minigame pools. Empty
## for a room means it has no minigame yet — the passage still works as
## plain exploration (Escape/collapse both still function), it just
## never starts a ladder round. Add more scene paths here as they're
## built; one is picked at random each round.
const MINIGAME_POOLS := {
	"decay": ["res://scenes/nightmare/minigames/DecayDontTouchWater.tscn"],
	"wander": [],
	"arcade": [],
}

var _current_nightmare_id: String = ""
var _current_minigame: NightmareMinigame = null
var _ladder_cancelled: bool = false

## Flavor names for the Lost Passage's artifacts/doors, keyed by the ids
## actually placed in the currently-built level chunks. Deliberately not
## the full eventual 10 artifacts / however many doors — only entries
## with a real physical instance somewhere belong here, or the random
## target could point at something that doesn't exist yet to find.
const BACKROOMS_ARTIFACT_NAMES := {
	"brass_key": "a tarnished brass key",
	"pocket_watch": "a stopped pocket watch",
	"childs_shoe": "a single child's shoe",
	"glass_marble": "a glass marble",
}
const BACKROOMS_DOOR_NAMES := {
	"door_red": "the door with red paint flaking off it",
	"door_numbers": "the door scratched with numbers",
	"door_ajar": "the door standing slightly ajar",
}

var _backrooms_return_chapter: String = ""
var _backrooms_return_position: Vector3 = Vector3.ZERO
var _backrooms_return_yaw: float = 0.0

func _ready() -> void:
	if not GameState.has_active_run:
		# Defensive fallback: never spawn with no run — bounce to title.
		get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
		return

	add_to_group("game_root")

	player = PLAYER_SCENE.instantiate()
	add_child(player)

	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
	AudioManager.play_main(MAIN_SOUNDTRACK)

func _on_chapter_ready(chapter: Node) -> void:
	var spawn_pos := Vector3(0, 1.0, 6)
	var spawn_yaw := 0.0
	if chapter.has_node(GameState.spawn_id):
		var marker: Node3D = chapter.get_node(GameState.spawn_id)
		spawn_pos = marker.global_position
		spawn_yaw = marker.rotation.y
	elif chapter.has_node("start"):
		var marker: Node3D = chapter.get_node("start")
		spawn_pos = marker.global_position
		spawn_yaw = marker.rotation.y

	# Continue restores the player's exact last-safe spot; New Dream never
	# has one (GameState.new_run clears has_last_position), so it always
	# uses the chapter's named spawn marker above.
	if GameState.has_last_position:
		spawn_pos = GameState.last_position
		spawn_yaw = GameState.last_yaw

	player.set_spawn(spawn_pos, spawn_yaw)

## Called by a NightmareDoor when the player steps through it. Remembers
## the exact chapter + transform so exit_nightmare/collapse can put the
## player back exactly where they left, per the "ordinary doors can
## betray into hidden nightmare environments" / return-to-entry-point
## requirement in MASTER_REBUILD_BRIEF.md's Nightmare Passages section.
func enter_nightmare(nightmare_id: String) -> void:
	if GameState.in_nightmare:
		return
	_nightmare_return_chapter = GameState.chapter
	_nightmare_return_position = player.global_position
	_nightmare_return_yaw = player.rotation.y
	_current_nightmare_id = nightmare_id
	GameState.in_nightmare = true
	SceneLoader.scene_ready.connect(_on_nightmare_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_nightmare(nightmare_id, self)

func _on_nightmare_ready(scene: Node) -> void:
	var spawn_pos := Vector3.ZERO
	var spawn_yaw := 0.0
	if scene.has_node("start"):
		var marker: Node3D = scene.get_node("start")
		spawn_pos = marker.global_position
		spawn_yaw = marker.rotation.y
	player.set_spawn(spawn_pos, spawn_yaw)

	GameState.nightmare_depth = 1
	_ladder_cancelled = false
	_run_minigame_ladder(scene)

## Nightmare_Passage_Minigame_Specs.md's core progression loop: enter at
## depth 1, play a round, win = one level deeper (+ a cash-out choice),
## lose = one level back, lose at depth 1 = back to the chapter. Runs
## until the player cashes out, loses at depth 1, or the passage is
## interrupted from outside (Escape/collapse — see _cancel_ladder).
func _run_minigame_ladder(scene: Node) -> void:
	var pool: Array = MINIGAME_POOLS.get(_current_nightmare_id, [])
	if pool.is_empty():
		return # no minigame built for this room yet — plain exploration still works

	while true:
		await UiRoot.show_nightmare_countdown()
		if _ladder_cancelled:
			return

		var mg_scene: PackedScene = load(pool[randi() % pool.size()])
		_current_minigame = mg_scene.instantiate()
		scene.add_child(_current_minigame)
		_current_minigame.configure(GameState.nightmare_depth)
		var won: bool = await _current_minigame.resolved
		if is_instance_valid(_current_minigame):
			_current_minigame.queue_free()
		_current_minigame = null
		if _ladder_cancelled:
			return

		await UiRoot.show_nightmare_result(won)
		if _ladder_cancelled:
			return

		if won:
			_grant_depth_reward(_current_nightmare_id, GameState.nightmare_depth)
			GameState.nightmare_depth += 1
			var go_deeper: bool = await UiRoot.show_cashout_choice()
			if _ladder_cancelled:
				return
			if not go_deeper:
				exit_nightmare()
				return
		else:
			GameState.nightmare_depth -= 1
			if GameState.nightmare_depth < 1:
				exit_nightmare()
				return

## Placeholder reward presentation — deliberately not touching
## GameState.journals/dream_tracks, since those arrays double as unlock
## conditions elsewhere (e.g. MoonDoor's journal count) and a nightmare
## reward inflating them would unlock things it has no business
## unlocking. Real distinct reward pickups are future work; for now this
## just records the milestone once and tells the player something
## happened.
func _grant_depth_reward(room_id: String, cleared_depth: int) -> void:
	if cleared_depth < 2:
		return
	var reward_id := "%s_depth%d" % [room_id, cleared_depth]
	if GameState.nightmare_rewards.has(reward_id):
		return
	GameState.nightmare_rewards.append(reward_id)
	match cleared_depth:
		2:
			UiRoot.show_journal("A small lore fragment surfaces from the dream — you'll remember this.")
		3:
			UiRoot.show_journal("A journal page, torn loose from somewhere deeper.")
		4:
			UiRoot.show_journal("Something that sounds like a Dream Track hums at the edge of hearing.")
		_:
			UiRoot.show_journal("A rare, deep-dream discovery — you're not sure how you'll explain this one.")

## Escape key inside a Nightmare Passage — a deliberate, safe exit.
func exit_nightmare() -> void:
	_cancel_ladder()
	_return_from_nightmare()

## Composure hit zero inside Decay. Same destination as a normal exit —
## "an appropriate safe chapter location, not a standard death screen" —
## but composure is restored so the player isn't dumped back in with no
## buffer against the next Decay door.
func collapse_from_nightmare() -> void:
	GameState.composure = 1.0
	_cancel_ladder()
	_return_from_nightmare()
	UiRoot.show_journal("The dream refuses to hold. You wake back somewhere familiar.")

## Interrupts _run_minigame_ladder from outside its own loop (a
## deliberate exit or a collapse, as opposed to the loop's own win/lose
## exits above). Forces any in-flight minigame or UI await to resolve
## immediately rather than leaving a coroutine suspended forever waiting
## on a signal that will never come once the passage scene is gone.
func _cancel_ladder() -> void:
	_ladder_cancelled = true
	GameState.nightmare_depth = 0
	UiRoot.force_close_nightmare_ui()
	if _current_minigame and is_instance_valid(_current_minigame):
		var mg := _current_minigame
		_current_minigame = null
		mg.cancel()
		mg.resolved.emit(false)
		mg.queue_free()

## The Lost Passage — triggered by BackroomsTrigger's relocated invisible
## spot, not a door the player chooses to open. Deliberately separate
## from enter_nightmare/GameState.in_nightmare: this is a distinct,
## non-dreamcore system with its own exit rules (see BackroomsPit,
## BackroomsArtifact, BackroomsDoor).
func enter_backrooms() -> void:
	if GameState.in_nightmare or GameState.in_backrooms:
		return
	_backrooms_return_chapter = GameState.chapter
	_backrooms_return_position = player.global_position
	_backrooms_return_yaw = player.rotation.y
	GameState.new_backrooms_trip()
	GameState.backrooms_artifact_target = BACKROOMS_ARTIFACT_NAMES.keys()[randi() % BACKROOMS_ARTIFACT_NAMES.size()]
	GameState.backrooms_door_target = BACKROOMS_DOOR_NAMES.keys()[randi() % BACKROOMS_DOOR_NAMES.size()]
	SceneLoader.scene_ready.connect(_on_backrooms_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_backrooms("level1", self)

func _on_backrooms_ready(scene: Node) -> void:
	var spawn_pos := Vector3.ZERO
	var spawn_yaw := 0.0
	if scene.has_node("start"):
		var marker: Node3D = scene.get_node("start")
		spawn_pos = marker.global_position
		spawn_yaw = marker.rotation.y
	player.set_spawn(spawn_pos, spawn_yaw)

	# The clue screen: what to look for, and the two ways out.
	UiRoot.show_journal(
		"You've slipped somewhere that isn't supposed to exist.\n\nLook for %s to go back exactly where you were, or find %s to get out nearby.\n\nMind the floor. Some of it isn't there." % [
			BACKROOMS_ARTIFACT_NAMES[GameState.backrooms_artifact_target],
			BACKROOMS_DOOR_NAMES[GameState.backrooms_door_target],
		])

## A pit swallowed the player. Punishes exploration progress within the
## Backrooms — never sends them back to the real chapter — per "if you
## fall in the pits you go back to the first level no matter how many
## levels you have advanced."
func backrooms_pit_fall() -> void:
	if not GameState.in_backrooms:
		return
	GameState.backrooms_level = 1
	var scene := SceneLoader.current_chapter
	if scene and scene.has_node("start"):
		var marker: Node3D = scene.get_node("start")
		player.set_spawn(marker.global_position, marker.rotation.y)
	UiRoot.set_prompt("")
	UiRoot.show_journal("The floor gives way. You're back where you started.")

## Found the real artifact — exact return, per "go back to the exact
## point without finding the door, but you have to find a specific item".
func exit_backrooms_via_artifact() -> void:
	if not GameState.in_backrooms:
		return
	GameState.in_backrooms = false
	GameState.chapter = _backrooms_return_chapter
	GameState.has_last_position = true
	GameState.last_position = _backrooms_return_position
	GameState.last_yaw = _backrooms_return_yaw
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
	UiRoot.show_journal("You hold onto it as everything folds back into place.")

## Found the real door — general-area return, per "it will take you back
## to where you last saved but not the exact spot, just the general area
## you were in."
func exit_backrooms_via_door() -> void:
	if not GameState.in_backrooms:
		return
	GameState.in_backrooms = false
	GameState.chapter = _backrooms_return_chapter
	var nudge := Vector3(randf_range(-2.5, 2.5), 0.0, randf_range(-2.5, 2.5))
	GameState.has_last_position = true
	GameState.last_position = _backrooms_return_position + nudge
	GameState.last_yaw = _backrooms_return_yaw
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
	UiRoot.show_journal("The door opens onto somewhere familiar. Close enough.")

func _return_from_nightmare() -> void:
	if not GameState.in_nightmare:
		return
	GameState.in_nightmare = false
	GameState.chapter = _nightmare_return_chapter
	GameState.has_last_position = true
	GameState.last_position = _nightmare_return_position
	GameState.last_yaw = _nightmare_return_yaw
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
