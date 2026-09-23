extends Node3D
## Chapter VII — Sprawling Mega City (Master Build Brief section 12).
## New chapter, built by reusing the existing Downtown Megakit city
## block (scenes/downtown/DowntownCity.tscn's own layout - the brief
## explicitly wants a repository-first reuse of working systems, not a
## from-scratch rebuild of a kit that's already assembled) with Sci-Fi
## Kit pieces scattered throughout and Quaternius furniture placed as
## individually-scattered collectibles, 7 of which satisfy the chapter.

const PosterSpawner := preload("res://scenes/shared/PosterSpawner.gd")
const WorldContainment := preload("res://scenes/shared/WorldContainment.gd")
const REQUIRED_FURNITURE := 7

func _ready() -> void:
	GameState.no_clip_enabled_for_chapter = true
	GameState.chapter_required_counts["chapter07"] = REQUIRED_FURNITURE
	# This chapter reuses DowntownCity.tscn's own baked-in collision rather
	# than generating any of its own (see class doc), so there's real
	# geometry to measure by the time this runs.
	WorldContainment.enclose(self, [self])
	PosterSpawner.attach(self, "../start", 25.0)
