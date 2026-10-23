package com.trackstory.app.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.trackstory.app.TrackStoryApplication
import com.trackstory.app.data.StoryRepository
import com.trackstory.app.data.local.TrackedStoryEntity
import com.trackstory.app.data.provider.ProviderHttpException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class StorySyncEngine(
    private val repository: StoryRepository,
    private val notify: (List<TrackedStoryEntity>) -> Unit,
    private val pause: suspend (Long) -> Unit = { delay(it) },
) {
    private val mutex = Mutex()

    suspend fun sync(): Boolean = mutex.withLock {
        val attempted = mutableSetOf<String>()
        val blocked = mutableSetOf<String>()
        val updated = mutableListOf<TrackedStoryEntity>()
        var retry = false
        for (story in repository.allStories()) {
            if (story.providerId in blocked) continue
            if (!attempted.add(story.providerId)) pause(2_000)
            if (repository.story(story.id) == null) continue
            try {
                val remote = repository.metadata(story.workUrl)
                val saved = repository.applySync(story.id, remote)
                if (saved != null && remote.latestChapterNumber > story.latestChapter) updated += saved
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                repository.reportSyncError(story.id, error)
                if (error is ProviderHttpException && error.statusCode == 429) {
                    blocked += story.providerId
                    retry = true
                } else if (error is java.io.IOException || (error is ProviderHttpException && error.statusCode >= 500)) {
                    retry = true
                }
            }
        }
        notify(updated)
        !retry
    }
}

class StorySyncWorker(
    context: Context,
    parameters: WorkerParameters,
    private val engine: StorySyncEngine,
) : CoroutineWorker(context, parameters) {
    constructor(context: Context, parameters: WorkerParameters) : this(
        context, parameters, (context.applicationContext as TrackStoryApplication).container.syncEngine,
    )

    override suspend fun doWork(): Result = if (engine.sync()) Result.success() else Result.retry()
}
