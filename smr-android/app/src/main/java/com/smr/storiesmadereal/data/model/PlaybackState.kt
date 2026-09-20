package com.smr.storiesmadereal.data.model

/** Sentinel meaning "use whatever voice the system TTS engine already has selected" -- its id
 *  deliberately matches no real device voice, so AndroidSystemTtsEngine's applyVoice() no-ops
 *  and leaves the engine's own default voice in place until the user picks one explicitly. */
val DEFAULT_VOICE = Voice(id = "", displayName = "Default")

data class PlaybackUiState(
    val manuscript: Manuscript? = null,
    val mode: PlaybackMode = PlaybackMode.READ,
    val voice: Voice = DEFAULT_VOICE,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val speed: Float = 1.0f,
    val audioFocusMode: AudioFocusMode = AudioFocusMode.default,
    val sleepTimer: SleepTimerState = SleepTimerState.Off
)

sealed class SleepTimerState {
    data object Off : SleepTimerState()
    data class Active(val remainingMs: Long, val totalMs: Long) : SleepTimerState()
    data object EndOfChapter : SleepTimerState()
}

val SPEED_OPTIONS = listOf(0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f)
val SLEEP_TIMER_PRESETS_MIN = listOf(5, 10, 15, 30, 45, 60)
const val SKIP_INTERVAL_MS = 15_000L
