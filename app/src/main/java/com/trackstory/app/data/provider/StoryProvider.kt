package com.trackstory.app.data.provider

interface StoryProvider {
    val providerId: String
    val displayName: String
    val baseUrl: String
    fun canHandleUrl(url: String): Boolean
    fun parseUrl(url: String): ParsedStoryUrl?
    suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl): Result<RemoteStoryMetadata>
}

data class ParsedStoryUrl(
    val providerId: String,
    val externalStoryId: String,
    val chapterIdentifier: String? = null,
)

data class ChapterInfo(
    val number: Int,
    val title: String,
    val url: String,
    val publishDate: String? = null,
)

data class RemoteStoryMetadata(
    val providerId: String,
    val externalStoryId: String,
    val title: String,
    val author: String,
    val workUrl: String,
    val chapters: List<ChapterInfo>,
    val matchedChapterNumber: Int = 1,
) {
    init {
        require(chapters.isNotEmpty()) { "A story must contain at least one chapter" }
        require(chapters.map { it.number } == (1..chapters.size).toList()) {
            "Chapters must be ordered and numbered consecutively from one"
        }
        require(matchedChapterNumber in 1..chapters.size) { "Matched chapter is outside the index" }
    }

    val latestChapterNumber: Int get() = chapters.last().number
    val matchedChapter: ChapterInfo get() = chapters[matchedChapterNumber - 1]
    val latestChapter: ChapterInfo get() = chapters.last()
}

class UnsupportedStoryUrlException : IllegalArgumentException("This story URL is not supported")
class AuthenticationRequiredException : Exception("Sign in through the reader to access this story")
class ProviderHttpException(val statusCode: Int) : Exception("Story provider returned HTTP $statusCode")
