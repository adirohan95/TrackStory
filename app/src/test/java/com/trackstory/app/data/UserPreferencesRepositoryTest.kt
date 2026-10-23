package com.trackstory.app.data

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.trackstory.app.ui.theme.resolvesToDark
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class UserPreferencesRepositoryTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun persistsPreferenceAcrossStoreRecreation() = runTest {
        val file = temporary.root.resolve("settings.preferences_pb")
        val firstJob = SupervisorJob()
        val firstStore = PreferenceDataStoreFactory.create(scope = CoroutineScope(Dispatchers.IO + firstJob)) { file }
        val first = UserPreferencesRepository(firstStore)
        assertEquals(ThemePreference.SYSTEM, first.theme.first())
        first.setTheme(ThemePreference.DARK)
        assertEquals(ThemePreference.DARK, first.theme.first())
        firstJob.cancelAndJoin()
        val secondJob = SupervisorJob()
        val secondStore = PreferenceDataStoreFactory.create(scope = CoroutineScope(Dispatchers.IO + secondJob)) { file }
        try {
            val second = UserPreferencesRepository(secondStore)
            assertEquals(ThemePreference.DARK, second.theme.first())
            second.setTheme(ThemePreference.LIGHT)
            assertEquals(ThemePreference.LIGHT, second.theme.first())
            secondStore.edit { it[stringPreferencesKey("theme")] = "unknown" }
            assertEquals(ThemePreference.SYSTEM, second.theme.first())
        } finally { secondJob.cancelAndJoin() }
    }

    @Test fun resolvesSystemAndExplicitModes() {
        assertTrue(ThemePreference.SYSTEM.resolvesToDark(true))
        assertFalse(ThemePreference.SYSTEM.resolvesToDark(false))
        assertTrue(ThemePreference.DARK.resolvesToDark(false))
        assertFalse(ThemePreference.LIGHT.resolvesToDark(true))
    }
}
