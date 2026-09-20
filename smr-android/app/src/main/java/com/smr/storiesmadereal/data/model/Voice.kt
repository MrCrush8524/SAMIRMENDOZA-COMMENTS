package com.smr.storiesmadereal.data.model

/** A narration voice: either a system TTS voice or a locally cloned custom voice. */
data class Voice(
    val id: String,
    val displayName: String,
    val kind: VoiceKind = VoiceKind.SYSTEM,
    val previewSamplePath: String? = null
)

enum class VoiceKind {
    SYSTEM,
    LOCAL_CLONE
}
