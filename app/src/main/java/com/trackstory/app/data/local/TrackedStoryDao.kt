package com.trackstory.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackedStoryDao {
    @Query("SELECT * FROM tracked_stories ORDER BY lastUpdatedAt DESC, title COLLATE NOCASE")
    fun observeAll(): Flow<List<TrackedStoryEntity>>

    @Query("SELECT * FROM tracked_stories ORDER BY providerId, id")
    suspend fun getAll(): List<TrackedStoryEntity>

    @Query("SELECT * FROM tracked_stories WHERE id = :id")
    suspend fun getById(id: Long): TrackedStoryEntity?

    @Query("SELECT * FROM tracked_stories WHERE providerId = :providerId AND externalStoryId = :externalStoryId")
    suspend fun find(providerId: String, externalStoryId: String): TrackedStoryEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(story: TrackedStoryEntity): Long

    @Update
    suspend fun update(story: TrackedStoryEntity)

    @Query("DELETE FROM tracked_stories WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE tracked_stories SET lastReadScrollY = :scrollY WHERE id = :id AND lastReadUrl = :chapterUrl")
    suspend fun updateScroll(id: Long, chapterUrl: String, scrollY: Int)

    @Query("UPDATE tracked_stories SET syncError = :message, lastCheckedAt = :checkedAt WHERE id = :id")
    suspend fun updateSyncError(id: Long, message: String, checkedAt: Long)
}
