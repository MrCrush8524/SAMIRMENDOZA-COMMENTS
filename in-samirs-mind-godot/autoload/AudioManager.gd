extends Node
## Central audio manager. Everything that competes for the player's
## attention (Dream Tracks, TV broadcasts) ducks the Music bus and
## resumes it from its exact prior position — never restarts it.

const FADE_TIME := 0.65

@onready var menu_player: AudioStreamPlayer = _make_player("Music")
@onready var main_player: AudioStreamPlayer = _make_player("Music")
@onready var one_shot_player: AudioStreamPlayer = _make_player("SFX")
@onready var dream_track_player: AudioStreamPlayer = _make_player("DreamTrack")

var _main_resume_position: float = 0.0
var _main_was_playing: bool = false

## One tween per player, not a single shared one — fading menu_player
## out and main_player in happen back-to-back on every "start game"
## transition, and a shared tween meant the second _fade() call killed
## the first mid-flight, before its on_done (menu_player.stop) ever
## ran. That left the menu track frozen mid-fade instead of stopped,
## playing on top of the new main track forever after.
var _fade_tweens: Dictionary = {}

func _make_player(bus: String) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus if AudioServer.get_bus_index(bus) != -1 else "Master"
	add_child(p)
	return p

func play_menu(stream: AudioStream) -> void:
	main_player.stop()
	menu_player.stream = stream
	menu_player.volume_db = -80
	menu_player.play()
	_fade(menu_player, -80, 0, FADE_TIME)

func stop_menu() -> void:
	_fade(menu_player, menu_player.volume_db, -80, FADE_TIME, menu_player.stop)

func play_main(stream: AudioStream, from_position: float = 0.0) -> void:
	main_player.stream = stream
	main_player.volume_db = -80
	main_player.play(from_position)
	_fade(main_player, -80, 0, FADE_TIME)

func duck_for_broadcast() -> void:
	_main_was_playing = main_player.playing
	_main_resume_position = main_player.get_playback_position()
	_fade(main_player, main_player.volume_db, -80, FADE_TIME, main_player.stop)

func resume_after_broadcast() -> void:
	if not _main_was_playing:
		return
	main_player.play(_main_resume_position)
	_fade(main_player, -80, 0, FADE_TIME)

func play_dream_track_now(stream: AudioStream, on_finished: Callable) -> void:
	_main_was_playing = main_player.playing
	_main_resume_position = main_player.get_playback_position()
	_fade(main_player, main_player.volume_db, -80, FADE_TIME, func():
		main_player.stop()
		dream_track_player.stream = stream
		dream_track_player.volume_db = 0
		dream_track_player.play()
		if not dream_track_player.finished.is_connected(on_finished):
			dream_track_player.finished.connect(func():
				resume_after_broadcast()
				on_finished.call()
			, CONNECT_ONE_SHOT)
	)

func play_one_shot(stream: AudioStream, volume_db: float = -4.0) -> void:
	one_shot_player.stream = stream
	one_shot_player.volume_db = volume_db
	one_shot_player.play()

func _fade(player: AudioStreamPlayer, from_db: float, to_db: float, time: float, on_done: Callable = Callable()) -> void:
	if _fade_tweens.has(player):
		_fade_tweens[player].kill()
	player.volume_db = from_db
	var t := create_tween()
	_fade_tweens[player] = t
	t.tween_property(player, "volume_db", to_db, time)
	if on_done.is_valid():
		t.tween_callback(on_done)
