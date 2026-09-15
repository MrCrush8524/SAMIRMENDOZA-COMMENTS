extends Node3D
## Chapter IV — three stacked open-air rooftop tiers with low parapets
## and long drops between them, climbing to the Final Observation Roof.
## This script drives the same escalating mutation-stage layer Chapter
## III's Room Checks use (see Chapter03.gd), keyed here off Chapter IV's
## 3 rooftop discoveries instead of room checks, plus a minimal fall-
## recovery system the open, wall-less roofline needs that earlier,
## fully-enclosed chapters never did.

@onready var world_environment: WorldEnvironment = $WorldEnvironment

## Below every roof tier's real floor, comfortably above nothing - a
## player who falls this far has gone off the edge of the world, not
## just dropped a level.
const FALL_Y_THRESHOLD := 0.0

const STAGE1_AMBIENT_ENERGY_MULT := 0.9
const STAGE2_AMBIENT_COLOR := Color(0.86, 0.82, 0.9)
const STAGE3_AMBIENT_COLOR := Color(0.74, 0.7, 0.82)
const STAGE3_AMBIENT_ENERGY_MULT := 0.65

var _base_ambient_color: Color
var _base_ambient_energy: float
var _applied_stage: int = -1

var _checkpoint_position: Vector3
var _player: CharacterBody3D = null

func _ready() -> void:
	add_to_group("chapter4_root")
	_base_ambient_color = world_environment.environment.ambient_light_color
	_base_ambient_energy = world_environment.environment.ambient_light_energy
	_apply_mutation_stage(GameState.chapter4_mutation_stage)
	_applied_stage = GameState.chapter4_mutation_stage

	var players := get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		_player = players[0]
	_checkpoint_position = $start.global_position

func _process(_delta: float) -> void:
	var stage := GameState.chapter4_discoveries.size()
	if stage != _applied_stage:
		GameState.chapter4_mutation_stage = stage
		_apply_mutation_stage(stage)
		_applied_stage = stage

	if _player and _player.global_position.y < FALL_Y_THRESHOLD:
		_recover_from_fall()

func set_checkpoint(position_3d: Vector3) -> void:
	_checkpoint_position = position_3d

func _recover_from_fall() -> void:
	_player.set_spawn(_checkpoint_position, _player.rotation.y)
	_player.velocity = Vector3.ZERO
	UiRoot.flash_toast("That way's a long drop. Back to the last solid ground.")

## Stage 0: stable, the rooftops as they first appear.
## Stage 1: the light dims slightly, like the sky's gone a shade duller.
## Stage 2: the ambient color itself cools, a change you feel more than see.
## Stage 3: the sky visibly wrongs itself - all 3 discoveries found.
func _apply_mutation_stage(stage: int) -> void:
	if stage >= 3:
		world_environment.environment.ambient_light_color = STAGE3_AMBIENT_COLOR
		world_environment.environment.ambient_light_energy = _base_ambient_energy * STAGE3_AMBIENT_ENERGY_MULT
	elif stage >= 2:
		world_environment.environment.ambient_light_color = STAGE2_AMBIENT_COLOR
		world_environment.environment.ambient_light_energy = _base_ambient_energy * STAGE1_AMBIENT_ENERGY_MULT
	elif stage >= 1:
		world_environment.environment.ambient_light_color = _base_ambient_color
		world_environment.environment.ambient_light_energy = _base_ambient_energy * STAGE1_AMBIENT_ENERGY_MULT
	else:
		world_environment.environment.ambient_light_color = _base_ambient_color
		world_environment.environment.ambient_light_energy = _base_ambient_energy
