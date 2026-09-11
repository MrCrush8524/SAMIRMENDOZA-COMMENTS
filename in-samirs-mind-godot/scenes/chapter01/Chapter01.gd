extends Node3D
## Chapter I — Memory Atrium. Proxy geometry (boxes/planes carrying real
## wallpaper/poster textures), matching the vertical-slice acceptance
## checklist: 1 journal, 1 Memory Cat, 1 find, 1 Dream Track, 1 manual TV,
## 1 proximity TV, 1 Doubt glimpse, 1 door transition.

@onready var doubt: MeshInstance3D = $Doubt

const SPIRIT_TEXTURES := {
	"Bobby": preload("res://assets/spirits/bobby_spirit_wrapper.png"),
	"Luna": preload("res://assets/spirits/luna_spirit_wrapper.png"),
	"Mateo": preload("res://assets/spirits/mateo_spirit_wrapper.png"),
}

var _doubt_timer := 6.0 + randf() * 6.0

func _ready() -> void:
	for pickup in get_tree().get_nodes_in_group("pickups"):
		if pickup.kind == pickup.Kind.JOURNAL and GameState.journals.has(pickup.item_id.to_int()):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.MEMORY_CAT and GameState.memory_cats.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.ITEM and GameState.inventory.has(pickup.item_id):
			pickup.queue_free()
		elif pickup.kind == pickup.Kind.DREAM_TRACK and GameState.dream_tracks.has(pickup.item_id):
			pickup.queue_free()

	# Spirit sightings show the two dreamers NOT currently played — a
	# glimpse of your fellow dreamers, never yourself.
	var others: Array = SPIRIT_TEXTURES.keys().filter(func(d): return d != GameState.dreamer)
	others.shuffle()
	$SpiritSighting1.set_texture(SPIRIT_TEXTURES[others[0]])
	$SpiritSighting2.set_texture(SPIRIT_TEXTURES[others[1]])

func _process(delta: float) -> void:
	_doubt_timer -= delta
	if _doubt_timer <= 0:
		doubt.visible = not doubt.visible
		_doubt_timer = (1.5 + randf() * 1.5) if doubt.visible else (8.0 + randf() * 10.0)
