package com.smr.storiesmadereal.playback

import com.smr.storiesmadereal.data.model.SleepTimerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Counts down a user-selected sleep timer and invokes [onExpire] once, from the player's scope. */
class SleepTimerController(
    private val scope: CoroutineScope,
    private val onExpire: () -> Unit
) {
    private val _state = MutableStateFlow<SleepTimerState>(SleepTimerState.Off)
    val state: StateFlow<SleepTimerState> = _state

    private var tickJob: Job? = null

    fun start(durationMs: Long) {
        cancel()
        val endAt = System.currentTimeMillis() + durationMs
        tickJob = scope.launch {
            while (true) {
                val remaining = endAt - System.currentTimeMillis()
                if (remaining <= 0) {
                    _state.value = SleepTimerState.Off
                    onExpire()
                    break
                }
                _state.value = SleepTimerState.Active(remainingMs = remaining, totalMs = durationMs)
                delay(1_000)
            }
        }
    }

    fun startEndOfChapter() {
        cancel()
        _state.value = SleepTimerState.EndOfChapter
    }

    /** Called by the player when a chapter boundary is crossed while an end-of-chapter timer is set. */
    fun notifyChapterEnded() {
        if (_state.value is SleepTimerState.EndOfChapter) {
            _state.value = SleepTimerState.Off
            onExpire()
        }
    }

    fun cancel() {
        tickJob?.cancel()
        tickJob = null
        _state.value = SleepTimerState.Off
    }
}
