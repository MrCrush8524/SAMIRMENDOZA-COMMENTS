class_name NightmareMinigame
extends Node3D
## Contract every Nightmare Passage minigame follows, per
## Nightmare_Passage_Minigame_Specs.md: GameRoot instances one of these
## as a child of the currently-loaded passage scene, calls configure()
## with the player's current nightmare_depth so the minigame can scale
## its own difficulty, then awaits `resolved` for the outcome.

signal resolved(won: bool)

## Called once, right after instancing, before the player can act.
## Override to scale timers/counts/deception with depth.
func configure(_depth: int) -> void:
	pass

## Called by GameRoot if the passage exits mid-round (Escape, or a
## composure collapse) so a minigame can stop timers/tweens cleanly.
## Not required to emit `resolved` — GameRoot handles cleanup either way.
func cancel() -> void:
	pass
