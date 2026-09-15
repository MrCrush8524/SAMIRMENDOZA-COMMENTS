package com.smr.storiesmadereal.ui.screens.library

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smr.storiesmadereal.SmrApplication
import com.smr.storiesmadereal.data.model.Manuscript
import com.smr.storiesmadereal.data.repository.LibraryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class LibraryViewModel(
    private val repository: LibraryRepository,
    private val selectedManuscriptBus: kotlinx.coroutines.flow.MutableStateFlow<Manuscript?>
) : ViewModel() {

    val manuscripts: StateFlow<List<Manuscript>> = repository.observeLibrary()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _isImporting = MutableStateFlow(false)
    val isImporting: StateFlow<Boolean> = _isImporting

    fun importManuscript(uri: Uri) {
        viewModelScope.launch {
            _isImporting.value = true
            runCatching { repository.importManuscript(uri) }
            _isImporting.value = false
        }
    }

    fun deleteManuscript(manuscript: Manuscript) {
        viewModelScope.launch { repository.deleteManuscript(manuscript) }
    }

    fun selectManuscript(manuscript: Manuscript) {
        selectedManuscriptBus.value = manuscript
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val container = (context.applicationContext as SmrApplication).container
            @Suppress("UNCHECKED_CAST")
            return LibraryViewModel(container.libraryRepository, container.selectedManuscript) as T
        }
    }
}
