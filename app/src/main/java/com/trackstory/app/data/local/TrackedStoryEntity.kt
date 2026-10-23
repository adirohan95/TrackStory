package com.trackstory.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "tracked_stories", indices = [Index(value = ["providerId", "externalStoryId"], unique = true)])
data class TrackedStoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val providerId: String,
    val externalStoryId: String,
    val title: String,
    val author: String,
    val workUrl: String,
    val lastReadChapter: Int,
    val lastReadChapterTitle: String,
    val lastReadUrl: String,
    val lastReadScrollY: Int = 0,
    val nextChapterUrl: String? = null,
    val latestChapter: Int,
    val latestChapterTitle: String,
    val latestUrl: String,
    val latestPublishDate: String? = null,
    val lastCheckedAt: Long,
    val lastUpdatedAt: Long,
    val syncError: String? = null,
) {
    val unreadCount: Int get() = (latestChapter - lastReadChapter).coerceAtLeast(0)
}
