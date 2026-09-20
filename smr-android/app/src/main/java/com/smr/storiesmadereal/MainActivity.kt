package com.smr.storiesmadereal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.smr.storiesmadereal.ui.components.SmrDrawerContent
import com.smr.storiesmadereal.ui.navigation.SmrNavGraph
import com.smr.storiesmadereal.ui.theme.SmrTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SmrTheme {
                SmrApp()
            }
        }
    }
}

@Composable
private fun SmrApp() {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: "now_playing"

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            SmrDrawerContent(
                currentRoute = currentRoute,
                onNavigate = { destination ->
                    scope.launch { drawerState.close() }
                    navController.navigate(destination.route) {
                        launchSingleTop = true
                    }
                }
            )
        }
    ) {
        Surface(modifier = Modifier.fillMaxSize()) {
            SmrNavGraph(
                onOpenDrawer = { scope.launch { drawerState.open() } },
                navController = navController
            )
        }
    }
}
