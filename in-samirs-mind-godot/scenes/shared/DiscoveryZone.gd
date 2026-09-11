extends Area3D
## Like FlavorZone, but also records a discovery id the first time the
## player steps into the zone. Used by The Infinite Neighborhood: visiting
## each named zone counts toward the required discoveries that wake the
## house leading into Chapter III (see NeighborhoodHouseDoor.gd).

@export var flavor_text: String = ""
@export var discovery_id: String = ""

func _ready() -> void:
	body_entered.connect(_on_entered)
	body_exited.connect(_on_exited)

func _on_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		UiRoot.set_prompt(flavor_text)
		if not discovery_id.is_empty() and not GameState.neighborhood_discoveries.has(discovery_id):
			GameState.neighborhood_discoveries.append(discovery_id)

func _on_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		UiRoot.set_prompt("")
