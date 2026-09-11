extends Node3D
## Instances the player once, then hands chapter loading to SceneLoader.
## The chapter scene provides a "start" Marker3D the player spawns at
## (or the save's stored transform, once validated).

const PLAYER_SCENE := preload("res://scenes/player/Player.tscn")
const MAIN_SOUNDTRACK := preload("res://assets/audio/main_soundtrack/main_soundtrack.ogg")

var player: CharacterBody3D

func _ready() -> void:
	if not GameState.has_active_run:
		# Defensive fallback: never spawn with no run — bounce to title.
		get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/Title.tscn")
		return

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
