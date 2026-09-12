extends Node3D
## A real-time planar mirror. A SubViewport renders the world from a
## camera reflected across this node's local XY plane (facing -Z, same
## convention as every other flat "sign" prop in the game), and that
## render is displayed on a quad standing in the mirror's place.
##
## Sees layer 1 (the normal world) *and* layer 2 (Player.mirror_body) —
## the main first-person camera only sees layer 1, so the player's own
## body is invisible in normal play but shows up here, which is the
## whole trick behind "the character reflects."
##
## No oblique near-clip plane (Godot doesn't expose one on Camera3D by
## default) — geometry tucked directly behind the mirror can bleed into
## the reflection at grazing angles. Acceptable for a decorative dreamcore
## mirror; not meant to be a perfect portal.

const MIRROR_ONLY_LAYER := 2
const VIEWPORT_SIZE := Vector2i(512, 768)

@export var mirror_size: Vector2 = Vector2(1.4, 2.2)

@onready var sub_viewport: SubViewport = $SubViewport
@onready var mirror_camera: Camera3D = $SubViewport/MirrorCamera
@onready var quad: MeshInstance3D = $Quad

var _player: Node3D = null
var _player_camera: Camera3D = null

func _ready() -> void:
	sub_viewport.size = VIEWPORT_SIZE
	sub_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	mirror_camera.cull_mask = 1 | MIRROR_ONLY_LAYER
	var mesh: QuadMesh = quad.mesh
	mesh.size = mirror_size
	var mat := quad.get_surface_override_material(0)
	if mat == null:
		mat = StandardMaterial3D.new()
		quad.set_surface_override_material(0, mat)
	mat.albedo_texture = sub_viewport.get_texture()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED

	var p := get_tree().get_first_node_in_group("player")
	if p:
		_player = p
		_player_camera = p.camera

func _process(_delta: float) -> void:
	if _player_camera == null or not is_instance_valid(_player_camera):
		var p := get_tree().get_first_node_in_group("player")
		if p:
			_player = p
			_player_camera = p.camera
		else:
			return
	_update_reflection()

func _update_reflection() -> void:
	# Mirror plane: passes through this node's origin, normal = local +Z
	# (the quad faces +Z toward the room; see Quad's transform below).
	var plane_point := global_position
	var plane_normal := global_transform.basis.z.normalized()

	var cam_xf := _player_camera.global_transform
	var reflected_origin := _reflect_point(cam_xf.origin, plane_point, plane_normal)
	var reflected_forward := _reflect_vector(-cam_xf.basis.z, plane_normal)
	var reflected_up := _reflect_vector(cam_xf.basis.y, plane_normal)

	mirror_camera.global_transform = _basis_from(reflected_origin, reflected_forward, reflected_up)
	mirror_camera.fov = _player_camera.fov

func _basis_from(origin: Vector3, forward: Vector3, up: Vector3) -> Transform3D:
	var z := -forward.normalized()
	var x := up.cross(z).normalized()
	var y := z.cross(x).normalized()
	return Transform3D(Basis(x, y, z), origin)

func _reflect_point(point: Vector3, plane_point: Vector3, normal: Vector3) -> Vector3:
	var d := (point - plane_point).dot(normal)
	return point - 2.0 * d * normal

func _reflect_vector(vec: Vector3, normal: Vector3) -> Vector3:
	return vec - 2.0 * vec.dot(normal) * normal
