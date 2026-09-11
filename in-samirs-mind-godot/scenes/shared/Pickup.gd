extends Area3D
## Generic curated pickup: journal fragment, Memory Cat, ordinary find, or
## Dream Track. Kind-specific payload is set per-instance from Chapter01.gd.
##
## Presentation follows the interactables packet's own notes: backgroundless
## sprite icon, slight float, gentle idle spin, soft glow that strengthens
## on player proximity — not a flat colored placeholder.

enum Kind { JOURNAL, MEMORY_CAT, ITEM, DREAM_TRACK }

const BOB_HEIGHT := 0.06
const BOB_SPEED := 1.6
const SPIN_SPEED := 0.6
const GLOW_IDLE_ENERGY := 0.35
const GLOW_NEAR_ENERGY := 1.1
const PROXIMITY_RANGE := 2.2

@export var kind: Kind = Kind.ITEM
@export var journal_text: String = ""
@export var item_id: String = "" ## also doubles as the Dream Track's id for Kind.DREAM_TRACK
@export var dream_track_name: String = ""
@export var dream_track_stream: AudioStream = null

@onready var icon: Sprite3D = $Icon
@onready var glow: OmniLight3D = $Glow

var _base_y: float
var _t := randf() * TAU
var _player: Node3D = null

signal picked_up(pickup: Area3D)

func _ready() -> void:
	_base_y = position.y
	var players := get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		_player = players[0]

func _process(delta: float) -> void:
	_t += delta
	position.y = _base_y + sin(_t * BOB_SPEED) * BOB_HEIGHT
	icon.rotation.z += SPIN_SPEED * delta

	var near := false
	if _player:
		near = global_position.distance_to(_player.global_position) < PROXIMITY_RANGE
	var target_energy := GLOW_NEAR_ENERGY if near else GLOW_IDLE_ENERGY
	glow.light_energy = lerp(glow.light_energy, target_energy, delta * 4.0)

func interact() -> void:
	match kind:
		Kind.JOURNAL:
			GameState.journals.append(item_id.to_int())
			UiRoot.show_journal(journal_text)
		Kind.MEMORY_CAT:
			GameState.memory_cats.append(item_id)
			UiRoot.show_journal("A memory cat, curled where the light pools. You remember it now.")
		Kind.ITEM:
			GameState.inventory.append(item_id)
		Kind.DREAM_TRACK:
			UiRoot.show_dream_track_popup(dream_track_name, dream_track_stream, self)
			# Track pickup is confirmed by the popup's own buttons, not here.
			return
	picked_up.emit(self)
	SaveManager.save_game()
	queue_free()

func confirm_dream_track_taken() -> void:
	GameState.dream_tracks.append(item_id)
	picked_up.emit(self)
	SaveManager.save_game()
	queue_free()
