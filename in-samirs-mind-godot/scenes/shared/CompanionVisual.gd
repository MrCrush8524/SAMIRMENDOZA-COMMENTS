extends Node3D
## Generic per-species visual adapter for a companion (Character Asset
## Integration brief, sections 17/18/34). Wraps whatever mesh/skeleton/clips
## a given animal's source actually has behind a small set of semantic
## states (idle/walk/run/sit/turn/...) so CompanionFollower.gd never needs
## to know a real clip name, a bone count, or which species it's driving.
##
## Data-driven rather than one script per animal: Bobby/Mateo/Luna each get
## their own instance of this same script with a different animation_map,
## since the only real per-species difference here is "which clip name
## means walk," not the logic itself. Per the brief's Section 17: never
## destructively rename an imported clip just for code convenience - this
## maps TO the source's real names (including typos like Luna's "iddle")
## instead of requiring them to be renamed.
##
## A state with no mapped clip (or no fallback either) is a silent no-op,
## not an error - Mateo currently has zero animations at all, and that
## must never crash the companion controller, only leave it static.

## semantic state name -> this character's actual AnimationPlayer clip name.
@export var animation_map: Dictionary = {}
## semantic state -> another semantic state to substitute when the first
## has no mapped/available clip (e.g. "run" -> "walk" if there's no
## distinct run cycle).
@export var state_fallback: Dictionary = {}
## Which states are distance-scrubbed (paused, then seeked by ground
## distance covered) rather than played at a flat rate - same technique
## already used for the temporary lowpoly cat and for Nathan's walk cycle.
@export var scrub_states: Array[String] = ["walk", "run"]
@export var scrub_cycles_per_meter: float = 0.6
## Where a future CompanionView camera should sit for this species - see
## brief Section 20. Each animal needs its own (a lioness-proportioned
## Bobby and a small Luna do not share an eye height), so this is left as
## a plain child Marker3D in each wrapper scene rather than a shared
## constant; ViewAnchor.gd just reports its own global_transform on
## request when Companion View is actually implemented.
const VIEW_ANCHOR_NAME := "ViewAnchor"

var _anim_player: AnimationPlayer
var _current_state: String = ""
var _distance_accum: float = 0.0

func _ready() -> void:
	_anim_player = find_child("AnimationPlayer", true, false)

## Idempotent - calling with the same state twice does nothing the second
## time, so CompanionFollower can call this every frame without re-
## triggering play().
func request_state(state: String) -> void:
	if state == _current_state:
		return
	var clip := _resolve_clip(state)
	if clip.is_empty():
		return
	_current_state = state
	if not _anim_player or not _anim_player.has_animation(clip):
		return
	var is_scrubbed: bool = state in scrub_states
	_anim_player.get_animation(clip).loop_mode = Animation.LOOP_LINEAR if is_scrubbed else Animation.LOOP_NONE
	_anim_player.play(clip)
	if is_scrubbed:
		_anim_player.pause()
		_distance_accum = 0.0

## Call every physics frame with distance moved since the last call, while
## the current state is one of scrub_states - mirrors the technique
## already used for the cat's own run cycle and for Nathan's walk cycle.
func scrub_by_distance(moved: float) -> void:
	if not (_current_state in scrub_states):
		return
	var clip := _resolve_clip(_current_state)
	if clip.is_empty() or not _anim_player or not _anim_player.has_animation(clip):
		return
	var anim: Animation = _anim_player.get_animation(clip)
	if anim.length <= 0.0:
		return
	_distance_accum += moved * scrub_cycles_per_meter * anim.length
	_anim_player.seek(fmod(_distance_accum, anim.length), true)

## Lets the companion controller check before requesting - e.g. don't
## bother distance-scrubbing "run" if this species has no run clip and
## no fallback resolves to anything either.
func has_state(state: String) -> bool:
	return not _resolve_clip(state).is_empty()

func get_view_anchor() -> Node3D:
	return find_child(VIEW_ANCHOR_NAME, true, false)

func _resolve_clip(state: String, depth: int = 0) -> String:
	if depth > 4: # guards against a cyclic fallback map
		return ""
	if animation_map.has(state):
		var clip: String = animation_map[state]
		if _anim_player and _anim_player.has_animation(clip):
			return clip
		elif not _anim_player:
			return clip # not ready yet (called before _ready) - trust the map
	if state_fallback.has(state):
		return _resolve_clip(state_fallback[state], depth + 1)
	return ""
