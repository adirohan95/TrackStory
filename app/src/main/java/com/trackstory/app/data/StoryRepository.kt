package com.trackstory.app.data

import androidx.room.withTransaction
import com.trackstory.app.data.local.*
import com.trackstory.app.data.provider.*

class StoryRepository(
    private val database: TrackStoryDatabase,
    val providers: StoryProviderRegistry,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val dao = database.stories()
    val stories = dao.observeAll()
    suspend fun allStories() = dao.getAll()
    suspend fun story(id: Long) = dao.getById(id)
    suspend fun find(url: String): TrackedStoryEntity? {
        val parsed = providers.providerForUrl(url)?.parseUrl(url) ?: return null
        return dao.find(parsed.providerId, parsed.externalStoryId)
    }

    suspend fun metadata(url: String): RemoteStoryMetadata {
        val (provider, parsed) = providers.resolve(url)
        return provider.fetchStoryMetadata(parsed).getOrThrow()
    }

    suspend fun addOrUpdate(url: String): TrackedStoryEntity = applyReading(metadata(url))

    private suspend fun applyReading(remote: RemoteStoryMetadata): TrackedStoryEntity = database.withTransaction {
        val existing = dao.find(remote.providerId, remote.externalStoryId)
        val timestamp = now()
        val chapter = remote.matchedChapter
        val entity = TrackedStoryEntity(
            id = existing?.id ?: 0,
            providerId = remote.providerId, externalStoryId = remote.externalStoryId,
            title = remote.title, author = remote.author, workUrl = remote.workUrl,
            lastReadChapter = chapter.number, lastReadChapterTitle = chapter.title, lastReadUrl = chapter.url,
            lastReadScrollY = if (existing?.lastReadUrl == chapter.url) existing.lastReadScrollY else 0,
            nextChapterUrl = remote.chapters.getOrNull(chapter.number)?.url,
            latestChapter = remote.latestChapterNumber, latestChapterTitle = remote.latestChapter.title,
            latestUrl = remote.latestChapter.url, latestPublishDate = remote.latestChapter.publishDate,
            lastCheckedAt = timestamp, lastUpdatedAt = timestamp,
        )
        if (existing == null) entity.copy(id = dao.insert(entity)) else entity.also { dao.update(it) }
    }

    suspend fun recordPage(url: String): TrackedStoryEntity? {
        val current = find(url) ?: return null
        val remote = metadata(url)
        // A deletion during the network request must not recreate the story.
        return database.withTransaction {
            if (dao.getById(current.id) == null) null else applyReading(remote)
        }
    }

    suspend fun adjustChapter(id: Long, chapter: Int): TrackedStoryEntity? {
        val existing = dao.getById(id) ?: return null
        val remote = metadata(existing.workUrl)
        val selected = chapter.coerceIn(1, remote.latestChapterNumber)
        return database.withTransaction {
            if (dao.getById(id) == null) null else applyReading(remote.copy(matchedChapterNumber = selected))
        }
    }

    suspend fun saveScroll(id: Long, chapterUrl: String, scrollY: Int) =
        dao.updateScroll(id, chapterUrl, scrollY.coerceAtLeast(0))

    suspend fun delete(id: Long) = dao.delete(id)
    suspend fun reportSyncError(id: Long, error: Throwable) =
        dao.updateSyncError(id, error.message ?: "Unable to check story", now())

    suspend fun applySync(id: Long, remote: RemoteStoryMetadata): TrackedStoryEntity? = database.withTransaction {
        val current = dao.getById(id) ?: return@withTransaction null
        require(current.providerId == remote.providerId && current.externalStoryId == remote.externalStoryId)
        current.copy(
            title = remote.title, author = remote.author,
            latestChapter = remote.latestChapterNumber, latestChapterTitle = remote.latestChapter.title,
            latestUrl = remote.latestChapter.url, latestPublishDate = remote.latestChapter.publishDate,
            nextChapterUrl = remote.chapters.getOrNull(current.lastReadChapter)?.url,
            lastCheckedAt = now(),
            lastUpdatedAt = if (remote.latestChapterNumber > current.latestChapter) now() else current.lastUpdatedAt,
            syncError = null,
        ).also { dao.update(it) }
    }
}
