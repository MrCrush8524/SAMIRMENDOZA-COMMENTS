## Shared "pastel CRT / strange children's arcade" chrome for the 5
## Nightmare Arcade games (brief 3.3): a consistent cabinet background,
## title, and status line so each game only builds its own play-field
## rather than re-deriving the visual language from scratch.
##
## Referenced via `const ArcadeUi := preload(...)` rather than a
## `class_name` global - this project runs Godot headlessly from the
## command line for testing, and a newly added class_name isn't picked
## up until the editor has regenerated its global script class cache, so
## preload is the reliable option here.

const BG_COLOR := Color(0.14, 0.06, 0.2)          # deep dream-violet cabinet
const ACCENT_COLOR := Color(1.0, 0.45, 0.85)      # hot pastel magenta
const ACCENT_COLOR_2 := Color(0.4, 0.95, 1.0)      # cyan
const TEXT_COLOR := Color(0.98, 0.95, 1.0)

static func build_layer(title: String) -> CanvasLayer:
	var layer := CanvasLayer.new()
	layer.layer = 50

	var bg := ColorRect.new()
	bg.color = BG_COLOR
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(bg)

	var title_label := Label.new()
	title_label.name = "TitleLabel"
	title_label.text = title
	title_label.add_theme_color_override("font_color", ACCENT_COLOR_2)
	title_label.add_theme_font_size_override("font_size", 28)
	title_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.position.y = 24
	layer.add_child(title_label)

	var status_label := Label.new()
	status_label.name = "StatusLabel"
	status_label.add_theme_color_override("font_color", TEXT_COLOR)
	status_label.add_theme_font_size_override("font_size", 18)
	status_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.position.y = 64
	layer.add_child(status_label)

	return layer

static func status_label_of(layer: CanvasLayer) -> Label:
	return layer.get_node("StatusLabel")
