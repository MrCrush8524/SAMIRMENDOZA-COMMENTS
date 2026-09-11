class_name HeroLayout
extends RefCounted
## Maps button_regions.json rectangles (in source-image pixel space) onto
## an actual Control at runtime, using the same "contain, centered" scale
## and offset the hero TextureRect itself uses — so a click zone always
## sits exactly under its baked button regardless of window size.
##
## scale = min(viewport/image) per axis; offset centers the scaled image.
## Per Menu_Chapter_Art/START_HERE_CLAUDE.md's own formula.

static func compute(container_size: Vector2, image_size: Vector2) -> Dictionary:
	var scale: float = min(container_size.x / image_size.x, container_size.y / image_size.y)
	var scaled_image := image_size * scale
	var offset: Vector2 = (container_size - scaled_image) * 0.5
	return {"scale": scale, "offset": offset}

## rect is [x, y, width, height] in source-image pixels.
static func map_rect(rect: Array, container_size: Vector2, image_size: Vector2) -> Rect2:
	var t := compute(container_size, image_size)
	var scale: float = t["scale"]
	var offset: Vector2 = t["offset"]
	return Rect2(
		offset.x + rect[0] * scale,
		offset.y + rect[1] * scale,
		rect[2] * scale,
		rect[3] * scale
	)
