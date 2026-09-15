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
- Claude Messages API client + repository for Retell/Summary/Podcast script generation
- Kokoro local/offline neural TTS integration through sherpa-onnx, with first-run
  model download/install
- Local voice-cloning UI (record a sample, name it, save it) backed by a
  PocketTTS/sherpa-onnx adapter slot, with its own first-run model download
- Voice picker, playback speed, sleep-timer state
- Mix / Duck / Pause audio-focus modes in Settings, with Mix as the default so
  YouTube/Spotify/Apple Music can keep playing underneath narration
- Media3 foreground playback service (`PlaybackService`) with lock-screen /
  notification transport controls
- Room-backed local library + DataStore-backed saved playback position
- Automatic copyright-safe fallback cover art (locally generated placeholder;
  Open Library lookup stubbed as the swap-in network source)

## Module boundaries (swap points)

Each of the three "engine" concerns is behind its own interface so it can be
replaced without touching the UI, navigation, or the rest of the player:

- `tts/TtsEngine.kt` — standard narration. Implemented by `KokoroTtsEngine`.
- `voiceclone/VoiceCloneEngine.kt` — custom cloned voices. Implemented by
  `LocalCloneEngine`.
- `data/claude/ClaudeApiClient.kt` — the only module that talks to a cloud
  model, used solely for Retell/Summary/Podcast script generation. Read mode
  never calls it.

### Voice cloning implementation note

Earlier planning discussed OpenVoice V2. For this Android-native package, the
project uses a PocketTTS/sherpa-onnx local cloning adapter slot instead,
because it runs in the same Android/JNI runtime as Kokoro and avoids embedding
Python on the phone.

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

The APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

### Claude API key (local/dev only)

Set `SMR_CLAUDE_API_KEY` in `gradle.properties` (or as a Gradle property /
environment override) to enable Retell/Summary/Podcast generation locally.
Never commit a real key — see "Still to finish" below for the production path.

## First launch

The app itself is small. Kokoro and the local voice-clone model download only
when requested from the Voices / Custom Voice screens, so they are not baked
into the APK.

## Still to finish before calling it production

- wire generated Kokoro/clone WAV chunks into the Media3 queue incrementally
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
