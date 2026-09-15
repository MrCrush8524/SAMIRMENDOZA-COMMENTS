package com.smr.storiesmadereal.ui.navigation

sealed class SmrDestination(val route: String) {
    data object NowPlaying : SmrDestination("now_playing")
    data object Library : SmrDestination("library")
    data object Voices : SmrDestination("voices")
    data object CustomVoice : SmrDestination("custom_voice")
    data object Settings : SmrDestination("settings")
}
