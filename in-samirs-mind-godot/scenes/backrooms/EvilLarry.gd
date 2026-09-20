extends CharacterBody3D
## Master Build Brief 4.2: Evil Larry - a hostile black cat exclusive to
## the No-Clip Prison system. Chases the player directly (these prison
## environments aren't nav-mesh baked, so a simple pursue-and-avoid-
## obstacles loop is the "simplest Godot-native implementation" the
## brief allows for anything it leaves unspecified). Reuses the same
## cat_rigged.fbx rig as the player's own embodiment, per the brief's
## "do not create a new cat mesh if the existing rig can support Larry."

signal caught_player

const GRAVITY := 9.8
const CHASE_SPEED := 3.4
const CATCH_DISTANCE := 1.1
const CAT_MODEL := preload("res://assets/models/lowpoly_cat/cat_rigged.fbx")

var _target: Node3D = null
var _caught := false

func _ready() -> void:
	var mesh_root: Node3D = CAT_MODEL.instantiate()
	add_child(mesh_root)
	_blacken(mesh_root)
	# A faint cold light rather than horror-red - Evil Larry should read
	# as wrong/uncanny, not gory, matching the brief's dreamcore-not-
	# dark-horror direction.
	var glow := OmniLight3D.new()
	glow.light_color = Color(0.55, 0.75, 1.0)
	glow.light_energy = 0.6
	glow.omni_range = 1.5
	glow.position = Vector3(0, 0.25, 0)
	add_child(glow)

	var players := get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		_target = players[0]

func _blacken(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.02, 0.02, 0.03)
		mat.roughness = 0.85
		for i in node.mesh.get_surface_count():
			node.set_surface_override_material(i, mat)
	for c in node.get_children():
		_blacken(c)

func _physics_process(delta: float) -> void:
	if _caught or not is_instance_valid(_target):
		return
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	var to_target: Vector3 = _target.global_position - global_position
	to_target.y = 0.0
	var dist := to_target.length()
	if dist <= CATCH_DISTANCE:
		_caught = true
		caught_player.emit()
		return

	var dir := to_target.normalized()
	velocity.x = dir.x * CHASE_SPEED
	velocity.z = dir.z * CHASE_SPEED
	if dir.length() > 0.01:
		look_at(global_position + Vector3(dir.x, 0, dir.z), Vector3.UP)
	move_and_slide()
