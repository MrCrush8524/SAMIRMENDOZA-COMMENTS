package com.smr.storiesmadereal.ui.screens.nowplaying

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smr.storiesmadereal.data.model.PlaybackMode
import com.smr.storiesmadereal.data.model.SPEED_OPTIONS
import com.smr.storiesmadereal.ui.components.CoverWithGlow
import com.smr.storiesmadereal.ui.theme.SmrPalette
import java.util.concurrent.TimeUnit

@Composable
fun NowPlayingScreen(
    onOpenDrawer: () -> Unit,
    onOpenLibrary: () -> Unit,
    viewModel: NowPlayingViewModel = viewModel(
        factory = NowPlayingViewModel.Factory(LocalContext.current)
    )
) {
    val state by viewModel.uiState.collectAsState()
    val error by viewModel.generationError.collectAsState()
    val playbackError by viewModel.playbackError.collectAsState()
    var showSpeedMenu by remember { mutableStateOf(false) }
    var showSleepMenu by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = SmrPalette.Base,
        topBar = {
            TopAppBar(
                title = { Text(state.manuscript?.title ?: "SMR", color = SmrPalette.Cream) },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = SmrPalette.Lavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SmrPalette.Base)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (state.manuscript == null) {
                EmptyLibraryPrompt(onOpenLibrary)
                return@Column
            }

            Spacer(Modifier.height(12.dp))
            CoverWithGlow(
                coverArt = null,
                modifier = Modifier.height(300.dp),
                contentDescription = state.manuscript?.title
            )
            Spacer(Modifier.height(20.dp))

            Text(
                text = state.manuscript?.title.orEmpty(),
                style = MaterialTheme.typography.titleLarge,
                color = SmrPalette.Cream
            )
            state.manuscript?.author?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = SmrPalette.CreamDim)
            }

            Spacer(Modifier.height(16.dp))
            ModeSelector(current = state.mode, onSelect = viewModel::selectMode)

            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = SmrPalette.Error, style = MaterialTheme.typography.bodyMedium)
            }
            playbackError?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = SmrPalette.Error, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(Modifier.height(20.dp))
            Slider(
                value = state.positionMs.toFloat().coerceAtMost(state.durationMs.toFloat().coerceAtLeast(1f)),
                onValueChange = { },
                valueRange = 0f..state.durationMs.toFloat().coerceAtLeast(1f),
                colors = SliderDefaults.colors(
                    thumbColor = SmrPalette.Lavender,
                    activeTrackColor = SmrPalette.Teal,
                    inactiveTrackColor = SmrPalette.Divider
                )
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatMs(state.positionMs), color = SmrPalette.CreamDim, style = MaterialTheme.typography.labelSmall)
                Text(formatMs(state.durationMs), color = SmrPalette.CreamDim, style = MaterialTheme.typography.labelSmall)
            }

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = viewModel::skipBackward) {
                    Icon(Icons.Filled.Replay10, contentDescription = "Back 15 seconds", tint = SmrPalette.Lavender, modifier = Modifier.size(32.dp))
                }
                Button(
                    onClick = viewModel::togglePlayPause,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SmrPalette.Lavender),
                    modifier = Modifier.size(72.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                    shape = androidx.compose.foundation.shape.CircleShape
                ) {
                    Icon(
                        imageVector = if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (state.isPlaying) "Pause" else "Play",
                        tint = SmrPalette.Base,
                        modifier = Modifier.size(36.dp)
                    )
                }
                IconButton(onClick = viewModel::skipForward) {
                    Icon(Icons.Filled.Forward10, contentDescription = "Forward 15 seconds", tint = SmrPalette.Lavender, modifier = Modifier.size(32.dp))
                }
            }

            Spacer(Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                IconButton(onClick = { showSpeedMenu = true }) {
                    Icon(Icons.Filled.Speed, contentDescription = "Playback speed", tint = SmrPalette.Teal)
                }
                IconButton(onClick = { showSleepMenu = true }) {
                    Icon(Icons.Filled.Bedtime, contentDescription = "Sleep timer", tint = SmrPalette.Teal)
                }
            }

            if (showSpeedMenu) {
                SpeedPicker(
                    current = state.speed,
                    onSelect = { viewModel.setSpeed(it); showSpeedMenu = false },
                    onDismiss = { showSpeedMenu = false }
                )
            }
            if (showSleepMenu) {
                SleepTimerPicker(
                    onSelect = { viewModel.startSleepTimer(it); showSleepMenu = false },
                    onEndOfChapter = { viewModel.startSleepTimerEndOfChapter(); showSleepMenu = false },
                    onCancel = { viewModel.cancelSleepTimer(); showSleepMenu = false },
                    onDismiss = { showSleepMenu = false }
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun EmptyLibraryPrompt(onOpenLibrary: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("No manuscript loaded yet", color = SmrPalette.Cream, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Text("Import one from your library to start listening.", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = onOpenLibrary,
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SmrPalette.Teal)
        ) {
            Text("Open Library", color = SmrPalette.Base)
        }
    }
}

@Composable
private fun ModeSelector(current: PlaybackMode, onSelect: (PlaybackMode) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(PlaybackMode.values().toList()) { mode ->
            FilterChip(
                selected = current == mode,
                onClick = { onSelect(mode) },
                label = { Text(mode.label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SmrPalette.Lavender,
                    selectedLabelColor = SmrPalette.Base,
                    containerColor = SmrPalette.BaseElevated,
                    labelColor = SmrPalette.CreamDim
                )
            )
        }
    }
}

@Composable
private fun SpeedPicker(current: Float, onSelect: (Float) -> Unit, onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SmrPalette.BaseElevated,
        title = { Text("Playback speed", color = SmrPalette.Cream) },
        text = {
            Column {
                SPEED_OPTIONS.forEach { speed ->
                    Text(
                        text = "${speed}x" + if (speed == current) "  •" else "",
                        color = if (speed == current) SmrPalette.Lavender else SmrPalette.CreamDim,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .clickable { onSelect(speed) }
                    )
                }
            }
        },
        confirmButton = {}
    )
}

@Composable
private fun SleepTimerPicker(
    onSelect: (Int) -> Unit,
    onEndOfChapter: () -> Unit,
    onCancel: () -> Unit,
    onDismiss: () -> Unit
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SmrPalette.BaseElevated,
        title = { Text("Sleep timer", color = SmrPalette.Cream) },
        text = {
            Column {
                com.smr.storiesmadereal.data.model.SLEEP_TIMER_PRESETS_MIN.forEach { minutes ->
                    Text(
                        text = "$minutes minutes",
                        color = SmrPalette.CreamDim,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp)
                            .clickable { onSelect(minutes) }
                    )
                }
                Text(
                    text = "End of chapter",
                    color = SmrPalette.CreamDim,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable(onClick = onEndOfChapter)
                )
                Text(
                    text = "Off",
                    color = SmrPalette.Error,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable(onClick = onCancel)
                )
            }
        },
        confirmButton = {}
    )
}

private fun formatMs(ms: Long): String {
    val totalSeconds = TimeUnit.MILLISECONDS.toSeconds(ms)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
