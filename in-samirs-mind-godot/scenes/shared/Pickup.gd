extends Area3D
## Generic curated pickup: journal fragment, Memory Cat, ordinary find, or
## Dream Track. Kind-specific payload is set per-instance from Chapter01.gd.

enum Kind { JOURNAL, MEMORY_CAT, ITEM, DREAM_TRACK }

@export var kind: Kind = Kind.ITEM
@export var journal_text: String = ""
@export var item_id: String = "" ## also doubles as the Dream Track's id for Kind.DREAM_TRACK
@export var dream_track_name: String = ""
@export var dream_track_stream: AudioStream = null

signal picked_up(pickup: Area3D)

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
