extends Area3D
## Chapter IV rooftop checkpoint. Chapter IV is three stacked open-air
## tiers with low parapets and long drops between them — falling off is
## an anticipated hazard here, unlike the walled interiors of earlier
## chapters. Walking through one of these raises the chapter's fall-
## recovery point; Chapter04.gd's own _process teleports the player back
## to the most recent one if they fall below the chapter's floor.

func _ready() -> void:
	body_entered.connect(_on_entered)

func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	var chapter_root: Node = get_tree().get_first_node_in_group("chapter4_root")
	if chapter_root:
		chapter_root.set_checkpoint(global_position)
