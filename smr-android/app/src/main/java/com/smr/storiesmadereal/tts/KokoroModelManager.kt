package com.smr.storiesmadereal.tts

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Downloads and unpacks the quantized Kokoro ONNX model bundle on first use. The app itself
 * ships without the model (it's ~320MB, the real Kokoro v0.19 release size), so the Voices
 * screen is what actually triggers this the first time a user picks a standard narration voice.
 */
class KokoroModelManager(
    private val context: Context,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        // Defaults (10s) are far too short for a 320MB download over a mobile connection --
        // a brief stall between chunks would otherwise throw a spurious SocketTimeoutException
        // partway through and fail the whole download.
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .writeTimeout(5, TimeUnit.MINUTES)
        .build()
) {
    private val _state = MutableStateFlow<ModelDownloadState>(ModelDownloadState.NotStarted)
    val state: StateFlow<ModelDownloadState> = _state

    val modelDir: File
        get() = File(context.filesDir, "models/kokoro")

    val isInstalled: Boolean
        get() = File(modelDir, "model.onnx").exists() && File(modelDir, "voices.bin").exists()

    /**
     * Official k2-fsa/sherpa-onnx release of Kokoro v0.19 (English), packaged exactly as this
     * engine expects: kokoro.onnx, voices.bin, tokens.txt, espeak-ng-data/. Overridable so a
     * build can point at a self-hosted mirror or a newer/multilingual release instead.
     */
    var modelBundleUrl: String =
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2"

    suspend fun ensureInstalled() {
        if (isInstalled) {
            _state.value = ModelDownloadState.Ready
            return
        }
        try {
            download()
            install()
            _state.value = ModelDownloadState.Ready
        } catch (e: Exception) {
            // Callers observe [state] rather than catching exceptions from this function --
            // never let a download/extraction failure crash the app.
            _state.value = ModelDownloadState.Failed(e.message ?: "model setup failed")
        }
    }

    private suspend fun download() = suspendCancellableCoroutine<Unit> { continuation ->
        val archiveFile = File(context.cacheDir, "kokoro-download.tar.bz2")
        val request = Request.Builder().url(modelBundleUrl).build()
        val call = httpClient.newCall(request)

        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                _state.value = ModelDownloadState.Failed(e.message ?: "download failed")
                continuation.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    response.use { resp ->
                        val body = resp.body ?: throw IOException("empty body")
                        val total = body.contentLength()
                        var downloaded = 0L
                        archiveFile.outputStream().use { out ->
                            body.byteStream().use { input ->
                                val buffer = ByteArray(64 * 1024)
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read == -1) break
                                    out.write(buffer, 0, read)
                                    downloaded += read
                                    _state.value = ModelDownloadState.Downloading(downloaded, total)
                                }
                            }
                        }
                    }
                    continuation.resume(Unit)
                } catch (e: Exception) {
                    _state.value = ModelDownloadState.Failed(e.message ?: "download failed")
                    continuation.resumeWithException(e)
                }
            }
        })

        continuation.invokeOnCancellation { call.cancel() }
    }

    /**
     * The release archive extracts to a single top-level folder (e.g. "kokoro-en-v0_19/model.onnx",
     * ".../espeak-ng-data/en_dict"). Strip that top-level folder so files land directly in
     * [modelDir], preserving the espeak-ng-data subdirectory structure sherpa-onnx expects.
     */
    private fun install() {
        modelDir.mkdirs()
        val archiveFile = File(context.cacheDir, "kokoro-download.tar.bz2")

        var totalBytesWritten = 0L
        var filesExtracted = 0
        _state.value = ModelDownloadState.Installing(totalBytesWritten, filesExtracted)

        TarArchiveInputStream(BZip2CompressorInputStream(archiveFile.inputStream())).use { tar ->
            var entry = tar.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val relativePath = entry.name.substringAfter('/', entry.name)
                    val outFile = File(modelDir, relativePath)
                    outFile.parentFile?.mkdirs()
                    outFile.outputStream().use { out ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val read = tar.read(buffer)
                            if (read == -1) break
                            out.write(buffer, 0, read)
                            totalBytesWritten += read
                            // Extraction is bzip2-decompression-bound, not network-bound -- this
                            // is what lets the UI show it's still making progress, not hung.
                            _state.value = ModelDownloadState.Installing(totalBytesWritten, filesExtracted)
                        }
                    }
                    filesExtracted++
                }
                entry = tar.nextEntry
            }
        }
        archiveFile.delete()
    }
}
