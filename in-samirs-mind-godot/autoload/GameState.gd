extends Node
## Holds the current run's in-memory state. SaveManager reads/writes this
## to disk; gameplay scenes mutate it directly rather than each other.

const SAVE_VERSION := 1

var dreamer: String = ""          # "Bobby" | "Luna" | "Mateo"

## The player's own entered name — the "create a profile" step: typing a
## name in before choosing a dreamer is what turns a save into *their*
## save. Purely a label (shown on the Chapter Select / Continue screen);
## it has no gameplay effect and is never validated beyond non-empty.
var profile_name: String = ""

var chapter: String = "chapter01"
var spawn_id: String = "start"
var journals: Array[int] = []
var memory_cats: Array[String] = []

## Chapter III — House That Knows You. Which of the 3 Room Checks
## ("window_height", "exterior_distance", "impossible_room") have fired
## this dream, and the escalating mutation stage that count drives
## (0-3). Both must restore correctly on Continue rather than resetting
## the house to Stage 0 after the player has already progressed it.
var chapter3_room_checks: Array[String] = []
var chapter3_mutation_stage: int = 0
var chapter3_back_exit_unlocked: bool = false

## Chapter IV — Above the Street. 3 required rooftop discoveries drive
## an escalating mutation stage (0-4), same shape as Chapter III's Room
## Checks. chapter4_exit_unlocked gates the Final Observation Roof's
## own exit once all 3 are found.
var chapter4_discoveries: Array[String] = []
var chapter4_mutation_stage: int = 0
var chapter4_exit_unlocked: bool = false

var inventory: Array[String] = []
var dream_tracks: Array[String] = []
var has_active_run: bool = false

## 0..1. Drained only inside a Decay Nightmare Passage; collapse at 0
## bounces the player back out (see GameRoot.collapse_from_nightmare),
## never a death screen. Resets to full on collapse and on new_run.
var composure: float = 1.0

## door_id -> "decay" | "wander" | "arcade". Assigned once per door the
## first time it's seen (NightmareDoor._ready), then persisted so a
## given save keeps the same assignments instead of re-rolling them
## every time the chapter reloads.
var nightmare_assignments: Dictionary = {}

## Transient: true while a Nightmare Passage scene is loaded in place of
## the real chapter. Not persisted — a save can't happen mid-nightmare.
var in_nightmare: bool = false

## Transient: the player's current depth in the active Nightmare
## Passage's minigame ladder (Nightmare_Passage_Minigame_Specs.md's
## `nightmare_depth`). 0 outside a nightmare; set to 1 on entry. This is
## deliberately separate from GameState.chapter — losing a minigame only
## ever moves this number, never the player's real story progress.
var nightmare_depth: int = 0

## Reward ids granted by clearing minigame ladder depths, persisted so a
## deep-clear reward isn't re-grantable by re-running the same ladder.
var nightmare_rewards: Array[String] = []

## The Lost Passage ("Backrooms") — a random no-clip event, deliberately
## NOT a Nightmare Passage: liminal/eerie rather than dreamcore, entered
## by chance while walking a normal chapter rather than through a door,
## and tracked with its own state below instead of reusing in_nightmare/
## nightmare_depth. All transient — a save can't happen while lost.
var in_backrooms: bool = false

## Spatial depth reached this trip (1 = entry area). Falling into a pit
## resets this to 1 no matter how deep the player had gotten — it does
## NOT return them to the real chapter, just punishes exploration
## progress within the Backrooms itself.
var backrooms_level: int = 1

## Exactly one of the 10 artifact ids and one of the door ids is the
## "real" way out each trip — rolled fresh on entry, shown to the player
## as a clue, everything else is a decoy. See BACKROOMS_ARTIFACT_IDS /
## BACKROOMS_DOOR_IDS in BackroomsManager.gd for the actual id lists.
var backrooms_artifact_target: String = ""
var backrooms_door_target: String = ""

func new_backrooms_trip() -> void:
	in_backrooms = true
	backrooms_level = 1

## Doubt Catch (from Chapter II onward, per design note): if Doubt
## touches the player, it drops them into a quick minigame — win and
## you get a Dream Token (unlocks something later, TBD); lose and you
## respawn nearby, no token. Deliberately separate from
## nightmare_rewards — a different trigger (open-world catch, not a
## Nightmare Passage door) with its own currency.
var dream_tokens: int = 0

## Chapter II's (The Infinite Neighborhood) "required discoveries" gate:
## visiting each of the neighborhood's named zones records an id here.
## Once enough are found, a previously-inactive house wakes up and
## becomes the real entrance into Chapter III — same asleep-then-lit
## pattern as the Moon Door, but the "door" is an ordinary house that
## was locked the whole time, not a new teleport.
var neighborhood_discoveries: Array[String] = []

## Every main-story chapter id ("chapter01".."chapter06") the player has
## ever actually entered, in the order first reached. Powers the Chapter
## Select screen (Title's Continue flow: resume exactly where you left
## off, or jump back into any chapter you've already been to). Side
## levels (mall/zoo/terminal/museum/liminal_junction) deliberately don't
## belong here — those are door-accessible detours, not story progress.
var visited_chapters: Array[String] = []

## The player's exact last-safe transform, captured by SaveManager at save
## time (see `current_player`). Null until a save has actually happened
## with a player present, so a fresh/legacy save falls back to spawn_id's
## Marker3D instead of an all-zero position.
var last_position: Vector3 = Vector3.ZERO
var last_yaw: float = 0.0
var has_last_position: bool = false

## Transient, not persisted: the live Player node registers itself here
## on _ready() so SaveManager can read its transform without every save
## call site needing a reference to it.
var current_player: Node3D = null

func new_run(chosen_dreamer: String) -> void:
	dreamer = chosen_dreamer
	chapter = "chapter01"
	spawn_id = "start"
	journals.clear()
	memory_cats.clear()
	inventory.clear()
	dream_tracks.clear()
	has_active_run = true
	has_last_position = false
	composure = 1.0
	nightmare_assignments.clear()
	in_nightmare = false
	nightmare_depth = 0
	nightmare_rewards.clear()
	in_backrooms = false
	backrooms_level = 1
	backrooms_artifact_target = ""
	backrooms_door_target = ""
	dream_tokens = 0
	neighborhood_discoveries.clear()
	visited_chapters.clear()
	visited_chapters.append("chapter01")
	chapter3_room_checks.clear()
	chapter3_mutation_stage = 0
	chapter3_back_exit_unlocked = false
	chapter4_discoveries.clear()
	chapter4_mutation_stage = 0
	chapter4_exit_unlocked = false

func to_dict() -> Dictionary:
	var data := {
		"version": SAVE_VERSION,
		"dreamer": dreamer,
		"chapter": chapter,
		"spawn_id": spawn_id,
		"journals": journals,
		"memory_cats": memory_cats,
		"inventory": inventory,
		"dream_tracks": dream_tracks,
		"composure": composure,
		"nightmare_assignments": nightmare_assignments,
		"nightmare_rewards": nightmare_rewards,
		"dream_tokens": dream_tokens,
		"neighborhood_discoveries": neighborhood_discoveries,
		"visited_chapters": visited_chapters,
		"profile_name": profile_name,
		"chapter3_room_checks": chapter3_room_checks,
		"chapter3_mutation_stage": chapter3_mutation_stage,
		"chapter3_back_exit_unlocked": chapter3_back_exit_unlocked,
		"chapter4_discoveries": chapter4_discoveries,
		"chapter4_mutation_stage": chapter4_mutation_stage,
		"chapter4_exit_unlocked": chapter4_exit_unlocked,
	}
	if has_last_position:
		data["last_position"] = {"x": last_position.x, "y": last_position.y, "z": last_position.z}
		data["last_yaw"] = last_yaw
	return data

func from_dict(data: Dictionary) -> bool:
	if int(data.get("version", -1)) != SAVE_VERSION:
		return false
	if not data.has("dreamer") or String(data["dreamer"]).is_empty():
		return false
	dreamer = data["dreamer"]
	chapter = data.get("chapter", "chapter01")
	spawn_id = data.get("spawn_id", "start")
	journals.assign(data.get("journals", []))
	memory_cats.assign(data.get("memory_cats", []))
	inventory.assign(data.get("inventory", []))
	dream_tracks.assign(data.get("dream_tracks", []))
	has_active_run = true
	composure = clampf(float(data.get("composure", 1.0)), 0.0, 1.0)
	nightmare_assignments = data.get("nightmare_assignments", {}).duplicate()
	nightmare_rewards.assign(data.get("nightmare_rewards", []))
	dream_tokens = int(data.get("dream_tokens", 0))
	neighborhood_discoveries.assign(data.get("neighborhood_discoveries", []))
	visited_chapters.assign(data.get("visited_chapters", [chapter]))
	if not visited_chapters.has(chapter):
		visited_chapters.append(chapter)
	profile_name = String(data.get("profile_name", ""))
	chapter3_room_checks.assign(data.get("chapter3_room_checks", []))
	chapter3_mutation_stage = int(data.get("chapter3_mutation_stage", 0))
	chapter3_back_exit_unlocked = bool(data.get("chapter3_back_exit_unlocked", false))
	chapter4_discoveries.assign(data.get("chapter4_discoveries", []))
	chapter4_mutation_stage = int(data.get("chapter4_mutation_stage", 0))
	chapter4_exit_unlocked = bool(data.get("chapter4_exit_unlocked", false))
	in_nightmare = false
	nightmare_depth = 0

	# Backrooms state is all transient by design (a save can't happen
	# while lost in there), but reset it explicitly on load anyway —
	# same defensive reasoning as in_nightmare above, in case a save is
	# ever loaded without a full process restart in between.
	in_backrooms = false
	backrooms_level = 1
	backrooms_artifact_target = ""
	backrooms_door_target = ""

	has_last_position = false
	var pos_data = data.get("last_position", null)
	if typeof(pos_data) == TYPE_DICTIONARY and pos_data.has("x") and pos_data.has("y") and pos_data.has("z"):
		var p := Vector3(pos_data["x"], pos_data["y"], pos_data["z"])
		# Never trust a position that would drop the player below/through
		# the floor or above the ceiling — a corrupted or hand-edited save
		# falls back to the chapter's named spawn instead.
		if is_finite(p.x) and is_finite(p.y) and is_finite(p.z) and p.y > -1.0 and p.y < 4.0:
			last_position = p
			last_yaw = float(data.get("last_yaw", 0.0))
			has_last_position = true
	return true
