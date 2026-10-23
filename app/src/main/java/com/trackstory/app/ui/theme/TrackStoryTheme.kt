package com.trackstory.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.trackstory.app.data.ThemePreference

fun ThemePreference.resolvesToDark(systemDark: Boolean) = when (this) {
    ThemePreference.SYSTEM -> systemDark
    ThemePreference.DARK -> true
    ThemePreference.LIGHT -> false
}

private val LightColors = lightColorScheme(primary = Color(0xFF8C2440), secondary = Color(0xFF70575E))
private val DarkColors = darkColorScheme(primary = Color(0xFFFFB1C2), secondary = Color(0xFFDEBDC5))

@Composable
fun TrackStoryTheme(preference: ThemePreference, content: @Composable () -> Unit) {
    val dark = preference.resolvesToDark(isSystemInDarkTheme())
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, content = content)
}
