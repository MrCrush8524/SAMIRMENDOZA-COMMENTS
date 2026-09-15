package com.smr.storiesmadereal.ui.screens.nowplaying

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smr.storiesmadereal.data.claude.ClaudeRepository
import com.smr.storiesmadereal.data.claude.ClaudeScriptResult
import com.smr.storiesmadereal.data.model.AudioFocusMode
import com.smr.storiesmadereal.data.model.Manuscript
import com.smr.storiesmadereal.data.model.PlaybackMode
import com.smr.storiesmadereal.data.model.PlaybackUiState
import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.data.repository.LibraryRepository
import com.smr.storiesmadereal.data.repository.PlaybackPositionStore
import com.smr.storiesmadereal.playback.PlaybackRepository
import com.smr.storiesmadereal.tts.TtsEngine
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

class NowPlayingViewModel(
    private val appContext: Context,
    private val libraryRepository: LibraryRepository,
    private val playbackPositionStore: PlaybackPositionStore,
    private val playbackRepository: PlaybackRepository,
    private val ttsEngine: TtsEngine,
    private val claudeRepository: ClaudeRepository,
    private val selectedManuscriptBus: kotlinx.coroutines.flow.StateFlow<Manuscript?>,
    private val audioFocusModeBus: kotlinx.coroutines.flow.StateFlow<AudioFocusMode>
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlaybackUiState())
    val uiState: StateFlow<PlaybackUiState> = _uiState

    private val _generationError = MutableStateFlow<String?>(null)
    val generationError: StateFlow<String?> = _generationError

    init {
        playbackRepository.connect(onReady = { resumeLastManuscript() })
        observePlaybackPosition()
        observeLibrarySelection()
        observeAudioFocusMode()
    }

    private fun observeAudioFocusMode() {
        viewModelScope.launch {
            audioFocusModeBus.collect { mode -> setAudioFocusMode(mode) }
        }
    }

    private fun observeLibrarySelection() {
        viewModelScope.launch {
            selectedManuscriptBus.collect { manuscript ->
                if (manuscript != null && manuscript.id != _uiState.value.manuscript?.id) {
                    openManuscript(manuscript)
                }
            }
        }
    }

    private fun observePlaybackPosition() {
        viewModelScope.launch {
            while (true) {
                delay(1_000)
                val manuscript = _uiState.value.manuscript ?: continue
                val position = playbackRepository.currentPositionMs()
                _uiState.update {
                    it.copy(
                        positionMs = position,
                        durationMs = playbackRepository.durationMs(),
                        isPlaying = playbackRepository.isPlaying()
                    )
                }
                playbackPositionStore.savePosition(manuscript.id, position)
            }
        }
    }

    private fun resumeLastManuscript() {
        viewModelScope.launch {
            val lastId = playbackPositionStore.observeLastOpenedManuscriptId().first()
            if (lastId != null && _uiState.value.manuscript == null) {
                libraryRepository.getManuscript(lastId)?.let { openManuscript(it) }
            }
        }
    }

    fun openManuscript(manuscript: Manuscript) {
        _uiState.update { it.copy(manuscript = manuscript, positionMs = 0L, isBuffering = false) }
        viewModelScope.launch {
            // One-shot read: the periodic poll in observePlaybackPosition() owns live updates
            // once playback of this manuscript begins.
            val savedPosition = playbackPositionStore.observePosition(manuscript.id).first()
            _uiState.update { it.copy(positionMs = savedPosition) }
        }
        generateAndQueue(manuscript, _uiState.value.mode)
    }

    fun selectMode(mode: PlaybackMode) {
        val manuscript = _uiState.value.manuscript ?: return
        _uiState.update { it.copy(mode = mode) }
        generateAndQueue(manuscript, mode)
    }

    fun selectVoice(voice: Voice) {
        _uiState.update { it.copy(voice = voice) }
        _uiState.value.manuscript?.let { generateAndQueue(it, _uiState.value.mode) }
    }

    private fun generateAndQueue(manuscript: Manuscript, mode: PlaybackMode) {
        viewModelScope.launch {
            _uiState.update { it.copy(isBuffering = true) }
            _generationError.value = null

            try {
                val manuscriptText = File(manuscript.textFilePath).readText()
                val narrationText = if (mode == PlaybackMode.READ) {
                    manuscriptText
                } else {
                    when (val result = claudeRepository.generateScript(manuscriptText, manuscript.title, mode)) {
                        is ClaudeScriptResult.Success -> result.script.lines.joinToString("\n") { it.text }
                        is ClaudeScriptResult.Failure -> {
                            _generationError.value = result.message
                            return@launch
                        }
                    }
                }

                ttsEngine.ensureModelReady()
                if (!ttsEngine.isModelReady) {
                    _generationError.value = "Narration model isn't downloaded yet -- open Voices and download it first."
                    return@launch
                }

                val outputDir = File(appContext.cacheDir, "narration/${manuscript.id}_${mode.name}")
                val chunks = ttsEngine.synthesize(
                    text = narrationText,
                    voice = _uiState.value.voice,
                    speed = _uiState.value.speed,
                    outputDir = outputDir
                )
                playbackRepository.enqueueChunks(chunks)
                playbackRepository.seekTo(_uiState.value.positionMs)
            } catch (e: Exception) {
                _generationError.value = e.message ?: "Narration failed"
            } finally {
                _uiState.update { it.copy(isBuffering = false) }
            }
        }
    }

    fun togglePlayPause() {
        if (playbackRepository.isPlaying()) playbackRepository.pause() else playbackRepository.play()
    }

    fun skipForward() = playbackRepository.seekForward()
    fun skipBackward() = playbackRepository.seekBackward()

    fun setSpeed(speed: Float) {
        _uiState.update { it.copy(speed = speed) }
        playbackRepository.setSpeed(speed)
    }

    fun setAudioFocusMode(mode: AudioFocusMode) {
        _uiState.update { it.copy(audioFocusMode = mode) }
        playbackRepository.setAudioFocusMode(mode)
    }

    fun startSleepTimer(minutes: Int) = playbackRepository.startSleepTimer(minutes * 60_000L)
    fun startSleepTimerEndOfChapter() = playbackRepository.startSleepTimerEndOfChapter()
    fun cancelSleepTimer() = playbackRepository.cancelSleepTimer()

    override fun onCleared() {
        playbackRepository.disconnect()
        super.onCleared()
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val app = context.applicationContext as com.smr.storiesmadereal.SmrApplication
            val container = app.container
            @Suppress("UNCHECKED_CAST")
            return NowPlayingViewModel(
                appContext = context.applicationContext,
                libraryRepository = container.libraryRepository,
                playbackPositionStore = container.playbackPositionStore,
                playbackRepository = PlaybackRepository(context.applicationContext, container.appScope),
                ttsEngine = container.ttsEngine,
                claudeRepository = container.claudeRepository,
                selectedManuscriptBus = container.selectedManuscript,
                audioFocusModeBus = container.audioFocusMode
            ) as T
        }
    }
}
