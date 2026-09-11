extends Area3D
## A same-scene vertical connector for multi-tiered levels (Chapter III's
## Ground/Mezzanine/Lower/Solarium) — no scene reload, just teleports the
## player straight to another marker in the same chapter. Simpler and
## more reliably walkable than modeling literal ramps/stairs between
## floors at very different Y heights.

@export var target_marker: NodePath
@export var lift_label: String = "the lift"

var _player_inside: bool = false

func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("player"): _player_inside = true)
	body_exited.connect(func(b): if b.is_in_group("player"): _player_inside = false)

func _process(_delta: float) -> void:
	if _player_inside:
		UiRoot.set_prompt("Press E to take %s." % lift_label)
		if Input.is_action_just_pressed("interact"):
			_use_lift()

func _use_lift() -> void:
	UiRoot.set_prompt("")
	var target := get_node(target_marker) as Node3D
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if target and player:
		player.set_spawn(target.global_position, player.rotation.y)
