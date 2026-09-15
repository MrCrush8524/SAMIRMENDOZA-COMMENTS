package com.smr.storiesmadereal.tts

import android.content.Context
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.smr.storiesmadereal.data.model.BuiltInVoices
import com.smr.storiesmadereal.data.model.Voice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile

/**
 * Local/offline neural TTS backed by Kokoro running through sherpa-onnx's ONNX Runtime
 * bindings. Nothing here touches the network at synthesis time -- narration audio is
 * generated entirely on-device.
 */
class KokoroTtsEngine(
    private val context: Context,
    private val modelManager: KokoroModelManager = KokoroModelManager(context)
) : TtsEngine {

    private var tts: OfflineTts? = null

    override val isModelReady: Boolean
        get() = modelManager.isInstalled

    override fun observeDownloadProgress(): Flow<ModelDownloadState> = modelManager.state

    override suspend fun ensureModelReady() = withContext(Dispatchers.IO) {
        modelManager.ensureInstalled()
        loadEngineIfNeeded()
    }

    private fun loadEngineIfNeeded() {
        if (tts != null) return
        val dir = modelManager.modelDir
        val kokoroConfig = OfflineTtsKokoroModelConfig(
            model = File(dir, "kokoro.onnx").absolutePath,
            voices = File(dir, "voices.bin").absolutePath,
            tokens = File(dir, "tokens.txt").absolutePath,
            dataDir = File(dir, "espeak-ng-data").absolutePath,
            lengthScale = 1.0f
        )
        val modelConfig = OfflineTtsModelConfig(
            kokoro = kokoroConfig,
            numThreads = 2,
            debug = false,
            provider = "cpu"
        )
        tts = OfflineTts(config = OfflineTtsConfig(model = modelConfig))
    }

    override suspend fun synthesize(
        text: String,
        voice: Voice,
        speed: Float,
        outputDir: File
    ): List<File> = withContext(Dispatchers.Default) {
        loadEngineIfNeeded()
        val engine = tts ?: error("Kokoro model not ready -- call ensureModelReady() first")
        outputDir.mkdirs()

        val speakerId = speakerIdFor(voice)
        val chunks = chunkForSynthesis(text)
        val files = mutableListOf<File>()

        chunks.forEachIndexed { index, chunk ->
            val audio = engine.generate(text = chunk, sid = speakerId, speed = speed)
            val outFile = File(outputDir, "chunk_%04d.wav".format(index))
            writeWav(outFile, audio.samples, audio.sampleRate)
            files += outFile
        }
        files
    }

    override fun availableVoices(): List<Voice> = BuiltInVoices.list

    /** Kokoro voices are addressed by speaker id within the bundled voices.bin pack. */
    private fun speakerIdFor(voice: Voice): Int =
        BuiltInVoices.list.indexOfFirst { it.id == voice.id }.coerceAtLeast(0)

    /**
     * Splits on sentence boundaries and caps chunk length so a single synthesis call stays
     * fast and each resulting WAV is small enough to stream into the player incrementally.
     */
    private fun chunkForSynthesis(text: String, maxChars: Int = 400): List<String> {
        val sentences = text.split(Regex("(?<=[.!?])\\s+"))
        val chunks = mutableListOf<String>()
        val current = StringBuilder()
        for (sentence in sentences) {
            if (current.length + sentence.length > maxChars && current.isNotEmpty()) {
                chunks += current.toString().trim()
                current.clear()
            }
            current.append(sentence).append(' ')
        }
        if (current.isNotBlank()) chunks += current.toString().trim()
        return chunks
    }

    private fun writeWav(file: File, samples: FloatArray, sampleRate: Int) {
        val pcm = ShortArray(samples.size) { i ->
            (samples[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
        }
        RandomAccessFile(file, "rw").use { raf ->
            val dataSize = pcm.size * 2
            raf.setLength(0)
            raf.writeBytes("RIFF")
            raf.writeIntLE(36 + dataSize)
            raf.writeBytes("WAVE")
            raf.writeBytes("fmt ")
            raf.writeIntLE(16)
            raf.writeShortLE(1) // PCM
            raf.writeShortLE(1) // mono
            raf.writeIntLE(sampleRate)
            raf.writeIntLE(sampleRate * 2)
            raf.writeShortLE(2)
            raf.writeShortLE(16)
            raf.writeBytes("data")
            raf.writeIntLE(dataSize)
            val buffer = java.nio.ByteBuffer.allocate(dataSize).order(java.nio.ByteOrder.LITTLE_ENDIAN)
            pcm.forEach { buffer.putShort(it) }
            raf.write(buffer.array())
        }
    }

    private fun RandomAccessFile.writeIntLE(value: Int) {
        write(byteArrayOf(
            (value and 0xFF).toByte(),
            ((value shr 8) and 0xFF).toByte(),
            ((value shr 16) and 0xFF).toByte(),
            ((value shr 24) and 0xFF).toByte()
        ))
    }

    private fun RandomAccessFile.writeShortLE(value: Int) {
        write(byteArrayOf((value and 0xFF).toByte(), ((value shr 8) and 0xFF).toByte()))
    }

    fun release() {
        tts?.release()
        tts = null
    }
}
