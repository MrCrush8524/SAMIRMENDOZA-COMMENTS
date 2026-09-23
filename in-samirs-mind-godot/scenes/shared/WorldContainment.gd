## Builds a tall invisible perimeter around a chapter's already-generated
## collision geometry, so the player (or the companion) can't simply walk
## off the edge of an open chapter into an endless fall. Call this AFTER
## the chapter's own collision generation (_generate_collision /
## MeshMerger.merge_and_collide) has run, so there's real geometry to
## measure.
##
## This is explicitly the PRIMARY defense described in the repair brief -
## a physical, continuous, unscalable boundary - not a substitute for the
## SECONDARY below-world recovery already in GameRoot.void_fall (player)
## and CompanionFollower's void_fall_y snap (companion). It is also not a
## substitute for fixing a genuine hole INSIDE the playable area - this
## only guards the outer edge of whatever collision already exists, at a
## margin, so it can never itself block a legitimate path through the
## interior.
##
## Not a class_name - this project runs Godot headlessly from the command
## line for testing, and a newly added class_name isn't resolvable until
## the editor has regenerated its global script class cache (same
## reasoning as MeshMerger.gd/NightmareArcadeUi.gd). Call via
## `preload(".../WorldContainment.gd").enclose(self, roots)`.

class AABBAccum:
	var min_p := Vector3(INF, INF, INF)
	var max_p := Vector3(-INF, -INF, -INF)
	var found := false

static func enclose(chapter: Node3D, roots: Array, margin: float = 4.0, wall_height: float = 80.0, wall_thickness: float = 2.0) -> void:
	var acc := AABBAccum.new()
	for root in roots:
		if root:
			_collect(root, acc)
	if not acc.found:
		return # Nothing measurable - leave the chapter untouched rather than guess a box.

	var min_p: Vector3 = acc.min_p
	var max_p: Vector3 = acc.max_p
	var cx := (min_p.x + max_p.x) / 2.0
	var cz := (min_p.z + max_p.z) / 2.0
	# Base the wall's vertical center on the LOWEST measured geometry so a
	# multi-level chapter (e.g. one with both a ground floor and a raised
	# platform) still gets a wall tall enough to cover every level, not
	# just whichever surface happened to anchor the AABB.
	var wall_center_y := min_p.y + wall_height / 2.0
	var size_x := (max_p.x - min_p.x) + margin * 2.0
	var size_z := (max_p.z - min_p.z) + margin * 2.0

	var container := Node3D.new()
	container.name = "WorldContainment"
	chapter.add_child(container)

	_add_wall(container, Vector3(cx, wall_center_y, min_p.z - margin - wall_thickness / 2.0), Vector3(size_x + wall_thickness * 2.0, wall_height, wall_thickness))
	_add_wall(container, Vector3(cx, wall_center_y, max_p.z + margin + wall_thickness / 2.0), Vector3(size_x + wall_thickness * 2.0, wall_height, wall_thickness))
	_add_wall(container, Vector3(min_p.x - margin - wall_thickness / 2.0, wall_center_y, cz), Vector3(wall_thickness, wall_height, size_z + wall_thickness * 2.0))
	_add_wall(container, Vector3(max_p.x + margin + wall_thickness / 2.0, wall_center_y, cz), Vector3(wall_thickness, wall_height, size_z + wall_thickness * 2.0))

static func _add_wall(container: Node3D, center: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "ContainmentWall"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	container.add_child(body)
	body.global_position = center

static func _collect(node: Node, acc: AABBAccum) -> void:
	if node is CollisionShape3D and node.shape and not node.disabled:
		var local_aabb: AABB
		var s: Shape3D = node.shape
		if s is BoxShape3D:
			local_aabb = AABB(-s.size / 2.0, s.size)
		elif s is ConcavePolygonShape3D:
			var faces: PackedVector3Array = s.get_faces()
			if faces.size() == 0:
				for c in node.get_children():
					_collect(c, acc)
				return
			var mn: Vector3 = faces[0]
			var mx: Vector3 = faces[0]
			for p in faces:
				mn = mn.min(p)
				mx = mx.max(p)
			local_aabb = AABB(mn, mx - mn)
		elif s is CapsuleShape3D or s is SphereShape3D or s is CylinderShape3D:
			# Not currently produced by this project's collision-gen paths,
			# but handled defensively rather than silently skipped.
			var r: float = s.radius
			var h: float = s.height if "height" in s else r * 2.0
			local_aabb = AABB(Vector3(-r, -h / 2.0, -r), Vector3(r * 2.0, h, r * 2.0))
		else:
			for c in node.get_children():
				_collect(c, acc)
			return
		var gt: Transform3D = node.global_transform
		var corners := [
			local_aabb.position,
			local_aabb.position + Vector3(local_aabb.size.x, 0, 0),
			local_aabb.position + Vector3(0, local_aabb.size.y, 0),
			local_aabb.position + Vector3(0, 0, local_aabb.size.z),
			local_aabb.position + local_aabb.size,
			local_aabb.position + Vector3(local_aabb.size.x, local_aabb.size.y, 0),
			local_aabb.position + Vector3(local_aabb.size.x, 0, local_aabb.size.z),
			local_aabb.position + Vector3(0, local_aabb.size.y, local_aabb.size.z),
		]
		for c in corners:
			var wc: Vector3 = gt * c
			acc.min_p = acc.min_p.min(wc)
			acc.max_p = acc.max_p.max(wc)
			acc.found = true
	for c in node.get_children():
		_collect(c, acc)
