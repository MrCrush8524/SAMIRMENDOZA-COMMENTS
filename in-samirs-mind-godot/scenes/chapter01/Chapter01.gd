extends Node3D
## Chapter I — Memory Laundromat + Small City (Master Build Brief
## section 6). Full replacement of the old "Memory Atrium" build: the
## brief's chapter map uses entirely different worlds under the same
## chapter ids, not an extension of the old content.
##
## The laundromat and the 4 tiled city blocks are raw imported GLBs with
## no authored collision, so it's generated once here at load time -
## same technique as NoClipPrisonEnvironment.gd uses for the backrooms_vr
## pool. No-clipping is OFF for the entire chapter (brief section 6/17.3
## - "No no-clip event may occur in Chapter 1").

const PosterSpawner := preload("res://scenes/shared/PosterSpawner.gd")
const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")

@export var environment_roots: Array[NodePath] = []

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = false
	for path in environment_roots:
		var node := get_node_or_null(path)
		if node:
			_generate_collision(node)
	WorldContainment.enclose(self, [self])
	PosterSpawner.attach(self, "../start", 25.0)

func _generate_collision(node: Node) -> void:
	if node is MeshInstance3D and node.mesh and not _is_door_mesh(node):
		node.create_trimesh_collision()
	for c in node.get_children():
		_generate_collision(c)

## The laundromat's two storefront doors ("LT Door Left"/"LT Door Right")
## are each modeled as two static meshes - a glass pane ("..._LT_glass_0")
## and a lower frame/kickplate panel ("..._LT_walls_0") - with no hinge,
## slide, or open animation anywhere in the asset or its scripts. Left
## with the blanket collision below, together they sealed the doorway
## solid from floor to header - confirmed via a headless raycast sweep
## straight through both doorways at every height from 0 to 2.5m: the
## glass blocked everything above ~0.6m, and this frame piece alone
## blocked ~0.05-0.55m (well above what a capsule's rounded bottom could
## climb over), leaving no passable band at all. Since there is no
## mechanism anywhere that ever opens this door, the only way for either
## storefront doorway to be a real exit is for its own meshes to carry no
## collision at all - scoped to nodes under a "Door" ancestor specifically,
## so real windows (e.g. "LT Wall 02"'s storefront window) and the
## washing machines' glass gates are untouched.
func _is_door_mesh(node: Node) -> bool:
	var p := node.get_parent()
	while p and p != self:
		if "door" in p.name.to_lower():
			return true
		p = p.get_parent()
	return false
