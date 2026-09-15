package com.smr.storiesmadereal.tts

import android.content.Context
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.zip.ZipInputStream

/**
 * Downloads and unpacks the quantized Kokoro ONNX model bundle on first use. The app itself
 * ships without the model (it's tens of MB), so the Voices screen is what actually triggers
 * this the first time a user picks a standard narration voice.
 */
class KokoroModelManager(
    private val context: Context,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    private val _state = MutableStateFlow<ModelDownloadState>(ModelDownloadState.NotStarted)
    val state: StateFlow<ModelDownloadState> = _state

    val modelDir: File
        get() = File(context.filesDir, "models/kokoro")

    val isInstalled: Boolean
        get() = File(modelDir, "kokoro.onnx").exists() && File(modelDir, "voices.bin").exists()

    /**
     * Bundle URL is intentionally left as a configuration point rather than hardcoded here --
     * point it at whichever quantized Kokoro release/mirror the build wants to ship. Swap this
     * to a self-hosted mirror for reproducible builds.
     */
    var modelBundleUrl: String = "https://huggingface.co/api/models/kokoro-onnx-int8/resolve/main/kokoro-int8.zip"

    suspend fun ensureInstalled() {
        if (isInstalled) {
            _state.value = ModelDownloadState.Ready
            return
        }
        download()
        install()
        _state.value = ModelDownloadState.Ready
    }

    private suspend fun download() {
        val zipFile = File(context.cacheDir, "kokoro-download.zip")
        callbackFlow {
            val request = Request.Builder().url(modelBundleUrl).build()
            val call = httpClient.newCall(request)
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    _state.value = ModelDownloadState.Failed(e.message ?: "download failed")
                    close(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use { resp ->
                        val body = resp.body ?: return close(IOException("empty body"))
                        val total = body.contentLength()
                        var downloaded = 0L
                        zipFile.outputStream().use { out ->
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
                    trySend(Unit)
                    close()
                }
            })
            awaitClose { call.cancel() }
        }
    }

    private fun install() {
        _state.value = ModelDownloadState.Installing
        modelDir.mkdirs()
        val zipFile = File(context.cacheDir, "kokoro-download.zip")
        ZipInputStream(zipFile.inputStream()).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val outFile = File(modelDir, File(entry.name).name)
                    outFile.outputStream().use { zip.copyTo(it) }
                }
                entry = zip.nextEntry
            }
        }
        zipFile.delete()
    }
}
