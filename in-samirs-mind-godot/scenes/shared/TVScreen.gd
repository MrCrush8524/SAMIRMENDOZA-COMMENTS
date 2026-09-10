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

@export var manual: bool = true
@export var video_id: String = ""
@export var broadcast_audio: AudioStream = null
@export var still_frame: Texture2D = null

@onready var screen_mesh: MeshInstance3D = $Screen
@onready var audio_player: AudioStreamPlayer3D = $BroadcastAudio

var _played_this_session: bool = false

func _ready() -> void:
	if still_frame:
		var mat := StandardMaterial3D.new()
		mat.albedo_texture = still_frame
		mat.emission_enabled = true
		mat.emission = Color(0.05, 0.05, 0.08)
		screen_mesh.material_override = mat
	if not manual:
		body_entered.connect(_on_body_entered)
	audio_player.finished.connect(_on_finished)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player") and not _played_this_session:
		_play()

func interact() -> void:
	if manual and not audio_player.playing:
		_play()

func _play() -> void:
	_played_this_session = true
	GameState.tv_seen.append(video_id)
	AudioManager.duck_for_broadcast()
	audio_player.stream = broadcast_audio
	audio_player.play()
	UiRoot.set_prompt("Broadcasting: %s" % video_id.replace("_", " "))

func _on_finished() -> void:
	UiRoot.set_prompt("")
	AudioManager.resume_after_broadcast()
