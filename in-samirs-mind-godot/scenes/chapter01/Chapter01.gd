extends Node3D
## Chapter I — Memory Atrium. Proxy geometry (boxes/planes carrying real
## wallpaper/poster textures), matching the vertical-slice acceptance
## checklist: 1 journal, 1 Memory Cat, 1 find, 1 Dream Track, 1 manual TV,
## 1 proximity TV, 1 Doubt glimpse, 1 door transition.

@onready var doubt: Sprite3D = $Doubt

const CAT_SPAWN_POOL := [
	"CatSpawn1", "CatSpawn2", "CatSpawn3", "CatSpawn4", "CatSpawn5", "CatSpawn6",
	"CatSpawn7", "CatSpawn8", "CatSpawn9", "CatSpawn10", "CatSpawn11", "CatSpawn12",
]
const JOURNAL_SPAWN_POOL := [
	"JournalSpawn1", "JournalSpawn2", "JournalSpawn3", "JournalSpawn4", "JournalSpawn5", "JournalSpawn6",
	"JournalSpawn7", "JournalSpawn8", "JournalSpawn9", "JournalSpawn10", "JournalSpawn11", "JournalSpawn12",
]
const CAT_NODE_NAMES := ["MemoryCat1", "MemoryCat2", "MemoryCat3"]
const JOURNAL_NODE_NAMES := ["Journal1", "Journal2", "Journal3"]

var _doubt_timer := 6.0 + randf() * 6.0

func _ready() -> void:
	# Environmental nudge before any checklist UI exists — only on a truly
	# fresh dream, never on a reload/continue where the player's already
	# found something.
	if GameState.journals.is_empty() and GameState.memory_cats.is_empty():
		UiRoot.flash_toast("This place feels familiar.", 2.4)

	_roll_and_apply_spawn_pool(CAT_SPAWN_POOL, CAT_NODE_NAMES, GameState.chapter01_cat_spawns)
	_roll_and_apply_spawn_pool(JOURNAL_SPAWN_POOL, JOURNAL_NODE_NAMES, GameState.chapter01_journal_spawns)

	for pickup in get_tree().get_nodes_in_group("pickups"):
		if pickup.kind == pickup.Kind.JOURNAL and GameState.journals.has(pickup.item_id.to_int()):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.MEMORY_CAT and GameState.memory_cats.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.ITEM and GameState.inventory.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.DREAM_TRACK and GameState.dream_tracks.has(pickup.item_id):
			pickup.queue_free()

## Picks 3 distinct spot names out of a 12-spot pool the first time this
## dream visits Chapter I, then moves the 3 corresponding pickup nodes to
## those spots. `chosen` is GameState.chapter01_cat_spawns or
## _journal_spawns — an Array is passed by reference in GDScript, so
## filling it here persists the choice into the save via GameState
## directly, without a separate setter.
func _roll_and_apply_spawn_pool(pool: Array, node_names: Array, chosen: Array) -> void:
	if chosen.is_empty():
		var shuffled: Array = pool.duplicate()
		shuffled.shuffle()
		for i in node_names.size():
			chosen.append(shuffled[i])
	for i in node_names.size():
		if i >= chosen.size():
			continue
		var pickup: Node3D = get_node_or_null(node_names[i])
		var spot: Node3D = get_node_or_null(chosen[i])
		if pickup and spot:
			pickup.global_position = spot.global_position

func _process(delta: float) -> void:
	_doubt_timer -= delta
	if _doubt_timer <= 0:
		doubt.visible = not doubt.visible
		_doubt_timer = (1.5 + randf() * 1.5) if doubt.visible else (8.0 + randf() * 10.0)
