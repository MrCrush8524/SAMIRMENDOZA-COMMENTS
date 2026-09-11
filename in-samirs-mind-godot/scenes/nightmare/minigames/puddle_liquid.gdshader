shader_type spatial;
render_mode blend_mix, cull_back, unshaded;
// Procedural — no texture dependency, so "Don't Touch The Water" can
// ship before the designer's corrupted-water swatch arrives (see
// NIGHTMARE_MINIGAME_GRAPHICS_AUDIT.md). Swap to a textured version
// once that art lands; the hazard logic doesn't change either way.

uniform vec4 base_color : source_color = vec4(0.35, 0.55, 0.15, 0.55);
uniform vec4 rim_color : source_color = vec4(0.75, 0.95, 0.25, 0.9);
uniform float ripple_speed = 1.2;
uniform float ripple_scale = 6.0;

void fragment() {
	vec2 uv = UV * ripple_scale;
	float wave = sin(uv.x + TIME * ripple_speed) * 0.5 + sin(uv.y * 1.3 - TIME * ripple_speed * 0.8) * 0.5;
	float ripple = smoothstep(0.2, 1.0, abs(wave));
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	vec3 color = mix(base_color.rgb, rim_color.rgb, clamp(ripple * 0.5 + fresnel * 0.5, 0.0, 1.0));
	ALBEDO = color;
	ALPHA = clamp(base_color.a + fresnel * 0.3, 0.0, 1.0);
	EMISSION = rim_color.rgb * (fresnel * 0.6 + ripple * 0.15);
}
