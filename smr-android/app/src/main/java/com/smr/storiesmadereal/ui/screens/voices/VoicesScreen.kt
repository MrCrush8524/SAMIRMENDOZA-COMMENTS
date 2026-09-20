package com.smr.storiesmadereal.ui.screens.voices

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.tts.ModelDownloadState
import com.smr.storiesmadereal.ui.theme.SmrPalette

@Composable
fun VoicesScreen(
    onOpenDrawer: () -> Unit,
    onAddCustomVoice: () -> Unit,
    viewModel: VoicesViewModel = viewModel(factory = VoicesViewModel.Factory(LocalContext.current))
) {
    val clonedVoices by viewModel.clonedVoices.collectAsState()
    val standardVoices by viewModel.standardVoices.collectAsState()
    val engineState by viewModel.narrationEngineState.collectAsState()

    Scaffold(
        containerColor = SmrPalette.Base,
        topBar = {
            TopAppBar(
                title = { Text("Voices", color = SmrPalette.Cream) },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = SmrPalette.Lavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SmrPalette.Base)
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp)) {
            item {
                Text("Standard", style = MaterialTheme.typography.titleMedium, color = SmrPalette.Lavender, modifier = Modifier.padding(vertical = 12.dp))
                EngineStatusRow(engineState, onRetry = viewModel::prepareNarrationEngine)
            }
            items(standardVoices) { voice -> VoiceRow(voice, onClick = { viewModel.selectVoice(voice) }) }

            item {
                Spacer(Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Custom voices", style = MaterialTheme.typography.titleMedium, color = SmrPalette.Lavender)
                    IconButton(onClick = onAddCustomVoice) {
                        Icon(Icons.Filled.Add, contentDescription = "Add custom voice", tint = SmrPalette.Teal)
                    }
                }
            }
            if (clonedVoices.isEmpty()) {
                item {
                    Text(
                        "No custom voices yet. Record a short sample to clone one locally.",
                        color = SmrPalette.CreamDim,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                }
            } else {
                items(clonedVoices) { voice -> VoiceRow(voice) }
            }
        }
    }
}

/**
 * Status of Android's system TTS engine (see AndroidSystemTtsEngine) -- not a download, just
 * initialization, since the voices themselves are whatever the phone already has installed
 * under Settings > Language & input > Text-to-speech output.
 */
@Composable
private fun EngineStatusRow(state: ModelDownloadState, onRetry: () -> Unit) {
    Column(modifier = Modifier.padding(bottom = 12.dp)) {
        when (state) {
            is ModelDownloadState.NotStarted, is ModelDownloadState.Downloading ->
                Text("Starting narration engine...", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)

            is ModelDownloadState.Installing ->
                Text("Starting narration engine...", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)

            is ModelDownloadState.Ready ->
                Text("Narration engine ready -- tap a voice below to use it", color = SmrPalette.Teal, style = MaterialTheme.typography.bodyMedium)

            is ModelDownloadState.Failed -> {
                Text("Couldn't start narration engine: ${state.message}", color = SmrPalette.Error, style = MaterialTheme.typography.bodyMedium)
                Button(
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(containerColor = SmrPalette.Teal),
                    modifier = Modifier.padding(top = 8.dp)
                ) { Text("Retry", color = SmrPalette.Base) }
            }
        }
    }
}

@Composable
private fun VoiceRow(voice: Voice, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(voice.displayName, color = SmrPalette.Cream, style = MaterialTheme.typography.bodyLarge)
    }
}
