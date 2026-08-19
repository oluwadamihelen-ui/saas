package com.cleansweep.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Primary = Color(0xFF1B5E4F)
private val PrimaryContainer = Color(0xFFA6F1D6)
private val Secondary = Color(0xFF4C6359)

private val LightColors = lightColorScheme(
    primary = Primary,
    primaryContainer = PrimaryContainer,
    secondary = Secondary,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8AD5BB),
    primaryContainer = Color(0xFF00513F),
    secondary = Color(0xFFB3CCC1),
)

@Composable
fun CleanSweepTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
