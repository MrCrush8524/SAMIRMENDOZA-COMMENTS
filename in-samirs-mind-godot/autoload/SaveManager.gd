extends Node
## Versioned local save. One slot for the vertical slice.
## Never restores a save it can't validate — an invalid/corrupt save is
## treated as no save at all, so Continue simply stays unavailable.

const SAVE_PATH := "user://savegame_v1.json"

func has_valid_save() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		return false
	var data = _read_raw()
	if data == null:
		return false
	return int(data.get("version", -1)) == GameState.SAVE_VERSION and data.has("dreamer")

func save_game() -> void:
	if GameState.current_player and is_instance_valid(GameState.current_player):
		GameState.last_position = GameState.current_player.global_position
		GameState.last_yaw = GameState.current_player.rotation.y
		GameState.has_last_position = true

	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		push_error("SaveManager: could not open save file for writing")
		return
	f.store_string(JSON.stringify(GameState.to_dict()))
	f.close()
	if UiRoot:
		UiRoot.flash_save_toast()

func load_game() -> bool:
	var data = _read_raw()
	if data == null:
		return false
	return GameState.from_dict(data)

func clear_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)

func _read_raw():
	if not FileAccess.file_exists(SAVE_PATH):
		return null
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return null
	var text := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return null
	return parsed
