shader_type spatial;
render_mode blend_mix, cull_back, unshaded;
// Textured with the designer's corrupted-water swatch; the ripple/fresnel
// glow still animates on top so the hazard reads as active rather than a
// static puddle prop.

uniform sampler2D water_texture : source_color;
uniform vec4 rim_color : source_color = vec4(0.75, 0.95, 0.25, 0.9);
uniform float ripple_speed = 1.2;
uniform float ripple_scale = 6.0;
uniform float base_alpha = 0.85;

void fragment() {
	vec2 uv = UV * ripple_scale;
	float wave = sin(uv.x + TIME * ripple_speed) * 0.5 + sin(uv.y * 1.3 - TIME * ripple_speed * 0.8) * 0.5;
	float ripple = smoothstep(0.2, 1.0, abs(wave));
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	vec2 scroll = vec2(TIME * 0.02, TIME * 0.015);
	vec4 tex = texture(water_texture, UV * 1.5 + scroll);
	vec3 color = mix(tex.rgb, rim_color.rgb, clamp(ripple * 0.4 + fresnel * 0.5, 0.0, 1.0));
	ALBEDO = color;
	ALPHA = clamp(base_alpha + fresnel * 0.3, 0.0, 1.0);
	EMISSION = rim_color.rgb * (fresnel * 0.6 + ripple * 0.15);
}
