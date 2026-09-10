extends Node
## Holds the current run's in-memory state. SaveManager reads/writes this
## to disk; gameplay scenes mutate it directly rather than each other.

const SAVE_VERSION := 1

var dreamer: String = ""          # "Bobby" | "Luna" | "Mateo"
var chapter: String = "chapter01"
var spawn_id: String = "start"
var journals: Array[int] = []
var memory_cats: Array[String] = []
var inventory: Array[String] = []
var dream_tracks: Array[String] = []
var tv_seen: Array[String] = []
var has_active_run: bool = false

func new_run(chosen_dreamer: String) -> void:
	dreamer = chosen_dreamer
	chapter = "chapter01"
	spawn_id = "start"
	journals.clear()
	memory_cats.clear()
	inventory.clear()
	dream_tracks.clear()
	tv_seen.clear()
	has_active_run = true

func to_dict() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"dreamer": dreamer,
		"chapter": chapter,
		"spawn_id": spawn_id,
		"journals": journals,
		"memory_cats": memory_cats,
		"inventory": inventory,
		"dream_tracks": dream_tracks,
		"tv_seen": tv_seen,
	}

func from_dict(data: Dictionary) -> bool:
	if int(data.get("version", -1)) != SAVE_VERSION:
		return false
	if not data.has("dreamer") or String(data["dreamer"]).is_empty():
		return false
	dreamer = data["dreamer"]
	chapter = data.get("chapter", "chapter01")
	spawn_id = data.get("spawn_id", "start")
	journals.assign(data.get("journals", []))
	memory_cats.assign(data.get("memory_cats", []))
	inventory.assign(data.get("inventory", []))
	dream_tracks.assign(data.get("dream_tracks", []))
	tv_seen.assign(data.get("tv_seen", []))
	has_active_run = true
	return true
