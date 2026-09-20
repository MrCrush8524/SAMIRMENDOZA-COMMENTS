extends Node
## True one-chapter-at-a-time loading. The old chapter is freed before
## the new one is instanced — never both alive at once.

signal scene_ready(scene: Node)

## Master Build Brief section 5/21: the full 10-chapter spine replaces
## the old 6-chapter + side-level structure entirely (per Samir's
## explicit "replace entirely" call) - these are different worlds under
## the same chapter ids, not an extension of the old content. The old
## side-level entries (mall/zoo/terminal/museum/liminal_junction/
## downtown) are deliberately dropped from this dict since the brief
## doesn't reference them at all; their scene files are left on disk
## rather than deleted; ChapterSelectOverlay.gd stops offering them
## instead (Task 18).
const CHAPTER_SCENES := {
	"chapter01": "res://scenes/chapter01/Chapter01.tscn", # Memory Laundromat + Small City
	"chapter02": "res://scenes/chapter02/Chapter02.tscn", # Level 94
	"chapter03": "res://scenes/chapter03/Chapter03.tscn", # Giant Poolrooms + Level 37 + Japroom
	"chapter04": "res://scenes/chapter04/Chapter04.tscn", # Double Airport
	"chapter05": "res://scenes/chapter05/Chapter05.tscn", # Cyber Mega City
	"chapter06": "res://scenes/chapter06/Chapter06.tscn", # Circus: Level Fun + Kitty's House
	"chapter07": "res://scenes/chapter07/Chapter07.tscn", # Sprawling Mega City
	"chapter08": "res://scenes/chapter08/Chapter08.tscn", # Level 0
	"chapter09": "res://scenes/chapter09/Chapter09.tscn", # Fuchsia Backrooms
	"chapter10": "res://scenes/chapter10/Chapter10.tscn", # Baby Blue Backrooms
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
	"level2": "res://scenes/backrooms/BackroomsLevel2.tscn",
}

## Master Build Brief 4.1: the reusable No-Clip Prison Pool - Evil Larry's
## hunting grounds, entered by a random no-clip event from Chapter 2
## onward. Distinct from BACKROOMS_SCENES above (the older, unrelated
## Lost Passage system with its own artifact/door find-exit mechanic) -
## the brief calls for a separate system built on the newly-supplied
## backrooms_vr GLB pool specifically.
const NOCLIP_PRISON_SCENES := {
	"prison_a": "res://scenes/backrooms/NoClipPrisonA.tscn",
	"prison_b": "res://scenes/backrooms/NoClipPrisonB.tscn",
	"prison_c": "res://scenes/backrooms/NoClipPrisonC.tscn",
	"prison_d": "res://scenes/backrooms/NoClipPrisonD.tscn",
}

var current_chapter: Node = null

func load_chapter(chapter_id: String, root: Node) -> void:
	_load(CHAPTER_SCENES, chapter_id, root, "chapter")

func load_nightmare(nightmare_id: String, root: Node) -> void:
	_load(NIGHTMARE_SCENES, nightmare_id, root, "nightmare")

func load_backrooms(level_id: String, root: Node) -> void:
	_load(BACKROOMS_SCENES, level_id, root, "backrooms")

func load_noclip_prison(prison_id: String, root: Node) -> void:
	_load(NOCLIP_PRISON_SCENES, prison_id, root, "noclip_prison")

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
