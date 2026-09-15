package com.smr.storiesmadereal.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smr.storiesmadereal.ui.navigation.SmrDestination
import com.smr.storiesmadereal.ui.theme.SmrPalette

@Composable
fun SmrDrawerContent(
    currentRoute: String,
    onNavigate: (SmrDestination) -> Unit
) {
    ModalDrawerSheet(drawerContainerColor = SmrPalette.BaseSunken) {
        Column(modifier = Modifier.padding(vertical = 24.dp)) {
            Text(
                text = "SMR",
                style = androidx.compose.material3.MaterialTheme.typography.headlineMedium,
                color = SmrPalette.Lavender,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
            Text(
                text = "Stories Made Real",
                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                color = SmrPalette.CreamDim,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
            Spacer(Modifier.height(24.dp))
            HorizontalDivider(color = SmrPalette.Divider)
            Spacer(Modifier.height(8.dp))

            drawerItem(SmrDestination.NowPlaying, "Now Playing", Icons.Filled.AutoStories, currentRoute, onNavigate)
            drawerItem(SmrDestination.Library, "Library", Icons.Filled.LibraryBooks, currentRoute, onNavigate)
            drawerItem(SmrDestination.Voices, "Voices", Icons.Filled.RecordVoiceOver, currentRoute, onNavigate)
            drawerItem(SmrDestination.Settings, "Settings", Icons.Filled.Settings, currentRoute, onNavigate)
        }
    }
}

@Composable
private fun drawerItem(
    destination: SmrDestination,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    currentRoute: String,
    onNavigate: (SmrDestination) -> Unit
) {
    NavigationDrawerItem(
        label = { Text(label) },
        icon = { Icon(icon, contentDescription = null) },
        selected = currentRoute == destination.route,
        onClick = { onNavigate(destination) },
        colors = NavigationDrawerItemDefaults.colors(
            selectedContainerColor = SmrPalette.BaseElevated,
            selectedTextColor = SmrPalette.Lavender,
            selectedIconColor = SmrPalette.Lavender,
            unselectedTextColor = SmrPalette.CreamDim,
            unselectedIconColor = SmrPalette.CreamDim
        ),
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
    )
}
