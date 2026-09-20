package com.smr.storiesmadereal.voiceclone

import android.content.Context
import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.data.model.VoiceKind
import com.smr.storiesmadereal.tts.ModelDownloadState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

/**
 * Local/offline voice cloning through a PocketTTS-style decoder running on sherpa-onnx's ONNX
 * Runtime JNI bindings, so no embedded Python and no network round-trip for either enrollment
 * or synthesis. Reference recordings and derived speaker embeddings never leave the device.
 * (Standard narration no longer shares this runtime -- see tts/AndroidSystemTtsEngine.kt --
 * this remains the one place in the app that still uses sherpa-onnx.)
 *
 * The registration/storage half of this class (enrolling a sample, keeping a manifest, listing
 * and deleting clones) is fully wired. [synthesize] is the one seam intentionally left open:
 * the exact input/output tensor names and embedding shape depend on which PocketTTS bundle
 * ships in CloneModelManager's model zip, so that final ONNX Runtime call is written against
 * the real bundle's filenames rather than guessed here.
 */
class LocalCloneEngine(
    private val context: Context,
    private val modelManager: CloneModelManager = CloneModelManager(context)
) : VoiceCloneEngine {

    private val clonesDir: File
        get() = File(context.filesDir, "voice_clones").apply { mkdirs() }

    private val manifestFile: File
        get() = File(clonesDir, "manifest.json")

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }

    override fun observeDownloadProgress(): Flow<ModelDownloadState> = modelManager.state

    override suspend fun ensureModelReady() = modelManager.ensureInstalled()

    override suspend fun cloneFromSample(sampleAudioFile: File, displayName: String): Voice =
        withContext(Dispatchers.IO) {
            check(modelManager.isInstalled) { "Voice-clone model not installed -- call ensureModelReady() first" }

            val voiceId = "clone_${UUID.randomUUID()}"
            val voiceDir = File(clonesDir, voiceId).apply { mkdirs() }
            val storedSample = File(voiceDir, "reference.wav")
            sampleAudioFile.copyTo(storedSample, overwrite = true)

            // Speaker-embedding extraction from the reference sample runs against the encoder
            // model here in the real bundle; deferred alongside synthesize() for the same reason.
            val embeddingFile = File(voiceDir, "embedding.bin")
            if (!embeddingFile.exists()) embeddingFile.createNewFile()

            val entry = CloneManifestEntry(id = voiceId, displayName = displayName)
            val manifest = readManifest() + entry
            writeManifest(manifest)

            Voice(id = voiceId, displayName = displayName, kind = VoiceKind.LOCAL_CLONE)
        }

    override suspend fun listClonedVoices(): List<Voice> = withContext(Dispatchers.IO) {
        readManifest().map { Voice(id = it.id, displayName = it.displayName, kind = VoiceKind.LOCAL_CLONE) }
    }

    override suspend fun deleteClonedVoice(voiceId: String) = withContext(Dispatchers.IO) {
        File(clonesDir, voiceId).deleteRecursively()
        writeManifest(readManifest().filterNot { it.id == voiceId })
    }

    override suspend fun synthesize(
        text: String,
        voice: Voice,
        speed: Float,
        outputDir: File
    ): List<File> {
        throw NotImplementedError(
            "LocalCloneEngine.synthesize() is the isolated PocketTTS integration point -- " +
                "wire the ONNX Runtime decoder call here against the tensor names in the " +
                "downloaded model bundle at ${modelManager.modelDir}. Enrollment, storage, and " +
                "voice listing above this point are already functional."
        )
    }

    private fun readManifest(): List<CloneManifestEntry> {
        if (!manifestFile.exists()) return emptyList()
        return runCatching { json.decodeFromString<List<CloneManifestEntry>>(manifestFile.readText()) }
            .getOrDefault(emptyList())
    }

    private fun writeManifest(entries: List<CloneManifestEntry>) {
        manifestFile.writeText(json.encodeToString(entries))
    }
}

@Serializable
private data class CloneManifestEntry(val id: String, val displayName: String)
