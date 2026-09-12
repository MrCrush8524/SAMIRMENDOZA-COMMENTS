extends Control
## The "create a profile" step: shown once, right before Character
## Select, the first time the player starts a New Dream. Typing a name
## here and hitting Confirm is the entire profile system — it's just a
## label saved into GameState.profile_name (see GameState.gd), no
## account, no validation beyond "not empty". Leaving it blank and
## confirming anyway falls back to "Dreamer" rather than blocking play.

const FALLBACK_NAME := "Dreamer"

@onready var name_edit: LineEdit = %NameEdit
@onready var prompt_label: Label = %PromptLabel
@onready var confirm_button: Button = %ConfirmButton

signal confirmed

func _ready() -> void:
	visible = false
	confirm_button.pressed.connect(_on_confirm)
	name_edit.text_submitted.connect(func(_t): _on_confirm())

func open() -> void:
	prompt_label.text = LocalizationManager.t("enter_name")
	name_edit.placeholder_text = LocalizationManager.t("name_placeholder")
	confirm_button.text = LocalizationManager.t("confirm")
	name_edit.text = GameState.profile_name
	visible = true
	name_edit.grab_focus()

func close() -> void:
	visible = false

func _on_confirm() -> void:
	var typed := name_edit.text.strip_edges()
	GameState.profile_name = typed if not typed.is_empty() else FALLBACK_NAME
	close()
	confirmed.emit()
