package com.trackstory.app

import android.content.Context
import android.content.Intent
import androidx.core.net.toUri
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object StoryIntents {
    fun extractSharedUrl(intent: Intent?): String? {
        if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") return null
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: return null
        return Regex("https?://[^\\s<>\"']+", RegexOption.IGNORE_CASE).findAll(text)
            .map { it.value.trimEnd('.', ',', ';', ')', ']', '}') }
            .firstOrNull { it.toHttpUrlOrNull() != null }
    }

    fun browserIntent(url: String): Intent {
        require(url.toHttpUrlOrNull() != null) { "Invalid browser URL" }
        return Intent(Intent.ACTION_VIEW, url.toUri()).addCategory(Intent.CATEGORY_BROWSABLE)
    }

    fun openBrowser(context: Context, url: String) { context.startActivity(browserIntent(url)) }
}
