package com.smr.storiesmadereal.tts

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.data.model.VoiceKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Narration through Android's own system Text-to-Speech engine -- on almost every real Android
 * phone this is Google's own "Speech Services" TTS (already installed, already kept up to date
 * by Google, genuinely natural neural voices), not something this app has to bundle, download,
 * or link native code for.
 *
 * This replaced an earlier local-model approach (Kokoro via a vendored sherpa-onnx JNI binding,
 * bundled as a ~320MB APK asset) after two real problems with that path: the voice quality was
 * poor, and the amount of custom native/asset-loading machinery it required was a large,
 * hard-to-verify surface for bugs relative to what it bought. The system TTS engine is simpler,
 * smaller, and -- because it's what the phone's owner already configured -- generally sounds
 * better than a small bundled model. The trade-off is real and worth naming: voice availability
 * and exact on-device-ness now depend on what the user has installed under Settings ->
 * Language & input -> Text-to-speech output, not on anything this app controls.
 */
class AndroidSystemTtsEngine(private val context: Context) : TtsEngine {

    private var tts: TextToSpeech? = null
    private val _state = MutableStateFlow<ModelDownloadState>(ModelDownloadState.NotStarted)

    // The OS TTS engine has its own hard cap on characters per synthesis call
    // (TextToSpeech.getMaxSpeechInputLength(), historically ~4000); stay comfortably under it.
    private val maxCharsPerCall: Int
        get() = (TextToSpeech.getMaxSpeechInputLength() - 200).coerceAtLeast(500)

    override val isModelReady: Boolean
        get() = tts != null

    override fun observeDownloadProgress(): Flow<ModelDownloadState> = _state

    override suspend fun ensureModelReady() {
        if (tts != null) return
        _state.value = ModelDownloadState.Installing(0, 0)
        suspendCancellableCoroutine<Unit> { continuation ->
            var engine: TextToSpeech? = null
            engine = TextToSpeech(context) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    engine?.language = Locale.US
                    tts = engine
                    _state.value = ModelDownloadState.Ready
                    if (continuation.isActive) continuation.resume(Unit)
                } else {
                    val message = "System TTS engine failed to initialize (status $status). " +
                        "Check that a text-to-speech engine is installed and set under " +
                        "Settings > Language & input > Text-to-speech output."
                    _state.value = ModelDownloadState.Failed(message)
                    if (continuation.isActive) continuation.resumeWithException(IllegalStateException(message))
                }
            }
        }
    }

    override fun availableVoices(): List<Voice> {
        val engine = tts ?: return emptyList()
        // TextToSpeech.getVoices() is a nullable platform type -- some engines/devices return
        // null here rather than an empty set, and calling straight through would NPE.
        return (engine.voices ?: emptySet())
            .filter { it.locale.language == Locale.US.language && !it.isNetworkConnectionRequired }
            .sortedBy { it.name }
            .map { Voice(id = it.name, displayName = voiceDisplayName(it.name), kind = VoiceKind.SYSTEM) }
    }

    private fun voiceDisplayName(rawName: String): String =
        rawName.replace("-", " ").replaceFirstChar { it.uppercase() }

    override suspend fun synthesize(
        text: String,
        voice: Voice,
        speed: Float,
        outputDir: File
    ): List<File> = withContext(Dispatchers.IO) {
        ensureModelReady()
        val engine = tts ?: error("System TTS not available -- call ensureModelReady() first")
        outputDir.mkdirs()

        applyVoice(engine, voice)
        engine.setSpeechRate(speed)

        val chunks = chunkForSynthesis(text, maxCharsPerCall)
        val files = mutableListOf<File>()
        chunks.forEachIndexed { index, chunk ->
            val outFile = File(outputDir, "chunk_%04d.wav".format(index))
            synthesizeChunkToFile(engine, chunk, outFile)
            files += outFile
        }
        files
    }

    /** Falls back to whatever voice the engine already has selected if [voice] doesn't match --
     *  never a hard failure just because the requested voice isn't available on this device. */
    private fun applyVoice(engine: TextToSpeech, voice: Voice) {
        val match = engine.voices?.firstOrNull { it.name == voice.id }
        if (match != null) engine.voice = match
    }

    private suspend fun synthesizeChunkToFile(engine: TextToSpeech, text: String, outFile: File) =
        suspendCancellableCoroutine<Unit> { continuation ->
            val utteranceId = UUID.randomUUID().toString()
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}

                override fun onDone(id: String?) {
                    if (id == utteranceId && continuation.isActive) continuation.resume(Unit)
                }

                @Deprecated("Deprecated in Java", ReplaceWith(""))
                override fun onError(id: String?) {
                    if (id == utteranceId && continuation.isActive) {
                        continuation.resumeWithException(IllegalStateException("System TTS synthesis failed"))
                    }
                }

                override fun onError(id: String?, errorCode: Int) {
                    if (id == utteranceId && continuation.isActive) {
                        continuation.resumeWithException(IllegalStateException("System TTS synthesis failed (code $errorCode)"))
                    }
                }
            })

            val queued = engine.synthesizeToFile(text, Bundle(), outFile, utteranceId)
            if (queued != TextToSpeech.SUCCESS && continuation.isActive) {
                continuation.resumeWithException(IllegalStateException("System TTS refused to queue synthesis"))
            }

            continuation.invokeOnCancellation { engine.stop() }
        }

    private fun chunkForSynthesis(text: String, maxChars: Int): List<String> {
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

    fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
