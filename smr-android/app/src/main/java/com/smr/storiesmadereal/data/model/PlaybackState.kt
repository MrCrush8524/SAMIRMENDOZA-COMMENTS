package com.smr.storiesmadereal.data.model

data class PlaybackUiState(
    val manuscript: Manuscript? = null,
    val mode: PlaybackMode = PlaybackMode.READ,
    val voice: Voice = BuiltInVoices.list.first(),
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
