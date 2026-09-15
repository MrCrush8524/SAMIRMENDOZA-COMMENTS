package com.smr.storiesmadereal.tts

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * Copies the Kokoro narration model from the app's bundled assets into local storage on first
 * use. The model itself (~320MB) is baked into the APK at build time by the
 * fetchKokoroModelAsset Gradle task (see app/build.gradle.kts) -- it is never downloaded over
 * the network at runtime. This class's only job is the one-time local copy from the read-only
 * APK asset package into a real filesystem path OfflineTts can open, since the native binding's
 * asset-loading support for a whole directory tree (espeak-ng-data/, dozens of small files)
 * isn't something this project has verified; a plain file path is the well-tested path.
 */
class KokoroModelManager(private val context: Context) {
    private val _state = MutableStateFlow<ModelDownloadState>(ModelDownloadState.NotStarted)
    val state: StateFlow<ModelDownloadState> = _state

    private val assetRoot = "kokoro_model"

    val modelDir: File
        get() = File(context.filesDir, "models/kokoro")

    val isInstalled: Boolean
        get() = File(modelDir, "model.onnx").exists() && File(modelDir, "voices.bin").exists()

    suspend fun ensureInstalled() {
        if (isInstalled) {
            _state.value = ModelDownloadState.Ready
            return
        }
        try {
            copyFromAssets()
            _state.value = ModelDownloadState.Ready
        } catch (e: Exception) {
            // Callers observe [state] rather than catching exceptions from this function --
            // never let a copy failure crash the app.
            _state.value = ModelDownloadState.Failed(e.message ?: "model setup failed")
        }
    }

    private fun copyFromAssets() {
        modelDir.mkdirs()
        var totalBytesWritten = 0L
        var filesExtracted = 0
        _state.value = ModelDownloadState.Installing(totalBytesWritten, filesExtracted)

        val assetPaths = listAssetFilesRecursively(assetRoot)
        check(assetPaths.isNotEmpty()) {
            "No bundled Kokoro model assets found under assets/$assetRoot -- this build wasn't " +
                "produced with the fetchKokoroModelAsset Gradle task, or it failed silently."
        }

        for (assetPath in assetPaths) {
            val relativePath = assetPath.removePrefix("$assetRoot/")
            val outFile = File(modelDir, relativePath)
            outFile.parentFile?.mkdirs()

            context.assets.open(assetPath).use { input ->
                outFile.outputStream().use { out ->
                    val buffer = ByteArray(256 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        out.write(buffer, 0, read)
                        totalBytesWritten += read
                        _state.value = ModelDownloadState.Installing(totalBytesWritten, filesExtracted)
                    }
                }
            }
            filesExtracted++
            _state.value = ModelDownloadState.Installing(totalBytesWritten, filesExtracted)
        }
    }

    /** AssetManager.list() only lists one directory level at a time; walk it manually. */
    private fun listAssetFilesRecursively(path: String): List<String> {
        val entries = context.assets.list(path) ?: return emptyList()
        if (entries.isEmpty()) return listOf(path) // a leaf file has no children

        return entries.flatMap { entry -> listAssetFilesRecursively("$path/$entry") }
    }
}
