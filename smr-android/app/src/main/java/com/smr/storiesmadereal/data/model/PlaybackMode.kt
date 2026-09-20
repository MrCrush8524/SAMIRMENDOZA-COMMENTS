package com.smr.storiesmadereal.data.model

/**
 * Read narrates the manuscript verbatim through the local TTS engine.
 * Retell, Summary, and Podcast route the manuscript through Claude first
 * (see ClaudeRepository) and narrate the returned script.
 */
enum class PlaybackMode(val label: String) {
    READ("Read"),
    RETELL("Retell"),
    SUMMARY("Summary"),
    PODCAST("Podcast")
}

enum class AudioFocusMode {
    MIX,
    DUCK,
    PAUSE;

    companion object {
        val default = MIX
    }
}
