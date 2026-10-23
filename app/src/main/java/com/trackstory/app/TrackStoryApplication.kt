package com.trackstory.app

import android.app.Application
import com.trackstory.app.data.sync.SyncScheduler

class TrackStoryApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
    override fun onCreate() {
        super.onCreate()
        SyncScheduler(this).scheduleHourly()
    }
}
