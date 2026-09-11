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

## Escape key inside a Nightmare Passage — a deliberate, safe exit.
func exit_nightmare() -> void:
	_return_from_nightmare()

## Composure hit zero inside Decay. Same destination as a normal exit —
## "an appropriate safe chapter location, not a standard death screen" —
## but composure is restored so the player isn't dumped back in with no
## buffer against the next Decay door.
func collapse_from_nightmare() -> void:
	GameState.composure = 1.0
	_return_from_nightmare()
	UiRoot.show_journal("The dream refuses to hold. You wake back somewhere familiar.")

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
