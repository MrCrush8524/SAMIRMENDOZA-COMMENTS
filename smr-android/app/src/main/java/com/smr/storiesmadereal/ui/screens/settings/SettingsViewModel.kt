package com.smr.storiesmadereal.ui.screens.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.smr.storiesmadereal.SmrApplication
import com.smr.storiesmadereal.data.model.AudioFocusMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SettingsViewModel(private val audioFocusModeBus: MutableStateFlow<AudioFocusMode>) : ViewModel() {
    val audioFocusMode: StateFlow<AudioFocusMode> = audioFocusModeBus

    fun setAudioFocusMode(mode: AudioFocusMode) {
        audioFocusModeBus.value = mode
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val container = (context.applicationContext as SmrApplication).container
            @Suppress("UNCHECKED_CAST")
            return SettingsViewModel(container.audioFocusMode) as T
        }
    }
}
