extends CharacterBody3D
## First-person controller. Physics-rate movement, independent of render
## frame rate, per PERFORMANCE_BUDGETS.md / MASTER_GODOT_REBUILD_PLAN.md.

const WALK_SPEED := 3.2
const SPRINT_SPEED := 5.0
const MOUSE_SENS := 0.0022
## Radians/sec at full stick deflection - tuned against MOUSE_SENS to
## feel like a comparably brisk full turn rather than either a twitchy
## snap or a sluggish crawl; the 0.2 deadzone on look_left/right/up/down
## (project.godot, same convention as every other action) is what
## actually stops stick drift, not this.
const CONTROLLER_LOOK_SENS := 2.6
const GRAVITY := 9.8

## Collision capsule radius (see Player.tscn) — sized for Nathan (the
## permanent human player, not the cat companion, which never wears
## this collider). Any passage meant to be walkable must clear at least
## 2x this in width; a passage narrower than that is a deliberate
## blocker, not a bug. Widened from 0.22 (the cat-era value) to 0.28 -
## REQUIRES SAMIR VISUAL PLAYTEST across chapters to confirm no existing
## doorway/corridor sized for the old capsule is now too tight.
const COLLIDER_RADIUS := 0.28

## Same distance-scrub idea CompanionFollower.gd uses for the cat (its
## own scrub_anim_name/scrub_cycles_per_meter export). The CC4-derived
## SamirBody (assets/characters/game_ready/samir/SamirBody.tscn) has NO
## AnimationPlayer at all - its source FBX's only 2 clips were confirmed
## single-frame static poses, not real locomotion - so nathan_anim below
## resolves to null and _update_body_animation() is a documented no-op
## until a real walk/idle clip exists for this rig. Kept looking for
## NATHAN_ANIM_NAME rather than deleted, so a future compatible animation
## only needs adding to the scene, not new code here.
const NATHAN_ANIM_CYCLES_PER_METER := 0.55
const NATHAN_ANIM_NAME := "Take 001"

## Scroll wheel is a discrete per-tick event, not a held axis, so each
## tick refreshes a short "still walking" window instead of stepping the
## player once per notch — scrolling steadily then reads as continuous
## forward/backward walking, same speed rules (Shift = sprint) as WASD.
const SCROLL_WALK_HOLD_TIME := 0.25

## Hold "kneel" (C) to smoothly drop the camera toward roughly a real
## cat's eye height, so the angle can actually be looked at in-game
## before committing to changing it permanently everywhere - the
## camera/collision are currently tuned for a ~1.6m eye height (see
## COLLIDER_RADIUS's doc comment), not this. Purely a look/feel probe:
## does not touch collision, so kneeling doesn't let the player fit
## through anything they couldn't already.
const KNEEL_HEAD_Y := 0.35
const KNEEL_SPEED_MPS := 2.0
var _stand_head_y: float

## Open-world chapter geometry (Downtown's street, a rooftop with a gap
## in its own walkway, etc.) has no floor past its edges - stepping off
## one used to be an unrecoverable, silent, endless fall. Below this Y,
## GameRoot.void_fall() catches it: an arcade-minigame stake, win to
## land back at _last_grounded_position, lose and the chapter reloads
## from its own start. Well below every real chapter's floor (they all
## sit at y=~0) so it never fires from an ordinary pit or basement.
const VOID_FALL_Y := -15.0
var _last_grounded_position: Vector3
var _last_grounded_yaw: float

## Master Build Brief 4.1: from Chapter 2 onward (GameState.
## no_clip_enabled_for_chapter, set false for Chapter 1 specifically),
## roll a chance every NOCLIP_CHECK_INTERVAL seconds to drop the player
## into a No-Clip Prison. A periodic roll rather than a per-frame chance
## keeps the odds independent of frame rate.
const NOCLIP_CHECK_INTERVAL := 20.0
const NOCLIP_CHANCE_PER_CHECK := 0.05
var _noclip_check_timer := NOCLIP_CHECK_INTERVAL

## DreamerBody's fur (see DreamerCatSkin.gd) - Bobby is a two-tone coat
## (body + darker points), Luna/Mateo pass the same texture as both
## since their coats are uniform.
@export var fur_bobby_body: Texture2D
@export var fur_bobby_points: Texture2D
@export var fur_luna: Texture2D
@export var fur_mateo: Texture2D

## Dedicated "looking back" body art (from the locked character body
## asset pack, distinct from the Character Select door cards) used only
## as the player's reflection in MirrorSurface instances — see
## mirror_body below. Not paw art: mirrors want to show "you", not a
## first-person hand.
@export var mirror_texture_bobby: Texture2D
@export var mirror_texture_luna: Texture2D
@export var mirror_texture_mateo: Texture2D

@onready var head: Node3D = $Head
@onready var camera: Camera3D = $Head/Camera3D
@onready var interact_ray: RayCast3D = $Head/Camera3D/InteractRay
@onready var dreamer_body: Node3D = %DreamerBody
@onready var nathan_anim: AnimationPlayer = %NathanBody.find_child("AnimationPlayer", true, false)
## CatSlot always follows as the companion; NathanSlot is always worn
## (rigid, fixed local transform under the camera) - see CompanionFollower.gd.
## There is no runtime swap between them.
@onready var cat_slot: Node3D = %CatSlot
@onready var nathan_slot: Node3D = %NathanSlot
## On MirrorSurface.MIRROR_ONLY_LAYER — invisible to the main first-person
## camera (its cull_mask excludes that layer) but visible to any mirror's
## viewport camera, which is how "the character reflects" without ever
## putting a body in the way of normal play.
@onready var mirror_body: Sprite3D = $MirrorBody

var pitch: float = 0.0

var _scroll_forward_timer: float = 0.0
var _scroll_backward_timer: float = 0.0

## Companion View (integration brief Section 14/20): a camera-only
## perspective swap to approximately the selected companion's head/eye
## position. Samir remains the controlled protagonist the whole time -
## this never touches movement input or GameState.dreamer, only where
## the Camera3D's transform is drawn from each frame.
var _companion_view_active: bool = false

signal interact_pressed(target: Node)

func _ready() -> void:
	# DisplayServer.is_touchscreen_available() is what actually tells us
	# a touchscreen is present, on native mobile AND a web build running
	# in an iPad/iPhone/Android browser alike - OS.has_feature("mobile")
	# is false for the web export even when it's running on a phone, so
	# checking that alone left touch devices with the mouse wrongly
	# captured (and hidden) the moment they tapped the canvas.
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	refresh_dreamer_visuals()
	# Nathan (the human) is always the controlled player; the cat is
	# always the physical companion. There is no player-facing swap
	# between them (see PauseMenu.gd, which no longer exposes one).
	nathan_slot.set_following(false)
	cat_slot.set_following(true)
	_stand_head_y = head.position.y
	_last_grounded_position = global_position
	_last_grounded_yaw = rotation.y
	# The cat's own run-cycle setup (loop mode, initial play/pause) is
	# owned entirely by CompanionFollower.gd now that it's always the
	# companion, not something Player.gd needs to reach into.
	GameState.current_player = self
	# Belt-and-suspenders against UiRoot's Pause Menu (a persistent autoload
	# overlay that outlives scene changes) ever starting a fresh dream
	# already open from some earlier stray state.
	UiRoot.pause_menu.visible = false

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

	if event.is_action_pressed("interact") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_try_interact()

	if event.is_action_pressed("companion_view") and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		set_companion_view(not _companion_view_active)

## Enters/exits Companion View. Movement input, GameState.dreamer, and
## save state are all untouched either way - only camera.transform
## changes. Looks for a "ViewAnchor" node under whatever cat_slot's
## current child is (present on the new BobbyVisual/MateoVisual/
## LunaVisual wrappers - see CompanionVisual.gd); falls back to a fixed
## offset above the companion's own position for the current temporary
## cat body, which predates that anchor convention.
func set_companion_view(active: bool) -> void:
	_companion_view_active = active
	if not active:
		camera.transform = Transform3D.IDENTITY
		return
	_update_companion_view_camera()

func _get_companion_view_anchor() -> Node3D:
	if cat_slot.get_child_count() == 0:
		return null
	var visual: Node = cat_slot.get_child(0)
	if visual.has_method("get_view_anchor"):
		var anchor: Node3D = visual.get_view_anchor()
		if anchor:
			return anchor
	return null

func _update_companion_view_camera() -> void:
	var anchor := _get_companion_view_anchor()
	if anchor:
		camera.global_transform = anchor.global_transform
	else:
		# Fallback for the temporary cat body, which has no ViewAnchor of
		# its own yet - an approximate small-animal eye height above its
		# current position, facing the same way it's currently facing.
		var fallback_height := 0.35
		camera.global_transform = Transform3D(
			Basis(Vector3.UP, cat_slot.rotation.y),
			cat_slot.global_position + Vector3(0, fallback_height, 0))

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0
		_last_grounded_position = global_position
		_last_grounded_yaw = rotation.y

	if global_position.y < VOID_FALL_Y:
		var game_root := get_tree().get_first_node_in_group("game_root")
		if game_root and game_root.has_method("void_fall"):
			game_root.void_fall(_last_grounded_position, _last_grounded_yaw)

	if GameState.no_clip_enabled_for_chapter and not GameState.in_noclip_prison \
			and not GameState.in_nightmare and not GameState.in_backrooms:
		_noclip_check_timer -= delta
		if _noclip_check_timer <= 0.0:
			_noclip_check_timer = NOCLIP_CHECK_INTERVAL
			if randf() < NOCLIP_CHANCE_PER_CHECK:
				var game_root := get_tree().get_first_node_in_group("game_root")
				if game_root and game_root.has_method("enter_noclip_prison"):
					game_root.enter_noclip_prison()

	_scroll_forward_timer = maxf(0.0, _scroll_forward_timer - delta)
	_scroll_backward_timer = maxf(0.0, _scroll_backward_timer - delta)

	# Every menu/overlay in this game (PauseMenu, Settings, Chapter
	# Select, the journal/track popups...) sets mouse_mode to VISIBLE on
	# open and back to CAPTURED on close - already a consistent, established
	# signal for "a blocking screen is up" across the whole codebase, so
	# gating gameplay input on it (rather than adding a second, separate
	# "is a menu open" flag) needs no new state and can't drift out of
	# sync with what the UI is actually doing. Movement/sprint/kneel/look
	# are skipped entirely while any menu owns the mouse - gravity and
	# move_and_slide() below still run either way, so falling doesn't
	# freeze mid-air just because a menu happens to be open.
	var gameplay_input_active := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED

	if gameplay_input_active:
		_update_controller_look(delta)

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
	else:
		velocity.x = 0.0
		velocity.z = 0.0

	move_and_slide()
	_update_body_animation(delta)
	_update_kneel(delta, gameplay_input_active)
	if _companion_view_active:
		_update_companion_view_camera()

## Right stick, continuously polled (unlike mouse-look, which is
## event-driven off InputEventMouseMotion in _unhandled_input) since an
## analog stick reports a held position every frame rather than discrete
## deltas - same rotate_y/pitch application as the mouse branch there,
## just scaled by delta instead of by a single motion event.
func _update_controller_look(delta: float) -> void:
	var look := Input.get_vector("look_left", "look_right", "look_up", "look_down")
	if look == Vector2.ZERO:
		return
	rotate_y(-look.x * CONTROLLER_LOOK_SENS * delta)
	pitch = clamp(pitch - look.y * CONTROLLER_LOOK_SENS * delta, -1.3, 1.3)
	head.rotation.x = pitch

func _update_kneel(delta: float, gameplay_input_active: bool) -> void:
	var target_y := KNEEL_HEAD_Y if (gameplay_input_active and Input.is_action_pressed("kneel")) else _stand_head_y
	head.position.y = move_toward(head.position.y, target_y, KNEEL_SPEED_MPS * delta)

## Nathan is always the worn body now (see _ready) - scrub his walk clip
## by distance traveled, same technique used for the cat's own cycle
## when it used to be wearable, so a stationary player doesn't keep
## walking in place and stride speed actually matches movement speed.
func _update_body_animation(delta: float) -> void:
	if not nathan_anim or not nathan_anim.has_animation(NATHAN_ANIM_NAME):
		return
	var ground_speed: float = Vector2(velocity.x, velocity.z).length()
	var anim_length: float = nathan_anim.get_animation(NATHAN_ANIM_NAME).length
	var advance: float = ground_speed * delta * NATHAN_ANIM_CYCLES_PER_METER * anim_length
	var new_pos: float = fmod(nathan_anim.current_animation_position + advance, anim_length)
	nathan_anim.seek(new_pos, true)

const INTERACT_RANGE := 2.2
const MAX_INTERACT_PIERCE := 6

## A plain RayCast3D only ever reports its single nearest hit, and with
## collide_with_areas on, that's just as likely to be an incidental
## trigger volume (an ambience/flavor zone, the Backrooms entrance) as a
## real interactable - those have no interact() method, so bailing out
## on the first hit silently "blocked" every pickup standing behind one.
## Query the space directly instead, excluding each non-interactable hit
## and re-casting, so a real interactable further along the same ray is
## still found.
func _try_interact() -> void:
	var space_state := get_world_3d().direct_space_state
	var from := interact_ray.global_transform.origin
	# interact_ray's own forward direction, not an assumption about the
	# player body's facing, since the camera can pitch independently.
	var to := from + interact_ray.global_transform.basis.z * -1.0 * INTERACT_RANGE
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collide_with_areas = true
	query.collide_with_bodies = true
	var excluded: Array[RID] = []
	for _i in MAX_INTERACT_PIERCE:
		query.exclude = excluded
		var result := space_state.intersect_ray(query)
		if result.is_empty():
			return
		var target: Object = result["collider"]
		if target and target.has_method("interact"):
			interact_pressed.emit(target)
			target.interact()
			return
		if not (target is CollisionObject3D):
			return
		# a solid wall/body blocks line of sight entirely - don't pierce it,
		# only skip past non-interactable Area3D triggers.
		if target is StaticBody3D or target is CharacterBody3D or target is RigidBody3D:
			return
		excluded.append(target.get_rid())

func set_spawn(position_3d: Vector3, yaw: float) -> void:
	global_position = position_3d
	rotation.y = yaw
	# Every caller here is a teleport (chapter load, nightmare/backrooms
	# return, the void-fall catch below...) - carrying over whatever
	# velocity the body had before is never right, and for a fast fall
	# specifically it's actively dangerous: move_and_slide() isn't
	# continuous-collision, so a big leftover downward velocity can
	# punch straight through a thin floor on the very next physics step
	# instead of landing on it.
	velocity = Vector3.ZERO
	_last_grounded_position = position_3d
	_last_grounded_yaw = yaw

## Re-applies whichever dreamer's fur matches GameState.dreamer — run
## once at spawn, and again any time the player changes character mid-run
## via the pause menu (see PauseMenu.gd), so the swap is instant and
## doesn't require a chapter reload.
func refresh_dreamer_visuals() -> void:
	if dreamer_body:
		match GameState.dreamer:
			"Bobby": dreamer_body.set_textures(fur_bobby_body, fur_bobby_points)
			"Luna": dreamer_body.set_textures(fur_luna, fur_luna)
			"Mateo": dreamer_body.set_textures(fur_mateo, fur_mateo)
	if mirror_body:
		mirror_body.texture = _mirror_texture_for(GameState.dreamer)

func _mirror_texture_for(dreamer_id: String) -> Texture2D:
	match dreamer_id:
		"Bobby": return mirror_texture_bobby
		"Luna": return mirror_texture_luna
		"Mateo": return mirror_texture_mateo
	return null
