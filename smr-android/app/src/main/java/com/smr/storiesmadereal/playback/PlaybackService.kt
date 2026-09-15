package com.smr.storiesmadereal.playback

import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSession.ConnectionResult
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.smr.storiesmadereal.MainActivity
import com.smr.storiesmadereal.data.model.AudioFocusMode

/**
 * Foreground playback service: owns the ExoPlayer instance, publishes a MediaSession so the
 * system surfaces lock-screen / notification-shade transport controls, and keeps narration
 * running while the app is backgrounded. Audio-focus behavior (Mix/Duck/Pause) is delegated to
 * [AudioFocusManager] rather than left to ExoPlayer's own default focus handling, since Mix
 * mode needs to deliberately request *no* focus so other media apps keep playing underneath.
 */
class PlaybackService : MediaSessionService() {

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var audioFocusManager: AudioFocusManager? = null

    override fun onCreate() {
        super.onCreate()

        val exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                // SMR manages focus itself via AudioFocusManager so Mix mode can opt out of
                // requesting focus entirely; ExoPlayer must not also request it independently.
                /* handleAudioFocus = */ false
            )
            .build()
        player = exoPlayer

        val sessionActivityIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setSessionActivity(sessionActivityIntent)
            .setCallback(AudioFocusCommandCallback())
            .build()

        audioFocusManager = AudioFocusManager(
            context = this,
            onFocusLostPause = { exoPlayer.pause() },
            onFocusLostDuck = { duck -> exoPlayer.volume = if (duck) 0.3f else 1.0f },
            onFocusRegained = { exoPlayer.volume = 1.0f }
        )
        audioFocusManager?.applyMode(AudioFocusMode.default)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    fun setAudioFocusMode(mode: AudioFocusMode) {
        audioFocusManager?.applyMode(mode)
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        audioFocusManager?.release()
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = player ?: return
        if (!p.playWhenReady || p.mediaItemCount == 0) {
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    /** Receives the audio-focus-mode custom command sent from [PlaybackRepository.setAudioFocusMode]. */
    private inner class AudioFocusCommandCallback : MediaSession.Callback {
        private val focusModeCommand = SessionCommand(AUDIO_FOCUS_MODE_COMMAND, Bundle.EMPTY)

        override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): ConnectionResult {
            val sessionCommands = ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
                .add(focusModeCommand)
                .build()
            return ConnectionResult.accept(sessionCommands, ConnectionResult.DEFAULT_PLAYER_COMMANDS)
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle
        ): ListenableFuture<SessionResult> {
            if (customCommand.customAction == AUDIO_FOCUS_MODE_COMMAND) {
                val modeName = args.getString("mode")
                val mode = modeName?.let { runCatching { AudioFocusMode.valueOf(it) }.getOrNull() }
                if (mode != null) setAudioFocusMode(mode)
            }
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
    }

    companion object {
        private const val AUDIO_FOCUS_MODE_COMMAND = "com.smr.audio_focus_mode"
    }
}
