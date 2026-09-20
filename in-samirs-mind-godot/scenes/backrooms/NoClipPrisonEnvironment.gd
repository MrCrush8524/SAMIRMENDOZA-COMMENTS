extends Node3D
## Master Build Brief 4.1/4.2/17.3: generic No-Clip Prison wrapper.
## Instances one of the backrooms_vr environments, auto-generates
## collision for it (these are raw imported GLBs, not hand-authored
## chapter geometry with collision already placed), then places a
## spawn point, one escape object, and Evil Larry at randomized points
## sampled from the environment's own floor via downward raycasts -
## these source assets carry no hand-authored Marker3D pool the way a
## real chapter would, so sampled-and-validated points are the
## "simplest Godot-native implementation that preserves the
## specification" the brief allows where a detail is left unspecified.

const ESCAPE_OBJECT_SCENE := preload("res://scenes/backrooms/NoClipEscapeObject.tscn")
const EVIL_LARRY_SCENE := preload("res://scenes/backrooms/EvilLarry.tscn")
const RAYCAST_HEIGHT := 50.0
const MIN_LARRY_DISTANCE := 6.0
const MIN_ESCAPE_DISTANCE := 4.0
const SAMPLE_ATTEMPTS := 40

## GameRoot connects to these directly on the scene node it gets back
## from SceneLoader.scene_ready, the same way it already reads a normal
## chapter's "start" Marker3D - no separate broadcast mechanism needed.
signal environment_ready(spawn_position: Vector3, spawn_yaw: float)
signal escaped
signal caught

@export var environment_scene: PackedScene

var _aabb_min := Vector3(INF, INF, INF)
var _aabb_max := Vector3(-INF, -INF, -INF)
var _found_mesh := false

func _ready() -> void:
	var env: Node3D = environment_scene.instantiate()
	add_child(env)
	_generate_collision(env)
	_collect_aabb(env)
	if not _found_mesh:
		_aabb_min = Vector3(-5, 0, -5)
		_aabb_max = Vector3(5, 3, 5)

	await get_tree().physics_frame
	await get_tree().physics_frame

	var spawn_point := _sample_floor_point([])
	var escape_point := _sample_floor_point([{"point": spawn_point, "min_dist": MIN_ESCAPE_DISTANCE}])
	var larry_point := _sample_floor_point([
		{"point": spawn_point, "min_dist": MIN_LARRY_DISTANCE},
		{"point": escape_point, "min_dist": 2.0},
	])

	var escape_obj: Node3D = ESCAPE_OBJECT_SCENE.instantiate()
	add_child(escape_obj)
	escape_obj.global_position = escape_point
	escape_obj.escaped.connect(func(): escaped.emit())

	var larry: Node3D = EVIL_LARRY_SCENE.instantiate()
	add_child(larry)
	larry.global_position = larry_point
	larry.caught_player.connect(func(): caught.emit())

	environment_ready.emit(spawn_point, 0.0)

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)

func _collect_aabb(node: Node) -> void:
	if node is MeshInstance3D and node.mesh:
		var world_aabb: AABB = node.global_transform * node.mesh.get_aabb()
		_aabb_min = _aabb_min.min(world_aabb.position)
		_aabb_max = _aabb_max.max(world_aabb.end)
		_found_mesh = true
	for c in node.get_children():
		_collect_aabb(c)

## constraints: Array of {"point": Vector3, "min_dist": float} - a
## candidate must be at least min_dist from every listed point.
func _sample_floor_point(constraints: Array) -> Vector3:
	var space_state := get_world_3d().direct_space_state
	var best: Vector3 = (_aabb_min + _aabb_max) * 0.5
	best.y = _aabb_min.y + 0.1

	for i in SAMPLE_ATTEMPTS:
		var x := randf_range(_aabb_min.x, _aabb_max.x)
		var z := randf_range(_aabb_min.z, _aabb_max.z)
		var from := Vector3(x, _aabb_max.y + RAYCAST_HEIGHT, z)
		var to := Vector3(x, _aabb_min.y - 5.0, z)
		var query := PhysicsRayQueryParameters3D.create(from, to)
		var result := space_state.intersect_ray(query)
		if result.is_empty():
			continue
		var candidate: Vector3 = result["position"] + Vector3(0, 0.15, 0)
		var ok := true
		for c in constraints:
			if candidate.distance_to(c["point"]) < c["min_dist"]:
				ok = false
				break
		if ok:
			return candidate
	return best
