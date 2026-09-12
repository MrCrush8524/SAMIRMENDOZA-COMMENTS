extends CharacterBody3D
## First-person controller. Physics-rate movement, independent of render
## frame rate, per PERFORMANCE_BUDGETS.md / MASTER_GODOT_REBUILD_PLAN.md.

const WALK_SPEED := 3.2
const SPRINT_SPEED := 5.0
const MOUSE_SENS := 0.0022
const GRAVITY := 9.8

## Collision capsule radius (see Player.tscn) — kept slender since the
## dreamer is a small cat/dog, not human-shouldered. Any passage meant
## to be walkable must clear at least 2x this in width; a passage
## narrower than that is a deliberate blocker, not a bug.
const COLLIDER_RADIUS := 0.22

## Downward camera pitch (radians) where the paw overlay starts/finishes
## fading in, per CLAUDE_PAW_ASSET_IMPLEMENTATION_GUIDE.md's suggested
## 25-35° start / 45-65° full range.
const PAW_FADE_START := deg_to_rad(25.0)
const PAW_FADE_FULL := deg_to_rad(55.0)
const PAW_MAX_OPACITY := 0.94

## Scroll wheel is a discrete per-tick event, not a held axis, so each
## tick refreshes a short "still walking" window instead of stepping the
## player once per notch — scrolling steadily then reads as continuous
## forward/backward walking, same speed rules (Shift = sprint) as WASD.
const SCROLL_WALK_HOLD_TIME := 0.25

@export var paw_texture_bobby: Texture2D
@export var paw_texture_luna: Texture2D
@export var paw_texture_mateo: Texture2D

## Full-body character-card art (same source as Character Select) used
## only as the player's reflection in MirrorSurface instances — see
## mirror_body below. Not paw art: mirrors want to show "you", not a
## first-person hand.
@export var mirror_texture_bobby: Texture2D
@export var mirror_texture_luna: Texture2D
@export var mirror_texture_mateo: Texture2D

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var interact_ray: RayCast3D = $Head/Camera3D/InteractRay
@onready var paw_overlay: TextureRect = %PawOverlay
## On MirrorSurface.MIRROR_ONLY_LAYER — invisible to the main first-person
## camera (its cull_mask excludes that layer) but visible to any mirror's
## viewport camera, which is how "the character reflects" without ever
## putting a body in the way of normal play.
@onready var mirror_body: Sprite3D = $MirrorBody

var pitch: float = 0.0
var touch_look_active: bool = false
var touch_look_id: int = -1
var touch_look_start := Vector2.ZERO

var _scroll_forward_timer: float = 0.0
var _scroll_backward_timer: float = 0.0

signal interact_pressed(target: Node)

func _ready() -> void:
	if OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]:
		pass # touch look handled via _unhandled_input below regardless of platform
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	refresh_dreamer_visuals()
	GameState.current_player = self

func _exit_tree() -> void:
	if GameState.current_player == self:
		GameState.current_player = null

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * MOUSE_SENS)
		pitch = clamp(pitch - event.relative.y * MOUSE_SENS, -1.3, 1.3)
		head.rotation.x = pitch
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_scroll_forward_timer = SCROLL_WALK_HOLD_TIME
		_scroll_backward_timer = 0.0
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_scroll_backward_timer = SCROLL_WALK_HOLD_TIME
		_scroll_forward_timer = 0.0
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

	_scroll_forward_timer = maxf(0.0, _scroll_forward_timer - delta)
	_scroll_backward_timer = maxf(0.0, _scroll_backward_timer - delta)

	var forward_input := Input.get_action_strength("move_forward")
	var back_input := Input.get_action_strength("move_back")
	if _scroll_forward_timer > 0.0:
		forward_input = 1.0
	if _scroll_backward_timer > 0.0:
		back_input = 1.0

	var input_dir := Vector2(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		back_input - forward_input
	)
	var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	var speed := SPRINT_SPEED if Input.is_action_pressed("sprint") else WALK_SPEED
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed

	move_and_slide()
	_update_paw_overlay()

func _update_paw_overlay() -> void:
	# pitch is negative when looking down (see _unhandled_input above).
	var downward: float = maxf(0.0, -pitch)
	var t: float = clampf(inverse_lerp(PAW_FADE_START, PAW_FADE_FULL, downward), 0.0, 1.0)
	paw_overlay.modulate.a = t * PAW_MAX_OPACITY

func _try_interact() -> void:
	if interact_ray.is_colliding():
		var target := interact_ray.get_collider()
		if target and target.has_method("interact"):
			interact_pressed.emit(target)
			target.interact()

func set_spawn(position_3d: Vector3, yaw: float) -> void:
	global_position = position_3d
	rotation.y = yaw

## Re-applies whichever dreamer's paw art matches GameState.dreamer — run
## once at spawn, and again any time the player changes character mid-run
## via the pause menu (see PauseMenu.gd), so the swap is instant and
## doesn't require a chapter reload.
func refresh_dreamer_visuals() -> void:
	match GameState.dreamer:
		"Bobby": paw_overlay.texture = paw_texture_bobby
		"Luna": paw_overlay.texture = paw_texture_luna
		"Mateo": paw_overlay.texture = paw_texture_mateo
	if mirror_body:
		mirror_body.texture = _mirror_texture_for(GameState.dreamer)

func _mirror_texture_for(dreamer_id: String) -> Texture2D:
	match dreamer_id:
		"Bobby": return mirror_texture_bobby
		"Luna": return mirror_texture_luna
		"Mateo": return mirror_texture_mateo
	return null
