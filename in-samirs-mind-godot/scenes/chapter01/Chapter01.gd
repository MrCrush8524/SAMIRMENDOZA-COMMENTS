extends Node3D
## Chapter I — Memory Atrium. Proxy geometry (boxes/planes carrying real
## wallpaper/poster textures). 3 Journal Fragments + 3 Memory Cats spawn
## at random hidden spots (re-rolled every visit) and gate the Moon Door;
## a Dream Charm and Dream Track pickup, a Doubt glimpse, and the door
## transitions round out the chapter.

@onready var doubt: Sprite3D = $Doubt

const CAT_SPAWN_POOL := [
	"CatSpawn1", "CatSpawn2", "CatSpawn3", "CatSpawn4", "CatSpawn5", "CatSpawn6",
	"CatSpawn7", "CatSpawn8", "CatSpawn9", "CatSpawn10", "CatSpawn11", "CatSpawn12",
	"CatSpawn13", "CatSpawn14", "CatSpawn15", "CatSpawn16", "CatSpawn17",
]
const JOURNAL_SPAWN_POOL := [
	"JournalSpawn1", "JournalSpawn2", "JournalSpawn3", "JournalSpawn4", "JournalSpawn5", "JournalSpawn6",
	"JournalSpawn7", "JournalSpawn8", "JournalSpawn9", "JournalSpawn10", "JournalSpawn11", "JournalSpawn12",
	"JournalSpawn13", "JournalSpawn14", "JournalSpawn15", "JournalSpawn16", "JournalSpawn17",
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

	_roll_and_apply_spawn_pool(CAT_SPAWN_POOL, CAT_NODE_NAMES)
	_roll_and_apply_spawn_pool(JOURNAL_SPAWN_POOL, JOURNAL_NODE_NAMES)

	for pickup in get_tree().get_nodes_in_group("pickups"):
		if pickup.kind == pickup.Kind.JOURNAL and GameState.journals.has(pickup.item_id.to_int()):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.MEMORY_CAT and GameState.memory_cats.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.ITEM and GameState.inventory.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.DREAM_TRACK and GameState.dream_tracks.has(pickup.item_id):
			pickup.queue_free()

## Re-rolls 3 distinct spot names out of the pool every single time this
## scene loads - not just the dream's first visit - so a player who
## already knows last time's Journal/Memory Cat spots can't just beeline
## them again on a replay. Chapter I is big enough now (side rooms off
## the original loop) that the pool has real hiding spots to draw from,
## not just the open main-hall floor.
func _roll_and_apply_spawn_pool(pool: Array, node_names: Array) -> void:
	var shuffled: Array = pool.duplicate()
	shuffled.shuffle()
	for i in node_names.size():
		var pickup: Node3D = get_node_or_null(node_names[i])
		var spot: Node3D = get_node_or_null(shuffled[i])
		if pickup and spot:
			pickup.global_position = spot.global_position

func _process(delta: float) -> void:
	_doubt_timer -= delta
	if _doubt_timer <= 0:
		doubt.visible = not doubt.visible
		_doubt_timer = (1.5 + randf() * 1.5) if doubt.visible else (8.0 + randf() * 10.0)
