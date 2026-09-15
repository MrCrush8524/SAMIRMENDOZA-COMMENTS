package com.smr.storiesmadereal.data.claude

import com.smr.storiesmadereal.data.model.PlaybackMode

/**
 * Builds mode-specific prompts and turns Claude's response into a [NarrationScript] the TTS
 * layer can read line by line. Only excerpted manuscript text (never the full private
 * manuscript body) is sent per request, capped by [excerptCharLimit].
 */
class ClaudeRepository(
    private val apiClient: ClaudeApiClient,
    private val excerptCharLimit: Int = 12_000
) {
    suspend fun generateScript(
        manuscriptText: String,
        title: String,
        mode: PlaybackMode
    ): ClaudeScriptResult {
        require(mode != PlaybackMode.READ) { "Read mode narrates verbatim and never calls Claude" }

        val excerpt = manuscriptText.take(excerptCharLimit)
        val systemPrompt = systemPromptFor(mode)
        val userPrompt = "Title: $title\n\nManuscript excerpt:\n$excerpt"

        val result = apiClient.sendMessage(systemPrompt = systemPrompt, userPrompt = userPrompt)
        return result.fold(
            onSuccess = { text -> ClaudeScriptResult.Success(parseScript(text, mode)) },
            onFailure = { error -> ClaudeScriptResult.Failure(error.message ?: "Unknown Claude API error") }
        )
    }

    private fun systemPromptFor(mode: PlaybackMode): String = when (mode) {
        PlaybackMode.RETELL ->
            "You retell manuscripts in a warm, first-person narrator voice, preserving plot, " +
                "characters, and tone while tightening pacing. Output only the retelling, no preamble."
        PlaybackMode.SUMMARY ->
            "You summarize manuscripts concisely and accurately for a listener who wants the " +
                "key events and ideas in a few minutes of narration. Output only the summary, no preamble."
        PlaybackMode.PODCAST ->
            "You write a two-host podcast script discussing this manuscript, alternating natural, " +
                "conversational turns between HOST_A and HOST_B. Prefix every line with 'HOST_A:' or " +
                "'HOST_B:' and nothing else -- no stage directions, no preamble."
        PlaybackMode.READ -> error("unreachable")
    }

    private fun parseScript(rawText: String, mode: PlaybackMode): NarrationScript {
        if (mode != PlaybackMode.PODCAST) {
            return NarrationScript(listOf(ScriptLine(Speaker.NARRATOR, rawText.trim())))
        }
        val lines = rawText.lines().mapNotNull { line ->
            val trimmed = line.trim()
            when {
                trimmed.startsWith("HOST_A:") -> ScriptLine(Speaker.HOST_A, trimmed.removePrefix("HOST_A:").trim())
                trimmed.startsWith("HOST_B:") -> ScriptLine(Speaker.HOST_B, trimmed.removePrefix("HOST_B:").trim())
                trimmed.isBlank() -> null
                else -> null
            }
        }
        return NarrationScript(lines.ifEmpty { listOf(ScriptLine(Speaker.NARRATOR, rawText.trim())) })
    }
}
