package com.trackstory.app.data.sync

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.trackstory.app.data.local.TrackedStoryEntity

class UpdateNotificationHelper(private val context: Context) {
    companion object { const val CHANNEL_ID = "story_updates" }
    private val manager = context.getSystemService(NotificationManager::class.java)

    init {
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Story updates", NotificationManager.IMPORTANCE_DEFAULT))
    }

    fun postUpdates(stories: List<TrackedStoryEntity>) {
        if (stories.isEmpty() || !manager.areNotificationsEnabled()) return
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val intent = Intent().setClassName(context, "com.trackstory.app.MainActivity")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val lines = stories.map { "${it.title} — Chapter ${it.latestChapter}: ${it.latestChapterTitle}" }
        val notification = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentTitle(if (stories.size == 1) stories.first().title else "${stories.size} stories updated")
            .setContentText(lines.first())
            .setStyle(Notification.BigTextStyle().bigText(lines.joinToString("\n")))
            .setContentIntent(pending).setAutoCancel(true).build()
        manager.notify(1, notification)
    }
}
