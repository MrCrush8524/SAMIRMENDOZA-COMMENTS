extends Node3D
## Ambient, non-interactive "visitation" — a glimpse of a fellow dreamer,
## per packet 1's own notes: gentle bobbing, soft emissive edge, very slow
## presence rather than a giant statue. Texture is assigned at runtime by
## Chapter01.gd (shows the two dreamers NOT currently being played).

const BOB_HEIGHT := 0.12
const BOB_SPEED := 0.5
const BREATHE_MIN := 0.5
const BREATHE_MAX := 0.9
const BREATHE_SPEED := 0.35

@onready var icon: Sprite3D = $Icon
@onready var glow: OmniLight3D = $Glow

var _base_y: float
var _t := randf() * TAU

func _ready() -> void:
	_base_y = position.y

func _process(delta: float) -> void:
	_t += delta
	position.y = _base_y + sin(_t * BOB_SPEED) * BOB_HEIGHT
	var breathe := (sin(_t * BREATHE_SPEED) + 1.0) * 0.5
	var alpha: float = lerp(BREATHE_MIN, BREATHE_MAX, breathe)
	icon.modulate.a = alpha
	glow.light_energy = lerp(0.3, 0.7, breathe)

func set_texture(tex: Texture2D) -> void:
	icon.texture = tex
