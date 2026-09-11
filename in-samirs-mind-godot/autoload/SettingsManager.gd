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
	if idx != -1:
		AudioServer.set_bus_volume_db(idx, master_volume_db)

func set_master_volume_db(db: float) -> void:
	master_volume_db = db
	apply_volume()
	save_settings()

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
