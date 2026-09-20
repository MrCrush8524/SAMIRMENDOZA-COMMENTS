extends Area3D
## Master Build Brief section 12 (Chapter 7): a single Quaternius
## furniture piece, individually scattered across the city as a plain
## collectible - unlike ChapterObjective, there's no decoy/Nightmare
## Arcade branch here, since the brief only specifies "the player needs
## 7 of possibly-more collectible furniture items", not a real/decoy
## pair for this pool.

@export var chapter_id: String = "chapter07"

var _player_inside := false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false; UiRoot.set_prompt(""))

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to take it.")

func interact() -> void:
	UiRoot.set_prompt("")
	GameState.record_chapter_objective(chapter_id, name)
	var found: int = GameState.chapter_objectives_found.get(chapter_id, []).size()
	var required: int = GameState.chapter_required_counts.get(chapter_id, 0)
	UiRoot.flash_toast("Found. (%d of %d)" % [found, required])
	SaveManager.save_game()
	queue_free()
