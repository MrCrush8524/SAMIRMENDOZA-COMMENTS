extends NightmareMinigame
## "Whack-a-Mole" — ARCADE: moles pop up at random holes on a timer.
## Hit enough real moles to win; one hole is always a trap that ends the
## round instantly if hit, same as running out of time or round-outs.

const TARGET_HITS_BASE := 5

@export var base_round_time: float = 24.0
@export var base_pop_interval: float = 1.1

@onready var holes: Array[Area3D] = [$Hole0, $Hole1, $Hole2, $Hole3, $Hole4]

var _round_time: float = 0.0
var _pop_interval: float = 1.1
var _pop_timer: float = 0.0
var _target_hits: int = 5
var _hits: int = 0
var _active_hole: int = -1
var _trap_hole: int = 0
var _resolved_flag: bool = false

func configure(depth: int) -> void:
	_round_time = maxf(14.0, base_round_time - float(depth - 1) * 2.0)
	_pop_interval = maxf(0.5, base_pop_interval - float(depth - 1) * 0.08)
	_target_hits = TARGET_HITS_BASE
	_hits = 0
	_resolved_flag = false
	_pop_timer = 0.0
	_trap_hole = randi() % holes.size()
	_clear_all()
	UiRoot.set_prompt("Hit %d moles. Avoid the dark one." % _target_hits)

func cancel() -> void:
	set_process(false)
	UiRoot.set_prompt("")

func _process(delta: float) -> void:
	if _resolved_flag:
		return
	_round_time -= delta
	if _round_time <= 0.0:
		_finish(false)
		return
	_pop_timer -= delta
	if _pop_timer <= 0.0:
		_pop_timer = _pop_interval
		_pop_next()

func _clear_all() -> void:
	for hole in holes:
		hole.visible = false
	_active_hole = -1

func _pop_next() -> void:
	_clear_all()
	_active_hole = randi() % holes.size()
	var hole := holes[_active_hole]
	hole.visible = true
	var mesh: MeshInstance3D = hole.get_node("Mesh")
	mesh.get_surface_override_material(0).albedo_color = \
		Color(0.15, 0.1, 0.12) if _active_hole == _trap_hole else Color(0.6, 0.4, 0.25)

func _on_pad_selected(index: int) -> void:
	if _resolved_flag or index != _active_hole:
		return
	if index == _trap_hole:
		_finish(false)
		return
	_hits += 1
	_clear_all()
	if _hits >= _target_hits:
		_finish(true)

func _finish(won: bool) -> void:
	if _resolved_flag:
		return
	_resolved_flag = true
	UiRoot.set_prompt("")
	resolved.emit(won)
