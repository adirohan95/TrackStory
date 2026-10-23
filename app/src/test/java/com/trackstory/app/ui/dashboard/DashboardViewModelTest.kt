package com.trackstory.app.ui.dashboard

import android.app.Application
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.lifecycle.viewModelScope
import androidx.room.Room
import com.trackstory.app.data.*
import com.trackstory.app.data.local.TrackStoryDatabase
import com.trackstory.app.data.provider.*
import com.trackstory.app.data.sync.SyncController
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.junit.rules.TemporaryFolder
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class DashboardViewModelTest {
    @get:Rule val temporary = TemporaryFolder()
    private lateinit var database: TrackStoryDatabase
    private lateinit var model: DashboardViewModel
    private lateinit var preferenceJob: Job
    private val refreshing = MutableStateFlow(false)
    private val provider = object : StoryProvider {
        override val providerId = "test"
        override val displayName = "Test"
        override val baseUrl = "https://example.org"
        override fun canHandleUrl(url: String) = url.startsWith("$baseUrl/works/1")
        override fun parseUrl(url: String) = if (canHandleUrl(url)) ParsedStoryUrl("test", "1", url.substringAfterLast('/')) else null
        override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl) = Result.success(RemoteStoryMetadata("test", "1", "Story", "Author", "$baseUrl/works/1",
            (1..2).map { ChapterInfo(it, "Chapter $it", "$baseUrl/works/1/$it") }, parsed.chapterIdentifier!!.toInt()))
    }

    @Before fun prepare() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        database = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), TrackStoryDatabase::class.java).allowMainThreadQueries().build()
        preferenceJob = SupervisorJob()
        val store = PreferenceDataStoreFactory.create(scope = CoroutineScope(Dispatchers.IO + preferenceJob)) { temporary.root.resolve("settings.preferences_pb") }
        model = DashboardViewModel(StoryRepository(database, StoryProviderRegistry(listOf(provider))), UserPreferencesRepository(store), object : SyncController {
            override val refreshing = this@DashboardViewModelTest.refreshing
            override fun refresh() { refreshing.value = true }
        })
    }
    @After fun close() = runBlocking {
        model.viewModelScope.cancel()
        preferenceJob.cancelAndJoin()
        database.close()
        Dispatchers.resetMain()
    }

    @Test fun addingAdjustingAndDeletingMovesBetweenSections() = runTest {
        model.addUrl("https://example.org/works/1/1").join()
        val unread = model.state.first { it.updates.size == 1 }
        assertEquals(1, unread.updates.single().unreadCount)
        model.adjustChapter(unread.stories.single().id, 2).join()
        assertEquals(0, model.state.first { it.caughtUp.size == 1 }.updates.size)
        model.delete(unread.stories.single().id).join()
        assertTrue(model.state.first { it.stories.isEmpty() }.updates.isEmpty())
    }

    @Test fun unsupportedInputIsAnErrorAndDoesNotCreateStory() = runTest {
        model.addUrl("bad URL").join()
        assertNotNull(model.state.first { it.error != null }.error)
        assertTrue(model.state.value.stories.isEmpty())
        model.dismissError()
        model.state.first { it.error == null }
    }

    @Test fun refreshAndThemeChangesReachUiState() = runTest {
        model.refresh()
        assertTrue(model.state.first { it.refreshing }.refreshing)
        refreshing.value = false
        model.state.first { !it.refreshing }
        model.setTheme(ThemePreference.DARK).join()
        assertEquals(ThemePreference.DARK, model.state.first { it.theme == ThemePreference.DARK }.theme)
    }
}
