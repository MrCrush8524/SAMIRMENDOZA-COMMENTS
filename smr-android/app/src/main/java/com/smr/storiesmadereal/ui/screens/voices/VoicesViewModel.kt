package com.smr.storiesmadereal.ui.screens.voices

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smr.storiesmadereal.SmrApplication
import com.smr.storiesmadereal.data.model.BuiltInVoices
import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.tts.ModelDownloadState
import com.smr.storiesmadereal.tts.TtsEngine
import com.smr.storiesmadereal.voiceclone.VoiceCloneEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File

class VoicesViewModel(
    private val ttsEngine: TtsEngine,
    private val voiceCloneEngine: VoiceCloneEngine
) : ViewModel() {

    private val _clonedVoices = MutableStateFlow<List<Voice>>(emptyList())
    private val _cloneError = MutableStateFlow<String?>(null)

    val standardVoices: List<Voice> = BuiltInVoices.list
    val clonedVoices: StateFlow<List<Voice>> = _clonedVoices
    val cloneError: StateFlow<String?> = _cloneError

    val kokoroDownloadState: StateFlow<ModelDownloadState> = ttsEngine.observeDownloadProgress()
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5_000), ModelDownloadState.NotStarted)

    val cloneDownloadState: StateFlow<ModelDownloadState> = voiceCloneEngine.observeDownloadProgress()
        .stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5_000), ModelDownloadState.NotStarted)

    init {
        refreshClonedVoices()
        // The narration model ships inside the APK now -- proactively copy it into local
        // storage as soon as this screen is visible, rather than waiting for a button tap.
        // ensureModelReady() is a no-op once already installed, so this is safe to call on
        // every visit to this screen.
        downloadKokoroModel()
    }

    fun refreshClonedVoices() {
        viewModelScope.launch { _clonedVoices.value = voiceCloneEngine.listClonedVoices() }
    }

    fun downloadKokoroModel() {
        viewModelScope.launch { ttsEngine.ensureModelReady() }
    }

    fun downloadCloneModel() {
        viewModelScope.launch { voiceCloneEngine.ensureModelReady() }
    }

    fun deleteClonedVoice(voiceId: String) {
        viewModelScope.launch {
            voiceCloneEngine.deleteClonedVoice(voiceId)
            refreshClonedVoices()
        }
    }

    fun cloneFromSample(sampleFile: File, displayName: String, onDone: () -> Unit) {
        viewModelScope.launch {
            _cloneError.value = null
            try {
                voiceCloneEngine.cloneFromSample(sampleFile, displayName)
                refreshClonedVoices()
                onDone()
            } catch (e: Exception) {
                _cloneError.value = e.message ?: "Couldn't save custom voice"
            }
        }
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val container = (context.applicationContext as SmrApplication).container
            @Suppress("UNCHECKED_CAST")
            return VoicesViewModel(container.ttsEngine, container.voiceCloneEngine) as T
        }
    }
}
