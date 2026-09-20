extends Node
## Master Build Brief 3.3: the 5 Nightmare Arcade mini-games triggered by
## decoy objects. Kept separate from the Nightmare Passage ladder's own
## ArcadeClawTiming/ArcadeSimonReversed/ArcadeWhackAMole pool (still used
## by GameRoot's ladder and void-fall catch) since the brief specifies
## these five by name; both pools share the same NightmareMinigame
## contract so nothing about how a minigame is hosted needs to differ.

const GAMES: Array[String] = [
	"res://scenes/nightmare/minigames/ArcadeDreamDodger.tscn",
	"res://scenes/nightmare/minigames/ArcadeMemoryGrid.tscn",
	"res://scenes/nightmare/minigames/ArcadeStackShift.tscn",
	"res://scenes/nightmare/minigames/ArcadePaddlePop.tscn",
	"res://scenes/nightmare/minigames/ArcadeSignalSort.tscn",
]

var _last_game: String = ""

## Avoids repeating the same mini-game twice in a row where possible
## (brief 3.3) - falls back to a genuine random pick if the pool only has
## one usable entry.
func random_game() -> String:
	var choice: String = GAMES[randi() % GAMES.size()]
	if GAMES.size() > 1:
		var attempts := 0
		while choice == _last_game and attempts < 8:
			choice = GAMES[randi() % GAMES.size()]
			attempts += 1
	_last_game = choice
	return choice
