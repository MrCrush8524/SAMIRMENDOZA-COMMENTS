package com.smr.storiesmadereal.ui.screens.voices

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smr.storiesmadereal.ui.theme.SmrPalette
import java.io.File

/**
 * Records a short local reference sample and hands it to [VoicesViewModel.cloneFromSample],
 * which registers it with the local voice-clone engine (see LocalCloneEngine). The sample never
 * leaves the device.
 */
@Composable
fun CustomVoiceScreen(
    onDone: () -> Unit,
    viewModel: VoicesViewModel = viewModel(factory = VoicesViewModel.Factory(LocalContext.current))
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val cloneError by viewModel.cloneError.collectAsState()

    var displayName by remember { mutableStateOf("") }
    var isRecording by remember { mutableStateOf(false) }
    var recordedFile by remember { mutableStateOf<File?>(null) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            recordedFile = startRecording(context) { recorder = it }
            isRecording = true
        }
    }

    Scaffold(
        containerColor = SmrPalette.Base,
        topBar = {
            TopAppBar(
                title = { Text("New Custom Voice", color = SmrPalette.Cream) },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = SmrPalette.Lavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SmrPalette.Base)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                "Record about 30 seconds of clear speech. This stays on your device.",
                color = SmrPalette.CreamDim,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Voice name") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = SmrPalette.Cream,
                    unfocusedTextColor = SmrPalette.Cream,
                    focusedBorderColor = SmrPalette.Lavender,
                    unfocusedBorderColor = SmrPalette.Divider,
                    focusedLabelColor = SmrPalette.Lavender,
                    unfocusedLabelColor = SmrPalette.CreamDim
                ),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(32.dp))

            IconButton(
                onClick = {
                    if (!isRecording) {
                        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            recordedFile = startRecording(context) { recorder = it }
                            isRecording = true
                        } else {
                            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    } else {
                        stopRecording(recorder)
                        recorder = null
                        isRecording = false
                    }
                },
                modifier = Modifier.height(72.dp)
            ) {
                Icon(
                    imageVector = if (isRecording) Icons.Filled.Stop else Icons.Filled.Mic,
                    contentDescription = if (isRecording) "Stop recording" else "Start recording",
                    tint = if (isRecording) SmrPalette.Error else SmrPalette.Lavender,
                    modifier = Modifier.height(48.dp)
                )
            }
            Text(
                if (isRecording) "Recording..." else "Tap to record",
                color = SmrPalette.CreamDim,
                style = MaterialTheme.typography.labelSmall
            )

            Spacer(Modifier.height(32.dp))
            Button(
                enabled = recordedFile != null && displayName.isNotBlank() && !isRecording,
                onClick = {
                    val file = recordedFile ?: return@Button
                    viewModel.cloneFromSample(file, displayName, onDone = onDone)
                },
                colors = ButtonDefaults.buttonColors(containerColor = SmrPalette.Teal)
            ) {
                Text("Save custom voice", color = SmrPalette.Base)
            }

            cloneError?.let {
                Spacer(Modifier.height(16.dp))
                Text(it, color = SmrPalette.Error, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

private fun startRecording(context: android.content.Context, onRecorderCreated: (MediaRecorder) -> Unit): File {
    val outputFile = File(context.cacheDir, "voice_sample_${System.currentTimeMillis()}.m4a")
    @Suppress("DEPRECATION")
    val recorder = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        MediaRecorder(context)
    } else {
        MediaRecorder()
    }
    recorder.apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setOutputFile(outputFile.absolutePath)
        prepare()
        start()
    }
    onRecorderCreated(recorder)
    return outputFile
}

private fun stopRecording(recorder: MediaRecorder?) {
    runCatching {
        recorder?.stop()
        recorder?.release()
    }
}
