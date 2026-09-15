package com.smr.storiesmadereal.tts

import com.smr.storiesmadereal.data.model.Voice
import java.io.File
import kotlinx.coroutines.flow.Flow

/**
 * Replaceable narration engine seam. Kokoro (local/offline, via sherpa-onnx) is the V1
 * implementation; a cloud engine or a different local model could implement this same
 * interface without touching the player, the UI, or the Claude layer.
 */
interface TtsEngine {
    val isModelReady: Boolean

    /** True while a model download/install triggered by [ensureModelReady] is in progress. */
    fun observeDownloadProgress(): Flow<ModelDownloadState>

    suspend fun ensureModelReady()

    /**
     * Synthesizes [text] with [voice] at the given [speed] and writes 16-bit PCM WAV chunks to
     * [outputDir], returning them in playback order. Chunking (rather than one large file) keeps
     * memory bounded on long manuscripts and lets the player start before synthesis finishes.
     */
    suspend fun synthesize(
        text: String,
        voice: Voice,
        speed: Float,
        outputDir: File
    ): List<File>

    fun availableVoices(): List<Voice>
}

sealed class ModelDownloadState {
    data object NotStarted : ModelDownloadState()
    data class Downloading(val bytesDownloaded: Long, val totalBytes: Long) : ModelDownloadState()
    data object Installing : ModelDownloadState()
    data object Ready : ModelDownloadState()
    data class Failed(val message: String) : ModelDownloadState()
}
