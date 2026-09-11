extends Sprite3D
## From Chapter II onward, Doubt isn't just a sighting — it roams, and
## touching it (via a DoubtCatcher child Area3D) matters. Simple
## wander-to-random-point behavior: enough presence to make "avoid it"
## a real thing to do, not window dressing.

@export var speed: float = 1.4
@export var bounds: float = 26.0

var _target: Vector3

func _ready() -> void:
	_pick_new_target()

func _process(delta: float) -> void:
	var to_target := _target - global_position
	if to_target.length() < 0.5:
		_pick_new_target()
	else:
		global_position += to_target.normalized() * speed * delta

func _pick_new_target() -> void:
	_target = Vector3(randf_range(-bounds, bounds), global_position.y, randf_range(-bounds, bounds))
