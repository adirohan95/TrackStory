package com.trackstory.app.data.sync

import android.app.Application
import androidx.work.*
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class SyncSchedulerTest {
    @Test fun workRequestsRequireNetworkAndUseHourlyInterval() {
        val hourly = SyncScheduler.hourlyRequest()
        assertEquals(TimeUnit.HOURS.toMillis(1), hourly.workSpec.intervalDuration)
        assertEquals(NetworkType.CONNECTED, hourly.workSpec.constraints.requiredNetworkType)
        assertTrue(hourly.workSpec.isPeriodic)
        val manual = SyncScheduler.manualRequest()
        assertFalse(manual.workSpec.isPeriodic)
        assertEquals(0L, manual.workSpec.initialDelay)
        assertEquals(NetworkType.CONNECTED, manual.workSpec.constraints.requiredNetworkType)
    }

    @Test fun repeatedStartupKeepsExistingPeriodicWork() {
        val context = RuntimeEnvironment.getApplication()
        WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().build())
        val manager = WorkManager.getInstance(context)
        try {
            val scheduler = SyncScheduler(manager)
            scheduler.scheduleHourly()
            val first = manager.getWorkInfosForUniqueWork(SyncScheduler.HOURLY_WORK).get(10, TimeUnit.SECONDS).single().id
            scheduler.scheduleHourly()
            val second = manager.getWorkInfosForUniqueWork(SyncScheduler.HOURLY_WORK).get(10, TimeUnit.SECONDS)
            assertEquals(1, second.size)
            assertEquals(first, second.single().id)
        } finally { WorkManagerTestInitHelper.closeWorkDatabase() }
    }
}
