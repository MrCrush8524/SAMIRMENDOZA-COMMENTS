extends Area3D
## Touch-detector for a wandering hazard inside a minigame room — reports
## straight back to the parent minigame's _finish(false) rather than
## GameRoot.start_doubt_catch() (DoubtCatcher.gd's job out in the open
## world). Kept separate since a minigame losing to a wanderer must not
## recurse into another Doubt Catch round.

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		get_parent().get_parent()._finish(false)
