extends Area3D
## A Chapter II required House/Porch Discovery — an actual interactable
## world object (a pair of shoes, a wind chime, a mail bundle), not a
## walk-through zone. Interacting once records the discovery and shows
## its line; the object stays in the world afterward as set dressing.

@export var discovery_id: String = ""
@export var discovery_text: String = ""

const REQUIRED_IDS := ["porch_shoes", "porch_mail", "porch_chime"]

var _player_inside: bool = false
var _collected: bool = false

func _ready() -> void:
	_collected = GameState.neighborhood_discoveries.has(discovery_id)
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside and not _collected:
		UiRoot.set_prompt("Press E to look closer.")
		if Input.is_action_just_pressed("interact"):
			_collect()

func _collect() -> void:
	_collected = true
	UiRoot.set_prompt("")
	if not GameState.neighborhood_discoveries.has(discovery_id):
		GameState.neighborhood_discoveries.append(discovery_id)
	var found := 0
	for id in REQUIRED_IDS:
		if GameState.neighborhood_discoveries.has(id):
			found += 1
	UiRoot.show_journal(discovery_text)
	UiRoot.flash_toast("House/Porch Discovery found. (%d of %d)" % [found, REQUIRED_IDS.size()])
	SaveManager.save_game()
