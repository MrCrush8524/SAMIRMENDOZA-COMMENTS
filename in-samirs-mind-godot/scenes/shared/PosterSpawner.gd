extends Node
## Randomly scatters the poster textures as free-standing double-sided
## signboards across a level, discovered via raycast against the
## chapter's actual collision - there's no hand-authored "here's a
## good spot" data for a raw imported GLB, so candidate spots are found
## the same way ChapterObjectiveSpawner snaps markers to floors: a
## downward probe from a random (x, z) offset finds real floor, and the
## sign is rooted there.
##
## An earlier version required each spot to also have a nearby vertical
## wall to mount against, like a picture frame - but Kitty's House
## turned out to be built mostly from open stairs/platforms rather than
## a boxed room (a headless spawn test found real floor at ~54% of
## random samples, yet a wall within reach at under 2% of those), so
## almost every attempt was thrown away for want of a wall that mostly
## doesn't exist here. Free-standing signs planted directly in the
## floor need only the floor half of that check, which is why this
## fits the actual geometry instead of starving on it.
##
## Accepted spots must be far enough from every already-placed sign
## (MIN_SEPARATION) so they spread across the space instead of
## clustering wherever the random search happens to land first.

const MAX_ATTEMPTS := 4000
const MIN_SEPARATION := 3.0
const FLOOR_PROBE_UP := 5.0
const FLOOR_PROBE_DOWN := 5.0
const MAX_POSTER_DIM := 1.4  # meters, longer side of the sign

@export var textures: Array[Texture2D] = []
@export var search_centers: Array[NodePath] = []
@export var search_radius: float = 15.0
@export var poster_count: int = 12

## Shared entry point for a chapter's _ready(): loads every image in
## poster_dir, builds a spawner centered on start_path, and attaches it
## - so each chapter needs only one call instead of repeating the
## texture-loading/node-setup boilerplate. Properties are set before
## add_child() deliberately: add_child() on a parent already in the
## tree calls the new child's _ready() immediately, which would see
## empty defaults if the exports were set afterward instead.
## start_path is relative to the spawner node itself, which is added as
## a CHILD of chapter - so a "start" marker that's a direct child of
## chapter (the usual case) is the spawner's sibling, hence the "../"
## default rather than "start".
static func attach(chapter: Node, start_path: String = "../start", radius: float = 15.0, poster_dir: String = "res://assets/posters/circus") -> void:
	var textures: Array[Texture2D] = []
	var dir := DirAccess.open(poster_dir)
	if dir:
		for file in dir.get_files():
			if file.ends_with(".import"):
				continue
			var tex: Texture2D = load(poster_dir + "/" + file)
			if tex:
				textures.append(tex)
	if textures.is_empty():
		return
	var spawner := Node.new()
	spawner.set_script(preload("res://scenes/shared/PosterSpawner.gd"))
	spawner.textures = textures
	var centers: Array[NodePath] = [NodePath(start_path)]
	spawner.search_centers = centers
	spawner.search_radius = radius
	chapter.add_child(spawner)

func _ready() -> void:
	if textures.is_empty() or search_centers.is_empty():
		return
	# Chapter geometry's collision (generated at runtime by MeshMerger)
	# needs at least one physics step to register with the space before
	# a raycast against it means anything - same gotcha as
	# ChapterObjectiveSpawner's floor snap.
	await get_tree().physics_frame
	await get_tree().physics_frame
	_place_posters()

func _place_posters() -> void:
	var centers: Array[Vector3] = []
	for path in search_centers:
		var node := get_node_or_null(path)
		if node is Node3D:
			centers.append(node.global_position)
	if centers.is_empty():
		return

	var space_state := get_viewport().get_world_3d().direct_space_state
	var order := textures.duplicate()
	order.shuffle()
	var target_count: int = min(poster_count, order.size())
	var placed: Array[Vector3] = []
	var attempts := 0

	while placed.size() < target_count and attempts < MAX_ATTEMPTS:
		attempts += 1
		var center: Vector3 = centers[randi() % centers.size()]
		var offset := Vector3(randf_range(-search_radius, search_radius), 0, randf_range(-search_radius, search_radius))
		var probe_from := center + offset + Vector3(0, FLOOR_PROBE_UP, 0)
		var probe_to := center + offset - Vector3(0, FLOOR_PROBE_DOWN, 0)
		var query := PhysicsRayQueryParameters3D.create(probe_from, probe_to)
		var result := space_state.intersect_ray(query)
		if result.is_empty():
			continue  # no real floor under this random (x, z)

		var pos: Vector3 = result["position"]
		var too_close := false
		for p in placed:
			if p.distance_to(pos) < MIN_SEPARATION:
				too_close = true
				break
		if too_close:
			continue

		placed.append(pos)
		_spawn_poster(pos, order[placed.size() - 1])

func _spawn_poster(pos: Vector3, tex: Texture2D) -> void:
	var tex_size := tex.get_size()
	var aspect: float = tex_size.x / tex_size.y if tex_size.y > 0 else 1.0
	var size: Vector2
	if aspect >= 1.0:
		size = Vector2(MAX_POSTER_DIM, MAX_POSTER_DIM / aspect)
	else:
		size = Vector2(MAX_POSTER_DIM * aspect, MAX_POSTER_DIM)

	var mesh := QuadMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED  # visible from either side, like a real standee
	mesh.material = mat

	var inst := MeshInstance3D.new()
	inst.mesh = mesh
	add_child(inst)
	# Bottom edge of the quad sits at floor level, not its center.
	inst.global_position = pos + Vector3(0, size.y * 0.5, 0)
	inst.rotate_y(randf_range(0.0, TAU))
