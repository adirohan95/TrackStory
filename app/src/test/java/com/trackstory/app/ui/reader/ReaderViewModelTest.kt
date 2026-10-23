package com.trackstory.app.ui.reader

import android.app.Application
import androidx.lifecycle.viewModelScope
import androidx.room.Room
import com.trackstory.app.data.StoryRepository
import com.trackstory.app.data.local.TrackStoryDatabase
import com.trackstory.app.data.provider.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class ReaderViewModelTest {
    private lateinit var database: TrackStoryDatabase
    private lateinit var repository: StoryRepository
    private lateinit var model: ReaderViewModel
    private lateinit var persistence: CoroutineScope
    private val url = "https://example.org/works/1/chapters/2"
    private val provider = object : StoryProvider {
        override val providerId = "test"
        override val displayName = "Test"
        override val baseUrl = "https://example.org"
        override fun canHandleUrl(url: String) = url.startsWith("$baseUrl/works/1")
        override fun parseUrl(url: String) = if (canHandleUrl(url)) ParsedStoryUrl("test", "1", url.substringAfterLast('/')) else null
        override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl) = Result.success(RemoteStoryMetadata("test", "1", "Story", "Writer", "$baseUrl/works/1",
            (1..3).map { ChapterInfo(it, "Chapter $it", "$baseUrl/works/1/chapters/$it") }, parsed.chapterIdentifier!!.toInt()))
    }

    @Before fun prepare() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        database = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), TrackStoryDatabase::class.java).allowMainThreadQueries().build()
        repository = StoryRepository(database, StoryProviderRegistry(listOf(provider)))
        persistence = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        model = ReaderViewModel(repository, url, persistence)
    }
    @After fun close() = runBlocking { model.viewModelScope.cancel(); persistence.coroutineContext[Job]!!.cancelAndJoin(); database.close(); Dispatchers.resetMain() }

    @Test fun trackingAddsTheCurrentlyOpenChapter() = runTest {
        model.pageStarted(url)
        model.pageFinished(url).join()
        assertTrue(model.state.value.supported)
        assertNull(model.state.value.story)
        model.track().join()
        assertEquals(2, model.state.value.story!!.lastReadChapter)
        assertEquals(1, repository.allStories().size)
    }

    @Test fun nonStoryNavigationDoesNotAlterSavedProgress() = runTest {
        repository.addOrUpdate(url)
        val profile = "https://example.org/users/writer"
        model.pageStarted(profile)
        model.pageFinished(profile).join()
        assertFalse(model.state.value.supported)
        assertNull(model.state.value.story)
        assertEquals(2, repository.allStories().single().lastReadChapter)
    }

    @Test fun existingStoryShowsSavedChapterStatus() = runTest {
        repository.addOrUpdate(url)
        model.pageStarted(url)
        model.pageFinished(url).join()
        assertEquals(2, model.state.value.story!!.lastReadChapter)
        assertFalse(model.state.value.loading)
    }

    @Test fun advancingChaptersUpdatesProgressAndResetsScroll() = runTest {
        val first = repository.addOrUpdate(url)
        repository.saveScroll(first.id, first.lastReadUrl, 450)
        model.pageStarted(url)
        model.pageFinished(url).join()
        assertEquals(450, model.state.value.restore!!.scrollY)
        val next = "https://example.org/works/1/chapters/3"
        model.pageStarted(next)
        model.pageFinished(next).join()
        assertEquals(3, model.state.value.story!!.lastReadChapter)
        assertEquals(next, repository.story(first.id)!!.lastReadUrl)
        assertEquals(0, model.state.value.restore!!.scrollY)
    }

    @Test fun scrollIsDebouncedAndFlushSurvivesClosingReader() = runTest {
        val first = repository.addOrUpdate(url)
        model.pageStarted(url)
        model.pageFinished(url).join()
        model.scrollChanged(100)
        model.scrollChanged(700)
        assertEquals(0, runBlocking { repository.story(first.id)!!.lastReadScrollY })
        val saved = model.flushScroll()
        model.viewModelScope.cancel()
        saved!!.join()
        assertEquals(700, repository.story(first.id)!!.lastReadScrollY)
    }

    @Test fun scrollSavesAfterTheDebounceInterval() = runTest {
        val first = repository.addOrUpdate(url)
        model.pageStarted(url)
        model.pageFinished(url).join()
        model.scrollChanged(100)
        advanceTimeBy(200)
        model.scrollChanged(800)
        advanceTimeBy(349)
        assertEquals(0, runBlocking { repository.story(first.id)!!.lastReadScrollY })
        advanceTimeBy(1)
        runCurrent()
        persistence.coroutineContext[Job]!!.children.toList().joinAll()
        assertEquals(800, repository.story(first.id)!!.lastReadScrollY)
    }

    @Test fun stalePageFinishedDoesNotMoveProgressBackwards() = runTest {
        repository.addOrUpdate(url)
        val next = "https://example.org/works/1/chapters/3"
        model.pageStarted(next)
        model.pageFinished(next).join()
        model.pageFinished(url).join()
        assertEquals(3, repository.allStories().single().lastReadChapter)
    }
}
