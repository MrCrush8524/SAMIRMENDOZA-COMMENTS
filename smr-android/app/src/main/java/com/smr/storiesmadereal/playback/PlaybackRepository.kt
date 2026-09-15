package com.smr.storiesmadereal.playback

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.smr.storiesmadereal.data.model.AudioFocusMode
import com.smr.storiesmadereal.data.model.SKIP_INTERVAL_MS
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * App-facing playback API. Holds the [MediaController] connection to [PlaybackService] so the UI
 * layer (ViewModels) never touches Media3 types directly.
 *
 * V1 status: connects to the service, drives transport controls (play/pause/seek/±15s/speed),
 * and exposes audio-focus-mode + sleep-timer state. Queuing synthesized Kokoro/clone WAV chunks
 * as they're produced (rather than one at a time) and resuming at an exact saved position are
 * the two pieces flagged in the README as still to finish -- [enqueueChunks] and [seekTo] below
 * are the integration points for that work.
 */
class PlaybackRepository(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null

    private val sleepTimer = SleepTimerController(scope, onExpire = { pause() })
    val sleepTimerState: StateFlow<com.smr.storiesmadereal.data.model.SleepTimerState> = sleepTimer.state

    private val _audioFocusMode = MutableStateFlow(AudioFocusMode.default)
    val audioFocusMode: StateFlow<AudioFocusMode> = _audioFocusMode

    fun connect(onReady: () -> Unit = {}) {
        val sessionToken = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture = future
        future.addListener({
            controller = future.get()
            onReady()
        }, context.mainExecutor)
    }

    fun disconnect() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
        sleepTimer.cancel()
    }

    /** Enqueues synthesized narration chunks in playback order as they are produced by the TTS engine. */
    fun enqueueChunks(chunkFiles: List<File>, clearExisting: Boolean = true) {
        val items = chunkFiles.map { MediaItem.fromUri(it.toURI().toString()) }
        controller?.apply {
            if (clearExisting) clearMediaItems()
            addMediaItems(items)
            prepare()
        }
    }

    fun play() = controller?.play() ?: Unit
    fun pause() = controller?.pause() ?: Unit

    fun seekForward() {
        val c = controller ?: return
        c.seekTo((c.currentPosition + SKIP_INTERVAL_MS).coerceAtMost(c.duration.coerceAtLeast(0)))
    }

    fun seekBackward() {
        val c = controller ?: return
        c.seekTo((c.currentPosition - SKIP_INTERVAL_MS).coerceAtLeast(0))
    }

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs)
    }

    fun setSpeed(speed: Float) {
        controller?.setPlaybackSpeed(speed)
    }

    fun setAudioFocusMode(mode: AudioFocusMode) {
        _audioFocusMode.value = mode
        val command = androidx.media3.session.SessionCommand("com.smr.audio_focus_mode", android.os.Bundle.EMPTY)
        val args = android.os.Bundle().apply { putString("mode", mode.name) }
        controller?.sendCustomCommand(command, args)
    }

    fun currentPositionMs(): Long = controller?.currentPosition ?: 0L
    fun durationMs(): Long = controller?.duration?.coerceAtLeast(0) ?: 0L
    fun isPlaying(): Boolean = controller?.isPlaying ?: false

    fun startSleepTimer(durationMs: Long) = sleepTimer.start(durationMs)
    fun startSleepTimerEndOfChapter() = sleepTimer.startEndOfChapter()
    fun cancelSleepTimer() = sleepTimer.cancel()
}
