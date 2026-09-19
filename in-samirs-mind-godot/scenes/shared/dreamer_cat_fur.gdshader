shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

// Blends between a body fur texture and a "points" fur texture (ears/
// face/legs/tail) using a per-vertex mask baked into vertex color red
// by DreamerCatSkin.gd from the mesh's actual bone weights - not a
// flat tint, since Bobby (Siamese-style) needs two distinct fur colors
// on different parts of the same mesh. Mateo/Luna just get the same
// texture in both slots, which makes this a no-op blend for them.

uniform sampler2D body_texture : source_color;
uniform sampler2D points_texture : source_color;
uniform float roughness_value : hint_range(0.0, 1.0) = 0.9;

void fragment() {
	vec4 body_col = texture(body_texture, UV);
	vec4 points_col = texture(points_texture, UV);
	ALBEDO = mix(body_col.rgb, points_col.rgb, COLOR.r);
	ROUGHNESS = roughness_value;
}
