package com.smr.storiesmadereal.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smr.storiesmadereal.ui.screens.library.LibraryScreen
import com.smr.storiesmadereal.ui.screens.nowplaying.NowPlayingScreen
import com.smr.storiesmadereal.ui.screens.settings.SettingsScreen
import com.smr.storiesmadereal.ui.screens.voices.CustomVoiceScreen
import com.smr.storiesmadereal.ui.screens.voices.VoicesScreen

@Composable
fun SmrNavGraph(
    onOpenDrawer: () -> Unit,
    navController: NavHostController = rememberNavController()
) {
    NavHost(navController = navController, startDestination = SmrDestination.NowPlaying.route) {
        composable(SmrDestination.NowPlaying.route) {
            NowPlayingScreen(onOpenDrawer = onOpenDrawer, onOpenLibrary = {
                navController.navigate(SmrDestination.Library.route)
            })
        }
        composable(SmrDestination.Library.route) {
            LibraryScreen(
                onOpenDrawer = onOpenDrawer,
                onManuscriptSelected = { navController.popBackStack(SmrDestination.NowPlaying.route, false) }
            )
        }
        composable(SmrDestination.Voices.route) {
            VoicesScreen(
                onOpenDrawer = onOpenDrawer,
                onAddCustomVoice = { navController.navigate(SmrDestination.CustomVoice.route) }
            )
        }
        composable(SmrDestination.CustomVoice.route) {
            CustomVoiceScreen(onDone = { navController.popBackStack() })
        }
        composable(SmrDestination.Settings.route) {
            SettingsScreen(onOpenDrawer = onOpenDrawer)
        }
    }
}
