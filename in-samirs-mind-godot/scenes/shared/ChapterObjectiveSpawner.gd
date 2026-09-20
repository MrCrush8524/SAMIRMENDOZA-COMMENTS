extends Node
## Master Build Brief 3.1/16.4: at chapter load, choose required_object_
## count real objective locations from the chapter's objective marker
## group, and decoys from its decoy marker group. Re-rolled fresh every
## visit so a replay can't just beeline last run's spots. Never spawns
## on markers outside the two named groups, so per-chapter rules (e.g.
## "Chapter 1 objective markers must exclude the laundromat") are
## enforced simply by which group a level designer puts a Marker3D in.

const OBJECTIVE_SCENE := preload("res://scenes/shared/ChapterObjective.tscn")
const FLOOR_SNAP_HEIGHT := 3.0
const FLOOR_SNAP_DEPTH := 6.0

@export var chapter_id: String = ""
@export var objective_marker_group: String = ""
@export var decoy_marker_group: String = ""
@export var required_object_count: int = 3
@export var decoy_count: int = 3

func _ready() -> void:
	GameState.chapter_required_counts[chapter_id] = required_object_count
	if GameState.chapter_objectives_found.get(chapter_id, []).size() >= required_object_count:
		return # Already satisfied this run (e.g. returning after a no-clip detour).
	# Chapter geometry's collision (for raw imported GLBs, generated at
	# runtime - see the various ChapterNN.gd _ready() calls) needs at
	# least one physics step to actually register with the space before
	# a raycast against it means anything.
	await get_tree().physics_frame
	await get_tree().physics_frame
	_spawn_from_group(objective_marker_group, required_object_count, false)
	_spawn_from_group(decoy_marker_group, decoy_count, true)

func _spawn_from_group(group: String, count: int, decoy: bool) -> void:
	if group.is_empty() or count <= 0:
		return
	var markers := get_tree().get_nodes_in_group(group)
	markers.shuffle()
	var found: Array = GameState.chapter_objectives_found.get(chapter_id, [])
	for marker in markers:
		if not decoy and found.has(marker.name):
			continue # Real objective already collected this run.
		if count <= 0:
			break
		var floor_pos = _snap_to_floor(marker.global_position)
		if floor_pos == null:
			continue # Section 18.3: never spawn on a marker with no real floor under it.
		var inst: Node3D = OBJECTIVE_SCENE.instantiate()
		inst.global_position = floor_pos
		inst.call("configure", chapter_id, decoy)
		marker.get_parent().add_child(inst)
		count -= 1

## Casts down (and a little up, in case the marker was placed slightly
## below the actual floor) from the hand-placed marker to find real
## collision geometry, per section 18.3 - "tested against final
## collision/navigation, not just editor placement". Returns null if
## nothing solid is within range, so a marker that turned out to be
## inside a wall or over empty space is skipped rather than spawning an
## unreachable objective.
func _snap_to_floor(marker_pos: Vector3) -> Variant:
	var space_state := get_viewport().get_world_3d().direct_space_state
	var from := marker_pos + Vector3(0, FLOOR_SNAP_HEIGHT, 0)
	var to := marker_pos - Vector3(0, FLOOR_SNAP_DEPTH, 0)
	var query := PhysicsRayQueryParameters3D.create(from, to)
	var result := space_state.intersect_ray(query)
	if result.is_empty():
		return null
	return result["position"] + Vector3(0, 0.2, 0)
