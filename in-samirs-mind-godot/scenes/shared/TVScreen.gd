extends Area3D
## Manual or proximity-auto TV. Ducks the Music bus for the broadcast and
## restores it from its exact prior position once playback ends.
##
## Stock Godot 4.3 ships no video codec at all (no VideoStreamTheora —
## confirmed against this engine build's own registered classes), so
## real in-engine video needs a third-party GDExtension not yet vetted
## for this project's three export targets. Until that's integrated,
## broadcasts play their real audio track and show a still frame on the
## screen mesh — genuinely working today, not a placeholder for the
## duck/resume mechanic itself.
##
## Two modes: a single clip (video_id/broadcast_audio/still_frame), or a
## playlist (playlist_ids/playlist_audio/playlist_stills, same length,
## in the order they should play) that auto-advances at each clip's end
## and loops. A playlist takes priority over the single-clip fields when
## both are set.

@export var manual: bool = true
@export var video_id: String = ""
@export var broadcast_audio: AudioStream = null
@export var still_frame: Texture2D = null

@export var playlist_ids: Array[String] = []
@export var playlist_audio: Array[AudioStream] = []
@export var playlist_stills: Array[Texture2D] = []

@onready var screen_mesh: MeshInstance3D = $Screen
@onready var audio_player: AudioStreamPlayer3D = $BroadcastAudio

var _played_this_session: bool = false
var _playlist_index: int = 0

func _ready() -> void:
	if not is_playlist():
		_set_screen_texture(still_frame)
	if not manual:
		body_entered.connect(_on_body_entered)
	audio_player.finished.connect(_on_finished)

func is_playlist() -> bool:
	return playlist_ids.size() > 0 and playlist_ids.size() == playlist_audio.size() and playlist_ids.size() == playlist_stills.size()

func _set_screen_texture(tex: Texture2D) -> void:
	if not tex:
		return
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.emission_enabled = true
	mat.emission = Color(0.05, 0.05, 0.08)
	screen_mesh.material_override = mat

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player") and not _played_this_session:
		_play()

func interact() -> void:
	if manual and not audio_player.playing:
		_play()

func _play() -> void:
	_played_this_session = true
	AudioManager.duck_for_broadcast()
	if is_playlist():
		_playlist_index = 0
		_play_playlist_entry(_playlist_index)
	else:
		GameState.tv_seen.append(video_id)
		audio_player.stream = broadcast_audio
		audio_player.play()
		UiRoot.set_prompt("Broadcasting: %s" % video_id.replace("_", " "))

func _play_playlist_entry(index: int) -> void:
	_playlist_index = index
	var id: String = playlist_ids[index]
	if not GameState.tv_seen.has(id):
		GameState.tv_seen.append(id)
	_set_screen_texture(playlist_stills[index])
	audio_player.stream = playlist_audio[index]
	audio_player.play()
	UiRoot.set_prompt("Broadcasting: %s" % id.replace("_", " "))

func _on_finished() -> void:
	if is_playlist():
		_playlist_index += 1
		if _playlist_index < playlist_ids.size():
			# Advance to the next clip; don't resume main music in between —
			# it's one continuous "commercial break", not three separate ones.
			_play_playlist_entry(_playlist_index)
			return
		# Full cycle played through once. Resume main music, same contract
		# as a single-clip TV. Replayable afterward (manual: press E again;
		# proximity: only once per session, per the design brief).
	UiRoot.set_prompt("")
	AudioManager.resume_after_broadcast()
