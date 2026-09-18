package com.smr.storiesmadereal.tts

import com.smr.storiesmadereal.data.model.Voice
import java.io.File
import kotlinx.coroutines.flow.Flow

/**
 * Replaceable narration engine seam. Android's system TTS (see AndroidSystemTtsEngine) is the
 * V1 implementation; a cloud engine or a bundled local model could implement this same
 * interface without touching the player, the UI, or the Claude layer.
 */
interface TtsEngine {
    val isModelReady: Boolean

    /** Reflects engine initialization (or, for engines that need one, a model
     *  download/install) triggered by [ensureModelReady]. */
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
    /**
     * Extraction is CPU-bound (bzip2 decompression) and can take minutes on a phone, with no
     * network activity to show for it -- [bytesWritten] lets the UI prove it's still progressing
     * rather than just showing a static "Installing..." that looks identical whether it's 5%
     * done or hung.
     */
    data class Installing(val bytesWritten: Long, val filesExtracted: Int) : ModelDownloadState()
    data object Ready : ModelDownloadState()
    data class Failed(val message: String) : ModelDownloadState()
}
