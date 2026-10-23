package com.trackstory.app

import android.app.Application
import android.content.Intent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class StoryIntentsTest {
    @Test fun extractsUrlFromBrowserShareText() {
        val url = "https://archiveofourown.org/works/123/chapters/999?view_adult=true"
        val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "A story\n($url).")
        assertEquals(url, StoryIntents.extractSharedUrl(intent))
    }

    @Test fun ignoresOtherActionsTypesAndMissingText() {
        assertNull(StoryIntents.extractSharedUrl(null))
        assertNull(StoryIntents.extractSharedUrl(Intent(Intent.ACTION_VIEW)))
        assertNull(StoryIntents.extractSharedUrl(Intent(Intent.ACTION_SEND).setType("image/png")))
        assertNull(StoryIntents.extractSharedUrl(Intent(Intent.ACTION_SEND).setType("text/plain")))
        assertNull(StoryIntents.extractSharedUrl(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "No link here")))
    }

    @Test fun externalHandoffUsesViewIntentAndExactChapterUrl() {
        val url = "https://archiveofourown.org/works/123/chapters/999"
        val intent = StoryIntents.browserIntent(url)
        assertEquals(Intent.ACTION_VIEW, intent.action)
        assertEquals(url, intent.dataString)
        assertTrue(intent.categories.contains(Intent.CATEGORY_BROWSABLE))
        assertNull(intent.`package`)
    }
}
