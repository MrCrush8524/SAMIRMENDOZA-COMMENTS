# SMR — Stories Made Real (Android V1)

Native Android Studio project (Kotlin + Jetpack Compose) targeted at the Samsung
Galaxy A71 5G (SM-A716U) running Android 13, `minSdk 26` / `compileSdk 34`.

## Design locked from the supplied mockups

- dark midnight base (`#0D1326`)
- pastel lavender (`#AAA0D8`) / teal (`#76A9A4`)
- warm cream text (`#F4F4E8`)
- soft dim cobalt bloom radiating from behind the book cover
- clean Now Playing page
- hamburger side drawer
- advanced controls kept off the main player

See `ui/theme/Color.kt` for the palette and `ui/components/CoverGlow.kt` for the
cobalt bloom effect.

## Implemented in this V1 source

- Jetpack Compose Android UI (Material 3, single locked dark theme)
- Now Playing screen with cover glow, ±15s, speed, sleep timer, mode chips
- Hamburger drawer navigation (Now Playing / Library / Voices / Settings)
- Library screen with plain-text manuscript import
- Read / Retell / Summary / Podcast modes
- Local narration through **Android's own system Text-to-Speech engine** (see
  "Narration engine" below) -- no bundled model, no native bindings, natural
  voices for free
- Local voice-cloning UI (record a sample, name it, save it) backed by a
  PocketTTS/sherpa-onnx adapter slot, with its own first-run model download
- Voice picker (tap a voice in the Voices screen to select it for narration),
  playback speed, sleep-timer state
- Mix / Duck / Pause audio-focus modes in Settings, with Mix as the default so
  YouTube/Spotify/Apple Music can keep playing underneath narration
- Media3 foreground playback service (`PlaybackService`) with lock-screen /
  notification transport controls, plus a real `Player.Listener` surfacing
  playback errors on screen instead of failing silently
- Room-backed local library + DataStore-backed saved playback position
- Automatic copyright-safe fallback cover art (locally generated placeholder;
  Open Library lookup stubbed as the swap-in network source)

## Module boundaries (swap points)

Each of the three "engine" concerns is behind its own interface so it can be
replaced without touching the UI, navigation, or the rest of the player:

- `tts/TtsEngine.kt` — standard narration. Implemented by
  `AndroidSystemTtsEngine`.
- `voiceclone/VoiceCloneEngine.kt` — custom cloned voices. Implemented by
  `LocalCloneEngine`.
- `data/claude/ClaudeApiClient.kt` — the only module that talks to a cloud
  model, used solely for Retell/Summary/Podcast script generation. Read mode
  never calls it.

### Narration engine

V1 originally bundled Kokoro (a local ONNX model, ~320MB, run through a vendored
sherpa-onnx JNI binding) directly into the APK. That approach was dropped after
two real problems surfaced: the voice quality was poor, and the amount of custom
native-library/model-bundling machinery it required was a large, hard-to-verify
surface for bugs relative to what it bought.

`AndroidSystemTtsEngine` uses `android.speech.tts.TextToSpeech` instead -- the
OS's own TTS engine, which on almost every real Android phone is Google's own
"Speech Services" TTS: already installed, already maintained, genuinely natural
neural voices, completely free, and nothing this app has to download, bundle,
or link native code for. `synthesizeToFile()` writes a standard WAV directly,
so it plugs into the exact same chunked-WAV player pipeline the old engine used
-- no changes needed anywhere else in the app.

The trade-off worth naming: voice availability and exact on-device-ness now
depend on what the phone's owner has installed under Settings > Language &
input > Text-to-speech output, not on anything this app controls. Most
Android phones ship at least one on-device voice by default.

### Voice cloning implementation note

Earlier planning discussed OpenVoice V2. For this Android-native package, the
project uses a PocketTTS/sherpa-onnx local cloning adapter slot instead,
because it runs entirely on-device and avoids embedding Python on the phone.
This is the one place in the app that still uses sherpa-onnx -- standard
narration no longer shares this runtime (see "Narration engine" above).

The custom-voice UI, sample recording, and first-run local voice-cloning model
download are fully wired. The final PocketTTS synthesis call is intentionally
isolated in `voiceclone/LocalCloneEngine.kt` (`synthesize()`) so it can be
completed against the exact tensor names in the downloaded model bundle
without touching the rest of the app. Enrollment, on-device storage, and
listing cloned voices above that point are already functional.

## Build

1. Install Android Studio (Giraffe or newer).
2. Open this `smr-android/` folder as the project root.
3. Let Gradle sync.
4. Connect the Galaxy A71 5G with USB debugging enabled.
5. Run the `app` configuration.

Or build from the command line:

```bash
./gradlew assembleDebug
```

The APK will be at `app/build/outputs/apk/debug/app-debug.apk`. No large model
download happens at build time anymore -- the narration engine is part of the
OS, so this is a normal-sized Android build.

### Claude API key (local/dev only)

Set `SMR_CLAUDE_API_KEY` in `gradle.properties` (or as a Gradle property /
environment override) to enable Retell/Summary/Podcast generation locally.
Never commit a real key — see "Still to finish" below for the production path.

## First launch

Narration works immediately -- the system TTS engine is part of the OS, not
something this app downloads. Open the Voices screen to see which voices are
available on this phone and tap one to use it. The local voice-clone model is
the one thing that still downloads on first use, from the Voices / Custom
Voice screens.

## Still to finish before calling it production

- wire generated narration/clone WAV chunks into the Media3 queue incrementally
  as they're synthesized, rather than after the full batch completes
- exact-position resume verified against Media3's own state restoration
- sleep timer's end-of-chapter mode wired to real chapter boundaries once
  chapter parsing exists
- encrypted key storage / backend proxy for the Claude key (currently
  BuildConfig-only, intended for local/dev builds)
- PocketTTS cloned-voice inference call (`LocalCloneEngine.synthesize`)
- PDF / DOCX manuscript parsing (plain text is fully supported today)
- real cover search provider with license filtering (Open Library lookup is
  stubbed; the local generated placeholder is always used today)
- chapter parsing
- signed release APK / Play Store metadata
