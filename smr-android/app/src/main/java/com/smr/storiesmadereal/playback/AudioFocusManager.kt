package com.smr.storiesmadereal.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import com.smr.storiesmadereal.data.model.AudioFocusMode

/**
 * Wraps Android audio-focus handling with SMR's three user-facing modes. Mix is the default so
 * background music apps (YouTube, Apple Music, Spotify) keep playing under narration -- SMR
 * never requests exclusive focus unless the user has explicitly chosen Duck or Pause.
 */
class AudioFocusManager(
    context: Context,
    private val onFocusLostPause: () -> Unit,
    private val onFocusLostDuck: (duck: Boolean) -> Unit,
    private val onFocusRegained: () -> Unit
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var focusRequest: AudioFocusRequest? = null
    private var currentMode: AudioFocusMode = AudioFocusMode.default

    private val focusChangeListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> onFocusLostPause()
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> onFocusLostPause()
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> onFocusLostDuck(true)
            AudioManager.AUDIOFOCUS_GAIN -> {
                onFocusLostDuck(false)
                onFocusRegained()
            }
        }
    }

    /**
     * Requests focus per [mode]. Mix intentionally requests no focus at all -- that is what
     * lets another app's audio keep playing simultaneously; SMR simply mixes into the stream.
     */
    fun applyMode(mode: AudioFocusMode): Boolean {
        currentMode = mode
        return when (mode) {
            AudioFocusMode.MIX -> {
                abandonFocus()
                true
            }
            AudioFocusMode.DUCK -> requestFocus(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            AudioFocusMode.PAUSE -> requestFocus(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        }
    }

    private fun requestFocus(focusGainType: Int): Boolean {
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()

        val request = AudioFocusRequest.Builder(focusGainType)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(focusChangeListener)
            .build()

        focusRequest = request
        return audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonFocus() {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    fun release() = abandonFocus()
}
