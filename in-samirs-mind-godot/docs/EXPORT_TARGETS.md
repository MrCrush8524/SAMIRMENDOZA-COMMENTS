# EXPORT TARGET MATRIX

| Target | Runtime | Artifact | Renderer baseline | Offline |
|---|---|---|---|---|
| Windows PC | Native Godot | InSamirsMind.exe | Compatibility + desktop quality | Yes |
| Android | Native Godot | InSamirsMind.apk | Compatibility/mobile tuned | Yes |
| iPhone/iPad | Godot Web PWA | Hosted Web build | Compatibility Web | After first cache |

## Windows
Use official Godot Windows export templates, x86_64 release.

## Android
Use official Android export tooling for the chosen stable Godot version. Primary deliverable is APK. Keep an AAB preset for future store use.

## iOS Web
Use Godot Web export. Prefer single-threaded for Safari/iOS compatibility unless hardware testing proves another option is better. Wrap as a PWA over HTTPS.

If a native App Store iOS build is requested later, that becomes a separate macOS + Xcode + Apple signing track.
