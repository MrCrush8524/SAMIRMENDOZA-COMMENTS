package com.smr.storiesmadereal.voiceclone

import com.smr.storiesmadereal.data.model.Voice
import com.smr.storiesmadereal.tts.ModelDownloadState
import java.io.File
import kotlinx.coroutines.flow.Flow

/**
 * Replaceable voice-cloning seam, mirroring [com.smr.storiesmadereal.tts.TtsEngine]. The
 * original plan for this slot was OpenVoice V2; the shipping implementation is a local
 * PocketTTS/sherpa-onnx adapter that runs in the same on-device JNI runtime as Kokoro instead
 * of requiring an embedded Python interpreter on the phone. Everything above this interface
 * (UI, playback, library) is agnostic to which cloning backend fills it in.
 */
interface VoiceCloneEngine {
    fun observeDownloadProgress(): Flow<ModelDownloadState>

    suspend fun ensureModelReady()

    /** Registers a new clone voice from a short local reference recording. */
    suspend fun cloneFromSample(sampleAudioFile: File, displayName: String): Voice

    suspend fun listClonedVoices(): List<Voice>

    suspend fun deleteClonedVoice(voiceId: String)

    /** Synthesizes [text] in the given cloned [voice]; same chunked-WAV contract as TtsEngine. */
    suspend fun synthesize(text: String, voice: Voice, speed: Float, outputDir: File): List<File>
}
