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
	"decay": [
		"res://scenes/nightmare/minigames/DecayDontTouchWater.tscn",
		"res://scenes/nightmare/minigames/DecayRisingWater.tscn",
		"res://scenes/nightmare/minigames/DecayWrongDoor.tscn",
		"res://scenes/nightmare/minigames/DecayFreeze.tscn",
	],
	"wander": [
		"res://scenes/nightmare/minigames/WanderWhatChanged.tscn",
		"res://scenes/nightmare/minigames/WanderFollowLight.tscn",
		"res://scenes/nightmare/minigames/WanderCountAndAnswer.tscn",
		"res://scenes/nightmare/minigames/WanderHideAndSeek.tscn",
	],
	"arcade": [
		"res://scenes/nightmare/minigames/ArcadeSimonReversed.tscn",
		"res://scenes/nightmare/minigames/ArcadeClawTiming.tscn",
		"res://scenes/nightmare/minigames/ArcadeWhackAMole.tscn",
	],
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

## Where to put the player back when a side level (Mall, Zoo, Terminal,
## Museum, Liminal Junction, the Pink Hallway) is left — set by
## enter_side_level, consumed by exit_side_level. Always chapter01 today
## (every side-level door lives in its Impossible Door Gallery), but
## stored generically in case a side level is ever entered from
## somewhere else.
var _sidelevel_return_chapter: String = ""
var _sidelevel_return_position: Vector3 = Vector3.ZERO
var _sidelevel_return_yaw: float = 0.0

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

## Generic transition into any built chapter/level (the Mall, Clouds Zoo,
## the Terminal, the Nightmare Museum, etc. as they come online) — sets
## the real GameState.chapter (unlike Nightmare/Backrooms, this IS where
## the player now "is" and gets saved), spawns at the named marker
## (default "start"), and drops any stale exact-position override so the
## new chapter's own spawn point is actually used.
## random_spawn_candidates, when non-empty, overrides spawn_marker with a
## random pick from the list every time — for a level like the Liminal
## Junction that always starts the player on one of several platforms/
## tracks rather than one fixed spot.
func enter_chapter(chapter_id: String, spawn_marker: String = "start", random_spawn_candidates: Array[String] = []) -> void:
	GameState.chapter = chapter_id
	if not random_spawn_candidates.is_empty():
		GameState.spawn_id = random_spawn_candidates[randi() % random_spawn_candidates.size()]
	else:
		GameState.spawn_id = spawn_marker
	GameState.has_last_position = false
	# Chapter Select only cares about real story chapters ("chapter01" ..
	# "chapter06") — side levels (mall/zoo/terminal/...) use plain ids and
	# never belong in this list, see GameState.visited_chapters.
	if chapter_id.begins_with("chapter") and not GameState.visited_chapters.has(chapter_id):
		GameState.visited_chapters.append(chapter_id)
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(chapter_id, self)

## Reloads the CURRENT chapter at a random marker from the given list —
## e.g. the Dreamcore Mall's "spawn somewhere random after failing a
## minigame" rule. A no-op if candidates is empty (no minigame built yet
## to call this from).
func respawn_in_chapter_random(candidates: Array[String]) -> void:
	if candidates.is_empty():
		return
	GameState.spawn_id = candidates[randi() % candidates.size()]
	GameState.has_last_position = false
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)

## Called by a LevelDoor when the player steps through it into one of the
## optional side levels (Mall/Zoo/Terminal/Museum/Liminal Junction/Pink
## Hallway) from the Impossible Door Gallery. Remembers exactly where the
## player was standing so exit_side_level can put them back at that same
## door, per the "return to the same door" round-trip requirement.
func enter_side_level(chapter_id: String, spawn_marker: String = "start", random_spawn_candidates: Array[String] = []) -> void:
	_sidelevel_return_chapter = GameState.chapter
	_sidelevel_return_position = player.global_position
	_sidelevel_return_yaw = player.rotation.y
	enter_chapter(chapter_id, spawn_marker, random_spawn_candidates)

## Called by a SideLevelReturnDoor. Puts the player back exactly where
## they stepped in from, not just at the destination chapter's "start".
## _sidelevel_return_chapter is only ever set in-memory by
## enter_side_level, so a fresh GameRoot that loaded straight into a side
## level (e.g. resuming a save made while already inside one) never has
## it - falling through silently there left the return door permanently
## dead, with no way out of that side level at all. Every side level is
## reached from Chapter I's Impossible Door Gallery today, so that's the
## one sane fallback destination rather than doing nothing.
func exit_side_level() -> void:
	var return_chapter := _sidelevel_return_chapter if not _sidelevel_return_chapter.is_empty() else "chapter01"
	GameState.chapter = return_chapter
	if _sidelevel_return_chapter.is_empty():
		GameState.spawn_id = "start"
		GameState.has_last_position = false
	else:
		GameState.has_last_position = true
		GameState.last_position = _sidelevel_return_position
		GameState.last_yaw = _sidelevel_return_yaw
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(return_chapter, self)
	# Only save once the player has actually been moved to the return spot
	# by _on_chapter_ready above (load_chapter emits scene_ready
	# synchronously) — save_game() reads the player's live position, so
	# saving before the move would silently overwrite our return
	# transform with wherever they were still standing in the side level.
	SaveManager.save_game()

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

## Doubt Catch pool (Chapter II+, per design note). Empty until real
## catch-specific minigames exist — DoubtCatcher.gd is safe to attach
## anywhere in the meantime; touching it just does nothing while the
## pool is empty, rather than erroring.
const DOUBT_CATCH_POOL: Array[String] = ["res://scenes/nightmare/minigames/WanderWhatChanged.tscn"]

var _doubt_catch_minigame: NightmareMinigame = null

## Called by DoubtCatcher when Doubt touches the player. If the player
## is holding any Dream Tokens, they get one immediate offer to spend
## one for automatic immunity THIS encounter — decline (or have none)
## and it proceeds to the minigame as normal. The offer never carries
## over: it's spent right away or the chance is gone, never bankable
## for a specific later Doubt. Same countdown/result UI as the
## Nightmare ladder (UiRoot), but this is an open-world catch, not a
## Nightmare Passage — win grants a Dream Token, lose just respawns the
## player nearby (their exact spot, gently nudged), never sends them to
## a Nightmare Passage or back to the chapter's main spawn.
func start_doubt_catch() -> void:
	if GameState.dream_tokens > 0:
		var use_token: bool = await UiRoot.show_yes_no_choice(
			"Doubt has you. Spend a Dream Token for immunity?", "Spend Token", "Risk It")
		if use_token:
			GameState.dream_tokens -= 1
			UiRoot.show_journal("The token flares once and Doubt passes through you like smoke.")
			return

	if DOUBT_CATCH_POOL.is_empty():
		return
	var return_position := player.global_position
	var return_yaw := player.rotation.y

	await UiRoot.show_nightmare_countdown()
	var mg_scene: PackedScene = load(DOUBT_CATCH_POOL[randi() % DOUBT_CATCH_POOL.size()])
	_doubt_catch_minigame = mg_scene.instantiate()
	SceneLoader.current_chapter.add_child(_doubt_catch_minigame)
	_doubt_catch_minigame.configure(1)
	var won: bool = await _doubt_catch_minigame.resolved
	if is_instance_valid(_doubt_catch_minigame):
		_doubt_catch_minigame.queue_free()
	_doubt_catch_minigame = null

	await UiRoot.show_nightmare_result(won)
	if won:
		GameState.dream_tokens += 1
		UiRoot.show_journal("You held your ground. A Dream Token — for later.")
	else:
		var nudge := Vector3(randf_range(-2.0, 2.0), 0.0, randf_range(-2.0, 2.0))
		player.set_spawn(return_position + nudge, return_yaw)

## Reuses the Nightmare ladder's own arcade minigames as a stakes-based
## catch for falling off the edge of a chapter's built geometry (e.g.
## Downtown's street, Above the Street's rooftops) - open-world level
## edges have no floor beyond them, so without this a slipped jump was
## an unrecoverable infinite fall with no way back to the game. Win the
## arcade round and land back exactly where the fall started; lose and
## the chapter reloads from its own "start" marker, same as a fresh
## entry - a real setback, not a death screen.
const VOID_FALL_MINIGAME_POOL: Array[String] = [
	"res://scenes/nightmare/minigames/ArcadeSimonReversed.tscn",
	"res://scenes/nightmare/minigames/ArcadeClawTiming.tscn",
	"res://scenes/nightmare/minigames/ArcadeWhackAMole.tscn",
]

var _void_fall_in_progress: bool = false

## last_grounded_position/yaw: wherever the player was last actually
## standing on solid ground, tracked continuously by Player.gd - not
## their current (falling, off-the-map) position, which is useless as
## a return point.
func void_fall(last_grounded_position: Vector3, last_grounded_yaw: float) -> void:
	if _void_fall_in_progress or GameState.in_nightmare or GameState.in_backrooms:
		return
	_void_fall_in_progress = true
	# Teleport back up immediately - stops the endless fall and gets the
	# player looking at the room they just left while the arcade round
	# plays, rather than staring into the void the whole time.
	player.set_spawn(last_grounded_position, last_grounded_yaw)

	await UiRoot.show_nightmare_countdown()
	var mg_scene: PackedScene = load(VOID_FALL_MINIGAME_POOL[randi() % VOID_FALL_MINIGAME_POOL.size()])
	var minigame: NightmareMinigame = mg_scene.instantiate()
	SceneLoader.current_chapter.add_child(minigame)
	minigame.configure(1)
	var won: bool = await minigame.resolved
	if is_instance_valid(minigame):
		minigame.queue_free()

	await UiRoot.show_nightmare_result(won)
	if won:
		player.set_spawn(last_grounded_position, last_grounded_yaw)
	else:
		GameState.spawn_id = "start"
		GameState.has_last_position = false
		SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
		SceneLoader.load_chapter(GameState.chapter, self)
	_void_fall_in_progress = false

## Master Build Brief 4.1: the reusable No-Clip Prison Pool. A random
## roll (see Player.gd's _maybe_trigger_noclip) drops the player into
## one of these instead of a hand-authored level - each wraps one of the
## backrooms_vr GLBs plus a randomized escape object and Evil Larry
## (NoClipPrisonEnvironment.gd). Distinct from the older Lost Passage
## (_backrooms_* above) which has its own artifact/door mechanic and no
## hostile chaser.
const NOCLIP_PRISON_POOL: Array[String] = ["prison_a", "prison_b", "prison_c", "prison_d"]

var _noclip_return_chapter: String = ""
var _noclip_return_position: Vector3 = Vector3.ZERO
var _noclip_return_yaw: float = 0.0

func enter_noclip_prison() -> void:
	if GameState.in_nightmare or GameState.in_backrooms or GameState.in_noclip_prison:
		return
	GameState.in_noclip_prison = true
	_noclip_return_chapter = GameState.chapter
	_noclip_return_position = player.global_position
	_noclip_return_yaw = player.rotation.y
	var prison_id: String = NOCLIP_PRISON_POOL[randi() % NOCLIP_PRISON_POOL.size()]
	SceneLoader.scene_ready.connect(_on_noclip_prison_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_noclip_prison(prison_id, self)

func _on_noclip_prison_ready(scene: Node) -> void:
	scene.environment_ready.connect(func(spawn_pos: Vector3, spawn_yaw: float):
		player.set_spawn(spawn_pos, spawn_yaw)
		UiRoot.show_journal("The floor gave out. Something else is in here with you - find the way out before it finds you.")
	)
	scene.escaped.connect(_on_noclip_escaped)
	scene.caught.connect(_on_noclip_caught)

## Found the escape object - back to exactly where the prison caught the
## player, same shape as the void-fall win path.
func _on_noclip_escaped() -> void:
	if not GameState.in_noclip_prison:
		return
	GameState.in_noclip_prison = false
	GameState.chapter = _noclip_return_chapter
	GameState.has_last_position = true
	GameState.last_position = _noclip_return_position
	GameState.last_yaw = _noclip_return_yaw
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
	UiRoot.show_journal("You slip back through, right where you left off.")

## Evil Larry caught the player: send them back one full numbered
## chapter (brief 4.2 - "caught during Chapter 7 no-clip -> Chapter 6").
## Chapter 1 never rolls a no-clip event, so there is no chapter below
## chapter01 to clamp against here.
func _on_noclip_caught() -> void:
	if not GameState.in_noclip_prison:
		return
	GameState.in_noclip_prison = false
	var current_num: int = _noclip_return_chapter.trim_prefix("chapter").to_int()
	var prev_num: int = maxi(1, current_num - 1)
	GameState.chapter = "chapter%02d" % prev_num
	GameState.spawn_id = "start"
	GameState.has_last_position = false
	SceneLoader.scene_ready.connect(_on_chapter_ready, CONNECT_ONE_SHOT)
	SceneLoader.load_chapter(GameState.chapter, self)
	UiRoot.show_journal("It caught you. Everything folds back a step further than you'd like.")

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
## levels you have advanced." Always does a real level1 (re)load rather
## than assuming the current scene has its own "start" node — that
## assumption only happened to hold while level1 was the only level
## that existed; falling from level2 needs an actual scene change.
func backrooms_pit_fall() -> void:
	if not GameState.in_backrooms:
		return
	GameState.backrooms_level = 1
	UiRoot.set_prompt("")
	UiRoot.show_journal("The floor gives way. You're back where you started.")
	SceneLoader.scene_ready.connect(_reposition_at_start, CONNECT_ONE_SHOT)
	SceneLoader.load_backrooms("level1", self)

## The Lost Passage's one modeled deeper level so far. Stepping onto
## BackroomsStairsDown in level1 calls this; more levelN scenes can be
## added later without touching this method beyond the id string.
func backrooms_go_deeper() -> void:
	if not GameState.in_backrooms:
		return
	GameState.backrooms_level = 2
	SceneLoader.scene_ready.connect(_reposition_at_start, CONNECT_ONE_SHOT)
	SceneLoader.load_backrooms("level2", self)

## BackroomsStairsUp in level2 calls this — the way back to level1
## without needing to find an artifact/door (those exit the Backrooms
## entirely; this just climbs back up a level).
func backrooms_go_up() -> void:
	if not GameState.in_backrooms:
		return
	GameState.backrooms_level = 1
	SceneLoader.scene_ready.connect(_reposition_at_start, CONNECT_ONE_SHOT)
	SceneLoader.load_backrooms("level1", self)

func _reposition_at_start(scene: Node) -> void:
	if scene.has_node("start"):
		var marker: Node3D = scene.get_node("start")
		player.set_spawn(marker.global_position, marker.rotation.y)

## Found the real artifact — exact return, per "go back to the exact
## point without finding the door, but you have to find a specific item".
## The tiny nudge (much smaller than the door's) keeps "exact" honest to
## the eye while guaranteeing the player doesn't land back inside
## BackroomsTrigger's own hitbox — that's precisely where they were
## standing when it first fired, so a truly exact return would walk
## them straight back into the Lost Passage the instant they arrived.
func exit_backrooms_via_artifact() -> void:
	if not GameState.in_backrooms:
		return
	GameState.in_backrooms = false
	GameState.chapter = _backrooms_return_chapter
	# A random per-axis nudge could roll near (0,0) in the worst case and
	# still land inside the trigger's box — pick a direction and a fixed
	# minimum distance instead, guaranteed to clear it (half-extent
	# 0.5m, corner-to-corner ~0.71m) with margin.
	var angle := randf_range(0.0, TAU)
	var nudge := Vector3(cos(angle), 0.0, sin(angle)) * 0.9
	GameState.has_last_position = true
	GameState.last_position = _backrooms_return_position + nudge
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
