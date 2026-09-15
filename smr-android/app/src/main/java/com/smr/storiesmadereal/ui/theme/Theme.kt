package com.smr.storiesmadereal.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// SMR only ships a dark theme -- the design is locked to the dreamy pastel-on-midnight look
// regardless of system theme, the same way a dedicated reading app keeps its own palette.
private val SmrColorScheme = darkColorScheme(
    primary = SmrPalette.Lavender,
    onPrimary = SmrPalette.Base,
    secondary = SmrPalette.Teal,
    onSecondary = SmrPalette.Base,
    background = SmrPalette.Base,
    onBackground = SmrPalette.Cream,
    surface = SmrPalette.BaseElevated,
    onSurface = SmrPalette.Cream,
    surfaceVariant = SmrPalette.BaseSunken,
    onSurfaceVariant = SmrPalette.CreamDim,
    outline = SmrPalette.Divider,
    error = SmrPalette.Error
)

@Composable
fun SmrTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        val window = (view.context as? android.app.Activity)?.window
        window?.let {
            it.statusBarColor = SmrPalette.Base.toArgb()
            it.navigationBarColor = SmrPalette.Base.toArgb()
            WindowCompat.getInsetsController(it, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = SmrColorScheme,
        typography = SmrTypography,
        content = content
    )
}
