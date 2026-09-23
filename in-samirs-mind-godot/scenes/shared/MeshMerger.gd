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
		# time on top of geometry that's already in world space. Forcing
		# inst's global transform back to identity cancels root's own
		# contribution regardless of what it is, for every caller.
		#
		# An earlier version of this comment claimed a double application
		# of Chapter 6's -90deg Sketchfab Z-up->Y-up root correction was
		# "the confirmed mechanical cause" of Samir's reported upside-down
		# circus. That was re-measured directly (composing the actual
		# ancestor transform chain down to a mesh instance) and disproven -
		# the composition was already correct, not doubled. Don't resurrect
		# that theory. This line still belongs here on its own merits
		# (it's still correct to cancel root's contribution), it just isn't
		# what caused the reported symptom.
		inst.global_transform = Transform3D.IDENTITY
		inst.mesh = merged
		# A DIFFERENT, independently-measured defect (not a transform issue
		# at all): sampling the actual triangle winding of Level Fun's and
		# Kitty's House's own largest floor slabs (recomputing each face's
		# normal from its real world-space vertex positions, the same
		# vertices this merge just baked) found their winding faces DOWN
		# at the exact Y heights Chapter06.gd's own collision-based floor
		# scan already confirmed are the walkable floors - e.g. one 3610m2
		# slab at y=17.245 (Level Fun's main floor) and a 133.96m2 slab at
		# the same y=17.24 (Kitty's House's floor), both normal=(0,-1,0).
		# Every material sampled here (StandardMaterial3D, cull_mode=0/
		# CULL_BACK, Godot's default) would render that face invisibly
		# from directly above - exactly where a standing player looks down
		# from - while rendering fine from underneath. No negative
		# determinant exists anywhere in either mesh's ancestor transform
		# chain (checked directly), so this isn't a mirrored transform
		# either - it's the source Rec Room shape-container export's own
		# triangle winding on these particular boxes. Disabling backface
		# culling on the merged result is a safe, nondestructive way to
		# guarantee these surfaces render from both sides regardless of
		# whichever way any given source shape happened to be wound, without
		# needing to detect/fix winding per shape across a ~10000-mesh
		# export. This does NOT modify the source .glb.
		if key is BaseMaterial3D:
			# Duplicate rather than mutate key directly - key is the SHARED
			# material resource read straight off the source meshes (many of
			# which may still be referenced elsewhere, e.g. the same
			# imported material used by another chapter's own instance of
			# this .glb), so flipping cull_mode on it in place would leak
			# into everything else that shares it.
			var override_mat: BaseMaterial3D = (key as BaseMaterial3D).duplicate()
			override_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			inst.set_surface_override_material(0, override_mat)
		elif key is Material:
			inst.set_surface_override_material(0, key)
		inst.create_trimesh_collision()

static func _collect(node: Node, out: Array) -> void:
	if node is MeshInstance3D and node.mesh:
		out.append(node)
	for c in node.get_children():
		_collect(c, out)
