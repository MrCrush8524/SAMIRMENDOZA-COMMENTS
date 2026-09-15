package com.smr.storiesmadereal.data.model

/** A narration voice: either a bundled Kokoro voice or a locally cloned custom voice. */
data class Voice(
    val id: String,
    val displayName: String,
    val kind: VoiceKind,
    val previewSamplePath: String? = null
)

enum class VoiceKind {
    KOKORO_STANDARD,
    LOCAL_CLONE,
    PODCAST_HOST_A,
    PODCAST_HOST_B
}

/** Built-in Kokoro voices shipped with the quantized model bundle. */
object BuiltInVoices {
    val list = listOf(
        Voice("kokoro_af_heart", "Heart (Warm)", VoiceKind.KOKORO_STANDARD),
        Voice("kokoro_af_bella", "Bella (Bright)", VoiceKind.KOKORO_STANDARD),
        Voice("kokoro_am_michael", "Michael (Even)", VoiceKind.KOKORO_STANDARD),
        Voice("kokoro_bm_george", "George (Low)", VoiceKind.KOKORO_STANDARD)
    )

    val podcastHostA = Voice("kokoro_af_bella", "Host A", VoiceKind.PODCAST_HOST_A)
    val podcastHostB = Voice("kokoro_am_michael", "Host B", VoiceKind.PODCAST_HOST_B)
}
