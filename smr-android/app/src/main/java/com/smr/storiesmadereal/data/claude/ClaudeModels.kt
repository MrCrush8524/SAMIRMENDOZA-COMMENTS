package com.smr.storiesmadereal.data.claude

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ClaudeMessageRequest(
    val model: String,
    @SerialName("max_tokens") val maxTokens: Int,
    val system: String? = null,
    val messages: List<ClaudeMessage>
)

@Serializable
data class ClaudeMessage(
    val role: String,
    val content: String
)

@Serializable
data class ClaudeMessageResponse(
    val id: String = "",
    val content: List<ClaudeContentBlock> = emptyList(),
    @SerialName("stop_reason") val stopReason: String? = null
)

@Serializable
data class ClaudeContentBlock(
    val type: String,
    val text: String = ""
)

@Serializable
data class ClaudeErrorResponse(
    val type: String = "",
    val error: ClaudeErrorDetail? = null
)

@Serializable
data class ClaudeErrorDetail(
    val type: String = "",
    val message: String = ""
)

/** Result of a Retell/Summary/Podcast generation call. */
sealed class ClaudeScriptResult {
    data class Success(val script: NarrationScript) : ClaudeScriptResult()
    data class Failure(val message: String) : ClaudeScriptResult()
}

/** A generated script ready for TTS. Podcast mode carries per-line speaker tags for the two hosts. */
data class NarrationScript(
    val lines: List<ScriptLine>
)

data class ScriptLine(
    val speaker: Speaker,
    val text: String
)

enum class Speaker { NARRATOR, HOST_A, HOST_B }
