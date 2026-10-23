package com.trackstory.app.data

import android.app.Application
import androidx.room.Room
import com.trackstory.app.data.local.TrackStoryDatabase
import com.trackstory.app.data.provider.*
import kotlinx.coroutines.test.runTest
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class StoryRepositoryTest {
    private lateinit var database: TrackStoryDatabase
    private lateinit var repository: StoryRepository
    private val provider = object : StoryProvider {
        override val providerId = "test"
        override val displayName = "Test"
        override val baseUrl = "https://example.org"
        override fun canHandleUrl(url: String) = url.startsWith("$baseUrl/works/1")
        override fun parseUrl(url: String) = if (canHandleUrl(url)) ParsedStoryUrl(providerId, "1", url.substringAfter("chapters/", "1")) else null
        override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl) = Result.success(RemoteStoryMetadata(
            providerId, "1", "A Story", "Writer", "$baseUrl/works/1",
            (1..10).map { ChapterInfo(it, "Chapter $it", "$baseUrl/works/1/chapters/$it") },
            parsed.chapterIdentifier?.toInt() ?: 1,
        ))
    }

    @Before fun setUp() {
        database = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), TrackStoryDatabase::class.java)
            .allowMainThreadQueries().build()
        repository = StoryRepository(database, StoryProviderRegistry(listOf(provider))) { 123L }
    }
    @After fun close() { database.close() }

    @Test fun addingAndReaddingPreservesOneRecordAndUpdatesProgress() = runTest {
        val first = repository.addOrUpdate("https://example.org/works/1/chapters/8")
        assertEquals(8, first.lastReadChapter)
        assertEquals(2, first.unreadCount)
        assertTrue(first.nextChapterUrl!!.endsWith("/9"))
        val second = repository.addOrUpdate("https://example.org/works/1/chapters/10")
        assertEquals(first.id, second.id)
        assertEquals(1, repository.allStories().size)
        assertEquals(0, second.unreadCount)
    }

    @Test fun scrollRestoresOnSameChapterAndResetsOnNavigation() = runTest {
        val first = repository.addOrUpdate("https://example.org/works/1/chapters/8")
        repository.saveScroll(first.id, first.lastReadUrl, 400)
        assertEquals(400, repository.recordPage(first.lastReadUrl)!!.lastReadScrollY)
        val advanced = repository.recordPage("https://example.org/works/1/chapters/9")!!
        assertEquals(9, advanced.lastReadChapter)
        assertEquals(0, advanced.lastReadScrollY)
        repository.saveScroll(first.id, first.lastReadUrl, 999)
        assertEquals(0, repository.story(first.id)!!.lastReadScrollY)
        assertNull(repository.recordPage("https://example.org/users/writer"))
    }

    @Test fun manualAdjustmentAndDeletion() = runTest {
        val first = repository.addOrUpdate("https://example.org/works/1")
        assertEquals(10, repository.adjustChapter(first.id, 99)!!.lastReadChapter)
        assertEquals(1, repository.adjustChapter(first.id, 0)!!.lastReadChapter)
        repository.delete(first.id)
        assertTrue(repository.allStories().isEmpty())
    }

    @Test fun syncAndErrorsPreserveReadingProgress() = runTest {
        val first = repository.addOrUpdate("https://example.org/works/1/chapters/8")
        repository.saveScroll(first.id, first.lastReadUrl, 400)
        repository.reportSyncError(first.id, AuthenticationRequiredException())
        assertNotNull(repository.story(first.id)!!.syncError)
        val synced = repository.applySync(first.id, repository.metadata(first.workUrl))!!
        assertEquals(8, synced.lastReadChapter)
        assertEquals(400, synced.lastReadScrollY)
        assertNull(synced.syncError)
    }

    @Test fun unsupportedInputDoesNotInsert() = runTest {
        assertTrue(runCatching { repository.addOrUpdate("https://unknown.org/1") }.isFailure)
        assertTrue(repository.allStories().isEmpty())
    }
}
