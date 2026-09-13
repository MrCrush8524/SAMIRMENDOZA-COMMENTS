extends Node3D
## Chapter III — The House That Knows You. The interior geometry (Ground
## Floor / Second Floor / Attic) is already real partitioned rooms; this
## script drives the escalating-wrongness layer on top of it. Each Room
## Check (written into GameState by a RoomCheckTrigger) advances the
## house's mutation stage by one, and each stage is a small, deliberate,
## additive change — never everything mutating at once.

@onready var duplicate_console: Sprite3D = $GroundFloor/Flavor_Foyer/Prop_FoyerConsole_Duplicate
@onready var extra_corridor: MeshInstance3D = $Attic/ZoneDuplicateCorridorExtra
@onready var world_environment: WorldEnvironment = $WorldEnvironment

const STAGE2_AMBIENT_COLOR := Color(0.78, 0.78, 0.86)
const STAGE2_AMBIENT_ENERGY := 0.75

var _base_ambient_color: Color
var _base_ambient_energy: float
var _applied_stage: int = -1

func _ready() -> void:
	_base_ambient_color = world_environment.environment.ambient_light_color
	_base_ambient_energy = world_environment.environment.ambient_light_energy
	if GameState.chapter3_mutation_stage == 0:
		UiRoot.flash_toast("Okay. This is a house.", 2.4)
	_apply_mutation_stage(GameState.chapter3_mutation_stage)
	_applied_stage = GameState.chapter3_mutation_stage

func _process(_delta: float) -> void:
	var stage := GameState.chapter3_room_checks.size()
	if stage != _applied_stage:
		GameState.chapter3_mutation_stage = stage
		_apply_mutation_stage(stage)
		_applied_stage = stage

## Stage 0: stable, nothing below fires.
## Stage 1: a duplicated object appears — the console by the door, twice.
## Stage 2: the light itself goes a shade colder, like the sun moved.
## Stage 3: the attic corridor plainly keeps going where it shouldn't.
func _apply_mutation_stage(stage: int) -> void:
	duplicate_console.visible = stage >= 1
	extra_corridor.visible = stage >= 3
	if stage >= 2:
		world_environment.environment.ambient_light_color = STAGE2_AMBIENT_COLOR
		world_environment.environment.ambient_light_energy = STAGE2_AMBIENT_ENERGY
	else:
		world_environment.environment.ambient_light_color = _base_ambient_color
		world_environment.environment.ambient_light_energy = _base_ambient_energy
