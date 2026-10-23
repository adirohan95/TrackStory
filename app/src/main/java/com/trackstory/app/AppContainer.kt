package com.trackstory.app

import android.content.Context
import androidx.room.Room
import com.trackstory.app.data.*
import com.trackstory.app.data.local.TrackStoryDatabase
import com.trackstory.app.data.provider.*
import com.trackstory.app.data.sync.*
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class AppContainer(context: Context) {
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder().cookieJar(SharedCookieJar())
        .callTimeout(30, TimeUnit.SECONDS).build()
    val providers = StoryProviderRegistry(listOf(Ao3Provider(client)))
    private val database = Room.databaseBuilder(context, TrackStoryDatabase::class.java, "trackstory.db").build()
    val stories = StoryRepository(database, providers)
    val preferences = UserPreferencesRepository(context.userPreferences)
    val notifications = UpdateNotificationHelper(context)
    val syncEngine = StorySyncEngine(stories, notifications::postUpdates)
}
