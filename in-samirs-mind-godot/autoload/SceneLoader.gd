extends Node
## True one-chapter-at-a-time loading. The old chapter is freed before
## the new one is instanced — never both alive at once.

signal scene_ready(scene: Node)

const CHAPTER_SCENES := {
	"chapter01": "res://scenes/chapter01/Chapter01.tscn",
}

var current_chapter: Node = null

func load_chapter(chapter_id: String, root: Node) -> void:
	if current_chapter and is_instance_valid(current_chapter):
		current_chapter.queue_free()
		current_chapter = null

	var path: String = CHAPTER_SCENES.get(chapter_id, "")
	if path.is_empty():
		push_error("SceneLoader: unknown chapter id '%s'" % chapter_id)
		return

	var packed: PackedScene = load(path)
	current_chapter = packed.instantiate()
	root.add_child(current_chapter)
	scene_ready.emit(current_chapter)
