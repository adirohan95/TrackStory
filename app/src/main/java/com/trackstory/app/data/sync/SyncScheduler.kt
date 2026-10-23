package com.trackstory.app.data.sync

import android.content.Context
import androidx.work.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import java.util.concurrent.TimeUnit

interface SyncController {
    val refreshing: Flow<Boolean>
    fun refresh()
}

class SyncScheduler(private val manager: WorkManager) : SyncController {
    constructor(context: Context) : this(WorkManager.getInstance(context))

    companion object {
        const val HOURLY_WORK = "hourly_story_sync"
        const val MANUAL_WORK = "manual_story_sync"
        const val SYNC_TAG = "story_sync"
        fun hourlyRequest() = PeriodicWorkRequestBuilder<StorySyncWorker>(1, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .addTag(SYNC_TAG).build()
        fun manualRequest() = OneTimeWorkRequestBuilder<StorySyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .addTag(SYNC_TAG).addTag(MANUAL_WORK).build()
    }

    override val refreshing = manager.getWorkInfosByTagFlow(SYNC_TAG).map { work ->
        work.any { it.state == WorkInfo.State.RUNNING ||
            (MANUAL_WORK in it.tags && it.state == WorkInfo.State.ENQUEUED) }
    }.distinctUntilChanged()

    fun scheduleHourly() { manager.enqueueUniquePeriodicWork(HOURLY_WORK, ExistingPeriodicWorkPolicy.KEEP, hourlyRequest()) }
    override fun refresh() { manager.enqueueUniqueWork(MANUAL_WORK, ExistingWorkPolicy.KEEP, manualRequest()) }
}
