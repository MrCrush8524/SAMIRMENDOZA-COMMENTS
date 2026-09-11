extends Node
## True one-chapter-at-a-time loading. The old chapter is freed before
## the new one is instanced — never both alive at once.

signal scene_ready(scene: Node)

const CHAPTER_SCENES := {
	"chapter01": "res://scenes/chapter01/Chapter01.tscn",
	"chapter02": "res://scenes/infinite_neighborhood/InfiniteNeighborhood.tscn",
	"chapter03": "res://scenes/chapter03/Chapter03.tscn",
	"mall": "res://scenes/mall/DreamcoreMall.tscn",
	"chapter04": "res://scenes/level4/DreamcoreLevel4.tscn",
	## The original "Pastel Dreamscape" Chapter II build — recycled as
	## Chapter V once The Infinite Neighborhood took over as the real
	## Chapter II. Same file, just re-identified; nothing in it changed.
	"chapter05": "res://scenes/chapter02/Chapter02.tscn",
	"zoo": "res://scenes/zoo/CloudsZoo.tscn",
	"terminal": "res://scenes/terminal/DreamcoreTerminal.tscn",
	"museum": "res://scenes/museum/NightmareMuseum.tscn",
	"liminal_junction": "res://scenes/liminal_junction/LiminalJunction.tscn",
}

## Nightmare Passages are loaded the same way as a chapter (swapped in
## under GameRoot, one at a time) but never touch GameState.chapter —
## GameRoot remembers the real chapter/position and restores it via
## load_chapter on exit, so a nightmare is a detour, not a scene change
## the save file would remember as "where I am".
const NIGHTMARE_SCENES := {
	"decay": "res://scenes/nightmare/NightmareDecay.tscn",
	"wander": "res://scenes/nightmare/NightmareWander.tscn",
	"arcade": "res://scenes/nightmare/NightmareArcade.tscn",
}

## The Lost Passage ("Backrooms") — same swap-in-under-root mechanism as
## a Nightmare Passage, but its own id namespace since it's a distinct
## system (see GameState.gd's in_backrooms block). "level1" is the first
## incrementally-built chunk of the full map; more will be added as
## levelN keys without touching this loading mechanism.
const BACKROOMS_SCENES := {
	"level1": "res://scenes/backrooms/BackroomsLevel1.tscn",
}

var current_chapter: Node = null

func load_chapter(chapter_id: String, root: Node) -> void:
	_load(CHAPTER_SCENES, chapter_id, root, "chapter")

func load_nightmare(nightmare_id: String, root: Node) -> void:
	_load(NIGHTMARE_SCENES, nightmare_id, root, "nightmare")

func load_backrooms(level_id: String, root: Node) -> void:
	_load(BACKROOMS_SCENES, level_id, root, "backrooms")

func _load(scenes: Dictionary, id: String, root: Node, kind: String) -> void:
	if current_chapter and is_instance_valid(current_chapter):
		current_chapter.queue_free()
		current_chapter = null

	var path: String = scenes.get(id, "")
	if path.is_empty():
		push_error("SceneLoader: unknown %s id '%s'" % [kind, id])
		return

	var packed: PackedScene = load(path)
	current_chapter = packed.instantiate()
	root.add_child(current_chapter)
	scene_ready.emit(current_chapter)
