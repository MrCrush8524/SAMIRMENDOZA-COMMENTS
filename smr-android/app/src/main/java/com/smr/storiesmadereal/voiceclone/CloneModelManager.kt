package com.smr.storiesmadereal.voiceclone

import android.content.Context
import com.smr.storiesmadereal.tts.ModelDownloadState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.zip.ZipInputStream
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * First-run download/install for the local voice-cloning model bundle (speaker encoder +
 * PocketTTS decoder weights). Structurally identical to [com.smr.storiesmadereal.tts.KokoroModelManager]
 * but kept as its own class since the two model bundles version and update independently.
 */
class CloneModelManager(
    private val context: Context,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    private val _state = MutableStateFlow<ModelDownloadState>(ModelDownloadState.NotStarted)
    val state: StateFlow<ModelDownloadState> = _state

    val modelDir: File
        get() = File(context.filesDir, "models/voice_clone")

    val isInstalled: Boolean
        get() = File(modelDir, "encoder.onnx").exists() && File(modelDir, "decoder.onnx").exists()

    var modelBundleUrl: String = "https://huggingface.co/api/models/pocket-tts-clone/resolve/main/pocket-tts-clone.zip"

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
        val zipFile = File(context.cacheDir, "clone-download.zip")
        val call = httpClient.newCall(Request.Builder().url(modelBundleUrl).build())

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
                    continuation.resume(Unit)
                } catch (e: Exception) {
                    _state.value = ModelDownloadState.Failed(e.message ?: "download failed")
                    continuation.resumeWithException(e)
                }
            }
        })

        continuation.invokeOnCancellation { call.cancel() }
    }

    private fun install() {
        _state.value = ModelDownloadState.Installing
        modelDir.mkdirs()
        val zipFile = File(context.cacheDir, "clone-download.zip")
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
