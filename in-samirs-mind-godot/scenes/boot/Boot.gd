extends Node
## BOOT -> STUDIO SPLASH -> TITLE. Kept intentionally tiny: nothing
## chapter-related loads here.

func _ready() -> void:
	QualityManager.detect_and_apply()
	get_tree().call_deferred("change_scene_to_file", "res://scenes/boot/StudioSplash.tscn")
