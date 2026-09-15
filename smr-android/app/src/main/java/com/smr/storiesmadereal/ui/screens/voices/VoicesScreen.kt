package com.smr.storiesmadereal.ui.screens.voices

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
    val kokoroState by viewModel.kokoroDownloadState.collectAsState()

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
                DownloadStatusRow(kokoroState, onDownload = viewModel::downloadKokoroModel)
            }
            items(viewModel.standardVoices) { voice -> VoiceRow(voice) }

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

@Composable
private fun DownloadStatusRow(state: ModelDownloadState, onDownload: () -> Unit) {
    Column(modifier = Modifier.padding(bottom = 12.dp)) {
        when (state) {
            is ModelDownloadState.NotStarted -> Button(
                onClick = onDownload,
                colors = ButtonDefaults.buttonColors(containerColor = SmrPalette.Teal)
            ) { Text("Download narration model", color = SmrPalette.Base) }

            is ModelDownloadState.Downloading -> {
                val progress = if (state.totalBytes > 0) state.bytesDownloaded.toFloat() / state.totalBytes else 0f
                Text("Downloading model...", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)
                LinearProgressIndicator(progress = { progress }, color = SmrPalette.Teal, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
            }

            is ModelDownloadState.Installing ->
                Text("Installing model...", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)

            is ModelDownloadState.Ready ->
                Text("Narration model ready", color = SmrPalette.Teal, style = MaterialTheme.typography.bodyMedium)

            is ModelDownloadState.Failed ->
                Text("Download failed: ${state.message}", color = SmrPalette.Error, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun VoiceRow(voice: Voice) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(voice.displayName, color = SmrPalette.Cream, style = MaterialTheme.typography.bodyLarge)
    }
}
