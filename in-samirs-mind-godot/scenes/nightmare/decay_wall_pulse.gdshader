shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// Per START_HERE_CLAUDE.md's DECAY "composure tell": low-amplitude sine
// vertex displacement along the normal + slight UV drift, ramping up in
// the last 25% of composure so the player questions whether the wall
// actually moved rather than being shown an obvious effect.

uniform sampler2D albedo_texture : source_color;
uniform sampler2D normal_texture : hint_normal;
uniform sampler2D roughness_texture : hint_roughness_gray;
uniform float normal_strength : hint_range(0.0, 2.0) = 1.0;
uniform float uv1_scale = 4.0;

uniform float composure : hint_range(0.0, 1.0) = 1.0;
uniform float base_amplitude = 0.006; // meters, full composure
uniform float max_amplitude = 0.015;  // meters, composure near zero
uniform float pulse_speed = 0.55;     // Hz
uniform float uv_drift_amount = 0.0025;

const float TAU_LOCAL = 6.283185307179586;

void vertex() {
	vec2 tiled_uv = UV * uv1_scale;
	float danger = clamp(1.0 - composure, 0.0, 1.0);
	// Stays near-zero until composure drops under ~25%, then ramps hard.
	float danger_boost = smoothstep(0.75, 1.0, danger);
	float amplitude = mix(base_amplitude, max_amplitude, danger_boost) * mix(0.15, 1.0, danger);
	float phase = VERTEX.x * 0.6 + VERTEX.y * 0.3;
	float pulse = sin(TIME * pulse_speed * TAU_LOCAL + phase);
	VERTEX += NORMAL * pulse * amplitude;
	UV = tiled_uv;
}

void fragment() {
	float danger = clamp(1.0 - composure, 0.0, 1.0);
	float drift = sin(TIME * pulse_speed * TAU_LOCAL * 0.5) * uv_drift_amount * danger;
	vec2 uv = UV + vec2(drift, drift * 0.6);
	ALBEDO = texture(albedo_texture, uv).rgb;
	ROUGHNESS = texture(roughness_texture, uv).r;
	NORMAL_MAP = texture(normal_texture, uv).rgb;
	NORMAL_MAP_DEPTH = normal_strength;
}
