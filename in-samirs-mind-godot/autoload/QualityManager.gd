extends Node
## Platform quality profiles. Never solves mobile performance by dropping
## to a permanently jagged internal resolution — profiles trade off
## lights/shadows/LOD distance first, resolution scale last.

enum Profile { DESKTOP_HIGH, DESKTOP_LOW, ANDROID, IOS_WEB }

var current_profile: Profile = Profile.DESKTOP_HIGH

func detect_and_apply() -> void:
	match OS.get_name():
		"Android":
			apply(Profile.ANDROID)
		"Web":
			apply(Profile.IOS_WEB if _looks_like_ios() else Profile.DESKTOP_LOW)
		_:
			apply(Profile.DESKTOP_HIGH)

func apply(profile: Profile) -> void:
	current_profile = profile
	var scale := 1.0
	var shadow_distance := 40.0
	match profile:
		Profile.DESKTOP_HIGH:
			scale = 1.0
			shadow_distance = 40.0
		Profile.DESKTOP_LOW:
			scale = 0.9
			shadow_distance = 20.0
		Profile.ANDROID:
			scale = 0.85
			shadow_distance = 12.0
		Profile.IOS_WEB:
			scale = 0.85
			shadow_distance = 10.0
	get_viewport().scaling_3d_scale = scale
	RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_LOW)
	Engine.max_fps = 60 if profile == Profile.DESKTOP_HIGH else 30

func _looks_like_ios() -> bool:
	var ua := OS.get_environment("HTTP_USER_AGENT")
	return ua.findn("iPhone") != -1 or ua.findn("iPad") != -1
