extends CharacterBody3D
## First-person controller. Physics-rate movement, independent of render
## frame rate, per PERFORMANCE_BUDGETS.md / MASTER_GODOT_REBUILD_PLAN.md.

const WALK_SPEED := 3.2
const SPRINT_SPEED := 5.0
const MOUSE_SENS := 0.0022
const GRAVITY := 9.8

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var interact_ray: RayCast3D = $Head/Camera3D/InteractRay

var pitch: float = 0.0
var touch_look_active: bool = false
var touch_look_id: int = -1
var touch_look_start := Vector2.ZERO

signal interact_pressed(target: Node)

func _ready() -> void:
	if OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]:
		pass # touch look handled via _unhandled_input below regardless of platform
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * MOUSE_SENS)
		pitch = clamp(pitch - event.relative.y * MOUSE_SENS, -1.3, 1.3)
		head.rotation.x = pitch
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventScreenDrag:
		rotate_y(-event.relative.x * MOUSE_SENS)
		pitch = clamp(pitch - event.relative.y * MOUSE_SENS, -1.3, 1.3)
		head.rotation.x = pitch

	if event.is_action_pressed("interact"):
		_try_interact()

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	var input_dir := Vector2(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		Input.get_action_strength("move_back") - Input.get_action_strength("move_forward")
	)
	var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	var speed := SPRINT_SPEED if Input.is_action_pressed("sprint") else WALK_SPEED
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed

	move_and_slide()

func _try_interact() -> void:
	if interact_ray.is_colliding():
		var target := interact_ray.get_collider()
		if target and target.has_method("interact"):
			interact_pressed.emit(target)
			target.interact()

func set_spawn(position_3d: Vector3, yaw: float) -> void:
	global_position = position_3d
	rotation.y = yaw
