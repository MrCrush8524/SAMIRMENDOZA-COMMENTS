extends Node
## Small persisted user preferences, separate from the run save (these
## survive New Dream/Continue and apply from the very first frame).

const SETTINGS_PATH := "user://settings_v1.json"

var master_volume_db: float = 0.0
var reduced_motion: bool = false

func _ready() -> void:
	load_settings()
	apply_volume()

func apply_volume() -> void:
	var idx := AudioServer.get_bus_index("Master")
	if idx == -1:
		return
	AudioServer.set_bus_volume_db(idx, master_volume_db)
	# Dragging the slider all the way down should guarantee real silence,
	# not just a very quiet mix — set_bus_mute is the only way to be
	# certain of that regardless of how quiet "quiet" ends up sounding.
	AudioServer.set_bus_mute(idx, master_volume_db <= -79.0)

## The slider itself works in linear volume (0..1, what a human ear
## actually perceives as "half as loud" at ~0.5), not raw dB - dB is a
## logarithmic scale, so mapping slider POSITION directly to dB (the old
## approach) meant most of the slider's travel landed in already-silent
## territory and any real drag down read as an on/off switch instead of
## a fade. linear_to_db/db_to_linear do the perceptual conversion.
func set_master_volume_linear(v: float) -> void:
	v = clampf(v, 0.0, 1.0)
	master_volume_db = -80.0 if v <= 0.001 else linear_to_db(v)
	apply_volume()
	save_settings()

func get_master_volume_linear() -> float:
	return 0.0 if master_volume_db <= -79.0 else clampf(db_to_linear(master_volume_db), 0.0, 1.0)

func set_reduced_motion(value: bool) -> void:
	reduced_motion = value
	save_settings()

func save_settings() -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify({
		"master_volume_db": master_volume_db,
		"reduced_motion": reduced_motion,
	}))
	f.close()

func load_settings() -> void:
	if not FileAccess.file_exists(SETTINGS_PATH):
		return
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if f == null:
		return
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if typeof(data) != TYPE_DICTIONARY:
		return
	master_volume_db = float(data.get("master_volume_db", 0.0))
	reduced_motion = bool(data.get("reduced_motion", false))
