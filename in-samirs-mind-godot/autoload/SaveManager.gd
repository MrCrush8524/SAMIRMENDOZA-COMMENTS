extends Node
## Named, multi-slot local saves under user://saves/*.json. Every
## gameplay checkpoint (picking up an item, passing a door, a room
## check...) still calls save_game() with no arguments exactly as
## before - that's a silent progress checkpoint, always written under
## AUTOSAVE_NAME, so nothing is lost to a crash or alt-F4 even if the
## player never deliberately saves.
##
## A deliberate save - the pause menu's Save button, and the save
## offered before leaving to the Main Menu or exiting - goes through
## save_game_as(name) instead, one file per name. Continue on the
## Title screen lists every file here (autosave included, so a player
## who only ever alt-F4'd still has something to resume) and lets the
## player pick which dream to pick back up.
##
## Never restores a save it can't validate - an invalid/corrupt file is
## treated as absent, not a crash.

const SAVES_DIR := "user://saves/"
const AUTOSAVE_NAME := "Autosave"

func _ensure_dir() -> void:
	DirAccess.make_dir_recursive_absolute(SAVES_DIR)

## One entry per valid save file: file, save_name, dreamer, chapter,
## saved_at (unix seconds) - newest first.
func list_saves() -> Array[Dictionary]:
	_ensure_dir()
	var result: Array[Dictionary] = []
	var dir := DirAccess.open(SAVES_DIR)
	if dir == null:
		return result
	dir.list_dir_begin()
	var fname := dir.get_next()
	while fname != "":
		if fname.ends_with(".json"):
			var data = _read_file(SAVES_DIR + fname)
			if data != null and int(data.get("version", -1)) == GameState.SAVE_VERSION and data.has("dreamer"):
				result.append({
					"file": fname,
					"save_name": String(data.get("save_name", fname.get_basename())),
					"dreamer": String(data.get("dreamer", "")),
					"chapter": String(data.get("chapter", "")),
					"saved_at": float(data.get("saved_at", 0.0)),
				})
		fname = dir.get_next()
	dir.list_dir_end()
	result.sort_custom(func(a, b): return a["saved_at"] > b["saved_at"])
	return result

func has_any_save() -> bool:
	return not list_saves().is_empty()

## Silent progress checkpoint - unchanged call signature so every
## existing gameplay call site (Pickup, doors, room checks...) keeps
## working exactly as before.
func save_game() -> void:
	save_game_as(AUTOSAVE_NAME)

## A named save slot - overwrites any existing save under the same name.
func save_game_as(save_name: String) -> void:
	_ensure_dir()
	if GameState.current_player and is_instance_valid(GameState.current_player):
		GameState.last_position = GameState.current_player.global_position
		GameState.last_yaw = GameState.current_player.rotation.y
		GameState.has_last_position = true

	var data := GameState.to_dict()
	data["save_name"] = save_name
	data["saved_at"] = Time.get_unix_time_from_system()

	var f := FileAccess.open(SAVES_DIR + _filename_for(save_name), FileAccess.WRITE)
	if f == null:
		push_error("SaveManager: could not open save file for writing")
		return
	f.store_string(JSON.stringify(data))
	f.close()
	if UiRoot:
		UiRoot.flash_save_toast()

## Loads the most recently saved file (whatever it's named) - used by
## the Chapters screen, which just wants "whatever save exists" to
## build its Resume entry from.
func load_game() -> bool:
	var saves := list_saves()
	if saves.is_empty():
		return false
	return load_game_file(saves[0]["file"])

func load_game_file(fname: String) -> bool:
	var data = _read_file(SAVES_DIR + fname)
	if data == null:
		return false
	return GameState.from_dict(data)

func delete_save(fname: String) -> void:
	var path := SAVES_DIR + fname
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)

func _filename_for(save_name: String) -> String:
	var safe := save_name.strip_edges()
	var regex := RegEx.new()
	regex.compile("[^A-Za-z0-9 _-]+")
	safe = regex.sub(safe, "", true).strip_edges()
	if safe.is_empty():
		safe = "Dream"
	return safe.replace(" ", "_") + ".json"

func _read_file(path: String):
	if not FileAccess.file_exists(path):
		return null
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return null
	var text := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return null
	return parsed
