package com.trackstory.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import java.io.IOException

val Context.userPreferences by preferencesDataStore(name = "user_preferences")

enum class ThemePreference { SYSTEM, LIGHT, DARK }

class UserPreferencesRepository(private val store: DataStore<Preferences>) {
    private val themeKey = stringPreferencesKey("theme")
    val theme = store.data.catch { error ->
        if (error is IOException) emit(emptyPreferences()) else throw error
    }.map { values ->
        ThemePreference.entries.firstOrNull { it.name == values[themeKey] } ?: ThemePreference.SYSTEM
    }.distinctUntilChanged()

    suspend fun setTheme(theme: ThemePreference) { store.edit { it[themeKey] = theme.name } }
}
