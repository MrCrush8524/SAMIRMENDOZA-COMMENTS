extends Node3D
## PROPOSED EXIT — REQUIRES VISUAL APPROVAL.
##
## Purely a development aid: makes a provisional SimpleChapterExit trigger
## easy for Samir to spot and evaluate in-place during a playtest, without
## being mistaken for real level dressing. Not production art - a
## translucent, faintly pulsing marker plus a floating debug label
## ("chapterNN -> chapterMM"), both unlit and unaffected by the chapter's
## own lighting/materials so they never blend in with real geometry.
##
## Deleting this node (and the ext_resource/sub_resources it pulls in)
## from a chapter's .tscn is the entire "remove it once approved"
## procedure - it carries no collision, no gameplay logic, and nothing
## else in the project references it.

@export var label_text: String = ""

func _ready() -> void:
	var mesh_inst := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(1.4, 2.2, 1.4)
	mesh_inst.mesh = box
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.2, 1.0, 0.4, 0.35)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh_inst.material_override = mat
	add_child(mesh_inst)

	var label := Label3D.new()
	label.text = "PROPOSED EXIT\n%s" % label_text
	label.position = Vector3(0, 1.6, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = Color(0.2, 1.0, 0.4, 1.0)
	label.outline_size = 8
	label.font_size = 32
	add_child(label)

	var light := OmniLight3D.new()
	light.light_color = Color(0.2, 1.0, 0.4)
	light.light_energy = 1.2
	light.omni_range = 4.0
	add_child(light)
