package com.trackstory.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [TrackedStoryEntity::class], version = 1, exportSchema = true)
abstract class TrackStoryDatabase : RoomDatabase() {
    abstract fun stories(): TrackedStoryDao
}
