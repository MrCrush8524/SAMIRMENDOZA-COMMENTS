extends MeshInstance3D
## Tints one surface of this mesh's material by flat color, for a clothing
## item whose source has no albedo texture at all (confirmed for Samir's
## boxers: the CC4 export ships Displacement/Glow/ORM maps for it but no
## diffuse/base-color map, so a plain color is the correct fix here, not a
## missing-texture bug). Non-destructive: never touches the source mesh,
## only sets a per-instance surface override material.

@export var tint: Color = Color(0.25, 0.28, 0.35, 1.0)
@export var surface_index: int = 0

func _ready() -> void:
	apply_tint(tint)

func apply_tint(color: Color) -> void:
	tint = color
	var base: Material = get_surface_override_material(surface_index)
	if base == null:
		base = mesh.surface_get_material(surface_index)
	var mat := StandardMaterial3D.new()
	if base is BaseMaterial3D:
		mat.albedo_texture = base.albedo_texture
		mat.roughness = base.roughness
	mat.albedo_color = tint
	set_surface_override_material(surface_index, mat)
