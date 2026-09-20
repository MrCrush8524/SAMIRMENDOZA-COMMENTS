package com.smr.storiesmadereal.di

import android.content.Context
import com.smr.storiesmadereal.BuildConfig
import com.smr.storiesmadereal.data.claude.ClaudeApiClient
import com.smr.storiesmadereal.data.claude.ClaudeRepository
import com.smr.storiesmadereal.data.model.Manuscript
import com.smr.storiesmadereal.data.repository.LibraryRepository
import com.smr.storiesmadereal.data.repository.PlaybackPositionStore
import com.smr.storiesmadereal.tts.AndroidSystemTtsEngine
import com.smr.storiesmadereal.tts.TtsEngine
import com.smr.storiesmadereal.voiceclone.LocalCloneEngine
import com.smr.storiesmadereal.voiceclone.VoiceCloneEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Minimal hand-rolled dependency container for V1. Every dependency is exposed through an
 * interface (TtsEngine, VoiceCloneEngine) or is otherwise a single swap point (ClaudeApiClient's
 * endpoint/key), so replacing an engine never means touching the UI or navigation layers.
 */
class AppContainer(context: Context) {
    val appScope: CoroutineScope = CoroutineScope(SupervisorJob())

    val libraryRepository: LibraryRepository by lazy { LibraryRepository(context) }
    val playbackPositionStore: PlaybackPositionStore by lazy { PlaybackPositionStore(context) }

    val ttsEngine: TtsEngine by lazy { AndroidSystemTtsEngine(context) }
    val voiceCloneEngine: VoiceCloneEngine by lazy { LocalCloneEngine(context) }

    private val claudeApiClient: ClaudeApiClient by lazy { ClaudeApiClient(apiKey = BuildConfig.CLAUDE_API_KEY) }
    val claudeRepository: ClaudeRepository by lazy { ClaudeRepository(claudeApiClient) }

    /** Library -> Now Playing hand-off: set when the user taps a manuscript in the library. */
    val selectedManuscript = MutableStateFlow<Manuscript?>(null)

    /** Settings -> Now Playing hand-off for the audio-focus mode (Mix/Duck/Pause; Mix default). */
    val audioFocusMode = MutableStateFlow(com.smr.storiesmadereal.data.model.AudioFocusMode.default)

    /** Voices -> Now Playing hand-off: set when the user taps a voice in the Voices screen. */
    val selectedVoice = MutableStateFlow<com.smr.storiesmadereal.data.model.Voice?>(null)

    companion object {
        @Volatile private var instance: AppContainer? = null

        fun get(context: Context): AppContainer =
            instance ?: synchronized(this) {
                instance ?: AppContainer(context.applicationContext).also { instance = it }
            }
    }
}
