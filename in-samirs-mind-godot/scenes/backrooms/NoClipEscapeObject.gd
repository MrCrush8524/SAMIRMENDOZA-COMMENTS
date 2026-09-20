extends Area3D
## Master Build Brief 4.2: the one escape object placed per No-Clip
## Prison visit. Walking into it (no interact-key gate - Larry is
## actively hunting, so a same-instant pickup fits the stakes better
## than a prompt-then-press beat) ends the prison trip successfully.

signal escaped

func _ready() -> void:
	body_entered.connect(func(b):
		if b.is_in_group("player"):
			escaped.emit()
	)
