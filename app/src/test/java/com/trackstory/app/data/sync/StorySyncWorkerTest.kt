package com.trackstory.app.data.sync

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.work.*
import androidx.work.testing.TestListenableWorkerBuilder
import com.trackstory.app.data.StoryRepository
import com.trackstory.app.data.local.*
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
class StorySyncWorkerTest {
    private lateinit var database: TrackStoryDatabase
    private lateinit var repository: StoryRepository
    private val calls = mutableListOf<String>()
    private val sleeps = mutableListOf<Long>()
    private val notifications = mutableListOf<TrackedStoryEntity>()
    private var chapterCount = 1
    private var rateLimited = false

    private fun provider(id: String) = object : StoryProvider {
        override val providerId = id
        override val displayName = id
        override val baseUrl = "https://$id.example"
        override fun canHandleUrl(url: String) = url.startsWith("$baseUrl/")
        override fun parseUrl(url: String) = if (canHandleUrl(url)) ParsedStoryUrl(id, url.substringAfterLast('/')) else null
        override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl): Result<RemoteStoryMetadata> {
            calls += "$id:${parsed.externalStoryId}"
            if (rateLimited && id == "a") return Result.failure(ProviderHttpException(429))
            return Result.success(RemoteStoryMetadata(id, parsed.externalStoryId, "Story ${parsed.externalStoryId}", "Writer", "$baseUrl/${parsed.externalStoryId}",
                (1..chapterCount).map { ChapterInfo(it, "Chapter $it", "$baseUrl/${parsed.externalStoryId}?chapter=$it") }))
        }
    }

    @Before fun prepare() {
        database = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), TrackStoryDatabase::class.java).allowMainThreadQueries().build()
        repository = StoryRepository(database, StoryProviderRegistry(listOf(provider("a"), provider("b"))))
    }
    @After fun close() { database.close() }

    private fun worker(): StorySyncWorker {
        val engine = StorySyncEngine(repository, { notifications.addAll(it) }, { sleeps += it })
        return TestListenableWorkerBuilder<StorySyncWorker>(RuntimeEnvironment.getApplication()).setWorkerFactory(object : WorkerFactory() {
            override fun createWorker(appContext: Context, workerClassName: String, workerParameters: WorkerParameters) = StorySyncWorker(appContext, workerParameters, engine)
        }).build()
    }

    @Test fun newChapterUpdatesStorageAndNotifiesOnce() = runTest {
        repository.addOrUpdate("https://a.example/1")
        repository.addOrUpdate("https://a.example/2")
        calls.clear()
        chapterCount = 2
        assertEquals(ListenableWorker.Result.success(), worker().doWork())
        assertEquals(listOf(2_000L), sleeps)
        assertEquals(2, notifications.size)
        assertTrue(repository.allStories().all { it.latestChapter == 2 && it.lastReadChapter == 1 })
        notifications.clear()
        worker().doWork()
        assertTrue(notifications.isEmpty())
    }

    @Test fun rateLimitStopsThatProviderButChecksOthers() = runTest {
        repository.addOrUpdate("https://a.example/1")
        repository.addOrUpdate("https://a.example/2")
        repository.addOrUpdate("https://b.example/3")
        calls.clear()
        rateLimited = true
        chapterCount = 2
        assertEquals(ListenableWorker.Result.retry(), worker().doWork())
        assertEquals(listOf("a:1", "b:3"), calls)
        assertTrue(sleeps.isEmpty())
        assertEquals(1, repository.find("https://a.example/1")!!.latestChapter)
        assertEquals(1, repository.find("https://a.example/2")!!.latestChapter)
        assertNotNull(repository.find("https://a.example/1")!!.syncError)
        assertEquals(2, repository.find("https://b.example/3")!!.latestChapter)
        assertEquals(1, notifications.size)
    }
}
