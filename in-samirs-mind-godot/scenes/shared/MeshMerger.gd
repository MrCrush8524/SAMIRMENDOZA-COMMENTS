## Master Build Brief 18.1: "Rec Room source levels can contain
## thousands of separate mesh instances... merge/batch compatible static
## geometry where safe while preserving the supplied level's visible
## shape." Groups every MeshInstance3D under a root by its effective
## material and merges each group into one ArrayMesh via SurfaceTool
## (a real geometry merge, not a visual trick - every original vertex/
## UV/normal survives, just batched), then generates trimesh collision
## on the merged results instead of one StaticBody3D per original tiny
## mesh. Collapses draw calls (and physics bodies) from thousands down
## to roughly the source scene's material count.
##
## Not a class_name - this project runs Godot headlessly from the
## command line for testing, and a newly added class_name isn't
## resolvable until the editor has regenerated its global script class
## cache (see NightmareArcadeUi.gd for the same reasoning). Call via
## `preload(".../MeshMerger.gd").merge_and_collide(root)`.

static func merge_and_collide(root: Node3D) -> void:
	var mesh_instances: Array = []
	_collect(root, mesh_instances)

	var groups := {} # Material (or the string "null") -> SurfaceTool
	for mi in mesh_instances:
		var mesh: Mesh = mi.mesh
		if mesh == null:
			continue
		for surf in mesh.get_surface_count():
			var mat: Material = mi.get_surface_override_material(surf)
			if mat == null:
				mat = mesh.surface_get_material(surf)
			var key = mat if mat else "null"
			if not groups.has(key):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				groups[key] = st
			groups[key].append_from(mesh, surf, mi.global_transform)

	for mi in mesh_instances:
		mi.queue_free()

	for key in groups:
		var st: SurfaceTool = groups[key]
		st.index()
		var merged: ArrayMesh = st.commit()
		var inst := MeshInstance3D.new()
		root.add_child(inst)
		# append_from() above baked each source mesh's FULL WORLD-SPACE
		# transform into the merged vertex data (via mi.global_transform).
		# inst is parented under root, so leaving inst at its default local
		# identity transform would apply root's own transform a SECOND
		# time on top of geometry that's already in world space. Most
		# chapter roots sit at identity anyway (harmless either way), but
		# Chapter 6's LevelFun/KittysHouse roots carry the imported glTF's
		# own -90deg Sketchfab Z-up->Y-up correction - merging without this
		# line applied that correction twice (net -180deg X), which is the
		# confirmed mechanical cause of the upside-down circus. Forcing
		# inst's global transform back to identity cancels root's
		# contribution regardless of what it is, for every caller.
		inst.global_transform = Transform3D.IDENTITY
		inst.mesh = merged
		if key is Material:
			inst.set_surface_override_material(0, key)
		inst.create_trimesh_collision()

static func _collect(node: Node, out: Array) -> void:
	if node is MeshInstance3D and node.mesh:
		out.append(node)
	for c in node.get_children():
		_collect(c, out)
