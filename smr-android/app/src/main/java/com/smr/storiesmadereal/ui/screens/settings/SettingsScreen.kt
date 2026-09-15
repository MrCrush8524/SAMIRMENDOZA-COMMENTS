package com.smr.storiesmadereal.ui.screens.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smr.storiesmadereal.data.model.AudioFocusMode
import com.smr.storiesmadereal.ui.theme.SmrPalette

@Composable
fun SettingsScreen(
    onOpenDrawer: () -> Unit,
    viewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory(LocalContext.current))
) {
    val audioFocusMode by viewModel.audioFocusMode.collectAsState()

    Scaffold(
        containerColor = SmrPalette.Base,
        topBar = {
            TopAppBar(
                title = { Text("Settings", color = SmrPalette.Cream) },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = SmrPalette.Lavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SmrPalette.Base)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp)) {
            Text(
                "Background audio behavior",
                style = MaterialTheme.typography.titleMedium,
                color = SmrPalette.Lavender,
                modifier = Modifier.padding(vertical = 16.dp)
            )
            Text(
                "Controls how SMR narration interacts with music or other audio already playing.",
                style = MaterialTheme.typography.bodyMedium,
                color = SmrPalette.CreamDim
            )
            Spacer(Modifier.height(12.dp))

            AudioFocusOption(
                mode = AudioFocusMode.MIX,
                title = "Mix (default)",
                description = "Narration plays alongside YouTube, Spotify, or Apple Music without interrupting them.",
                selected = audioFocusMode == AudioFocusMode.MIX,
                onSelect = viewModel::setAudioFocusMode
            )
            AudioFocusOption(
                mode = AudioFocusMode.DUCK,
                title = "Duck",
                description = "Other audio lowers in volume while narration plays.",
                selected = audioFocusMode == AudioFocusMode.DUCK,
                onSelect = viewModel::setAudioFocusMode
            )
            AudioFocusOption(
                mode = AudioFocusMode.PAUSE,
                title = "Pause",
                description = "Other audio pauses while narration plays.",
                selected = audioFocusMode == AudioFocusMode.PAUSE,
                onSelect = viewModel::setAudioFocusMode
            )
        }
    }
}

@Composable
private fun AudioFocusOption(
    mode: AudioFocusMode,
    title: String,
    description: String,
    selected: Boolean,
    onSelect: (AudioFocusMode) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = { onSelect(mode) })
            .padding(vertical = 10.dp)
    ) {
        androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(
                selected = selected,
                onClick = { onSelect(mode) },
                colors = RadioButtonDefaults.colors(selectedColor = SmrPalette.Lavender, unselectedColor = SmrPalette.CreamDim)
            )
            Text(title, color = SmrPalette.Cream, style = MaterialTheme.typography.bodyLarge)
        }
        Text(
            description,
            color = SmrPalette.CreamDim,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(start = 48.dp)
        )
    }
}
