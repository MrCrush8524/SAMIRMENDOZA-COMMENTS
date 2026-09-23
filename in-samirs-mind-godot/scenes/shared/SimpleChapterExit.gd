extends Area3D
## Bare physical chapter-to-chapter transition trigger (traversal-
## validation pass, per Samir's explicit instruction after the
## transition-chain audit found NO working exit anywhere in chapters
## 1-10 - every existing door/exit script in the project only lives in
## the retired InfiniteNeighborhood.tscn, never in the current spine).
##
## Deliberately carries no unlock/gate condition of its own. Samir was
## explicit: EXIT LOCATION, TRANSITION DESTINATION, and COMPLETION/GATE
## CONDITION are three separable concepts, and right now the gate is
## intentionally OPEN (always enterable) for this pass - a real
## condition (an item count, a journal set, whatever gets decided later)
## can be added to _is_open() below without touching the transition
## wiring itself. Existing objective/collectible systems in chapters
## that have them (1/3/5/7) are untouched and keep recording progress
## independently - this trigger does not read or require their state.
##
## Interact-gated (press E), not a walk-through trigger: this is what
## makes "the player cannot immediately retrigger the transition
## accidentally on destination spawn" true by construction rather than
## by careful spawn-point distancing - arriving inside this same node's
## area (or an equivalent one in the next chapter) does nothing until E
## is pressed again.

@export var destination_chapter: String = ""
@export var destination_spawn_marker: String = "start"
@export var prompt_text: String = "Press E to continue."

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false; UiRoot.set_prompt(""))

func _is_open() -> bool:
	return true # Gate condition intentionally deferred - see class doc.

func _process(_delta: float) -> void:
	if _player_inside and _is_open():
		UiRoot.set_prompt(prompt_text)
		if Input.is_action_just_pressed("interact"):
			_trigger_transition()

func _trigger_transition() -> void:
	UiRoot.set_prompt("")
	SaveManager.save_game()
	var game_root: Node = get_tree().get_first_node_in_group("game_root")
	if game_root and game_root.has_method("enter_chapter"):
		game_root.enter_chapter(destination_chapter, destination_spawn_marker)
