package com.trackstory.app.data.provider

import org.junit.Assert.*
import org.junit.Test
import java.net.URI

class StoryProviderRegistryTest {
    private class TestProvider(override val providerId: String, private val host: String) : StoryProvider {
        override val displayName = providerId
        override val baseUrl = "https://$host"
        override fun canHandleUrl(url: String) = parseUrl(url) != null
        override fun parseUrl(url: String): ParsedStoryUrl? = runCatching {
            val uri = URI(url)
            val match = Regex("^/works/(\\d+)(?:/chapters/(\\d+))?/?$").matchEntire(uri.path)
            if (uri.scheme == "https" && uri.host == host && match != null) {
                ParsedStoryUrl(providerId, match.groupValues[1], match.groupValues[2].ifEmpty { null })
            } else null
        }.getOrNull()
        override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl): Result<RemoteStoryMetadata> =
            Result.failure(UnsupportedOperationException())
    }

    private val ao3 = TestProvider("ao3", "archiveofourown.org")
    private val other = TestProvider("other", "example.org")
    private val registry = StoryProviderRegistry(listOf(ao3, other))

    @Test fun routesWorkAndChapterUrlsToTheirProvider() {
        val (provider, parsed) = registry.resolve("https://archiveofourown.org/works/123/chapters/999")
        assertSame(ao3, provider)
        assertEquals(ParsedStoryUrl("ao3", "123", "999"), parsed)
        assertSame(other, registry.providerForUrl("https://example.org/works/42"))
        assertSame(ao3, registry.providerById("ao3"))
        assertNull(registry.providerById("missing"))
    }

    @Test fun rejectsUnsupportedSitesAndNonStoryPaths() {
        listOf("https://archiveofourown.org.evil.org/works/1", "https://archiveofourown.org/users/a", "bad url")
            .forEach { assertNull(registry.providerForUrl(it)) }
    }

    @Test(expected = UnsupportedStoryUrlException::class)
    fun unsupportedResolutionHasExplicitError() { registry.resolve("https://unknown.org/works/1") }

    @Test(expected = IllegalArgumentException::class)
    fun duplicateProviderIdsAreRejected() { StoryProviderRegistry(listOf(ao3, ao3)) }

    @Test fun metadataUsesOrderedChapterIndex() {
        val chapters = (1..15).map { ChapterInfo(it, "Chapter $it", "https://example.org/$it") }
        val metadata = RemoteStoryMetadata("other", "42", "Title", "Author", other.baseUrl, chapters, 12)
        assertEquals(12, metadata.matchedChapter.number)
        assertEquals(15, metadata.latestChapterNumber)
    }
}
