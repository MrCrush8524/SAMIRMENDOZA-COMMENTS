extends Node
## BOOT -> TITLE. Kept intentionally tiny: nothing chapter-related loads here.

func _ready() -> void:
	QualityManager.detect_and_apply()
	get_tree().change_scene_to_file("res://scenes/menu/Title.tscn")
