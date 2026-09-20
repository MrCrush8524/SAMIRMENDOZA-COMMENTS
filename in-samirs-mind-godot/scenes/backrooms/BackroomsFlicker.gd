extends OmniLight3D
## Buzzing, irregular fluorescent flicker — the map's own "Flickering
## lights" note, and the classic Backrooms fixture. Deliberately
## irregular (not a clean sine pulse like the Decay wall tell) so it
## reads as failing hardware, not a designed effect.

@export var base_energy: float = 0.6
@export var flicker_chance: float = 0.06 ## per-frame chance of a dip, tuned by feel

func _process(_delta: float) -> void:
	if randf() < flicker_chance:
		light_energy = base_energy * randf_range(0.15, 0.55)
	else:
		light_energy = base_energy
