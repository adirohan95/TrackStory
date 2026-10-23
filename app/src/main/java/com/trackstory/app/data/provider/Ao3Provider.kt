package com.trackstory.app.data.provider

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup

class Ao3Provider(private val client: OkHttpClient) : StoryProvider {
    override val providerId = "ao3"
    override val displayName = "AO3"
    override val baseUrl = "https://archiveofourown.org"

    override fun canHandleUrl(url: String) = parseUrl(url) != null

    override fun parseUrl(url: String): ParsedStoryUrl? {
        val parsed = url.toHttpUrlOrNull() ?: return null
        if (parsed.scheme !in setOf("http", "https") || parsed.host != "archiveofourown.org" ||
            parsed.username.isNotEmpty() || parsed.password.isNotEmpty() || parsed.port !in setOf(80, 443)) return null
        val match = Regex("^/works/([1-9][0-9]*)(?:/chapters/([1-9][0-9]*))?/?$")
            .matchEntire(parsed.encodedPath) ?: return null
        return ParsedStoryUrl(providerId, match.groupValues[1], match.groupValues[2].ifEmpty { null })
    }

    override suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl): Result<RemoteStoryMetadata> =
        withContext(Dispatchers.IO) {
            try {
                require(parsed.providerId == providerId && parsed.externalStoryId.matches(Regex("[1-9][0-9]*")))
                val request = Request.Builder()
                    .url("$baseUrl/works/${parsed.externalStoryId}/navigate?view_adult=true")
                    .header("User-Agent", "TrackStory/1.0 (personal chapter tracker)")
                    .build()
                // Inspect redirects so a login form cannot be mistaken for an empty work.
                client.newBuilder().followRedirects(false).followSslRedirects(false).build()
                    .newCall(request).execute().use { response ->
                        if (response.code in setOf(401, 403) ||
                            (response.isRedirect && response.header("Location").orEmpty().contains("/users/login"))) {
                            throw AuthenticationRequiredException()
                        }
                        if (!response.isSuccessful) throw ProviderHttpException(response.code)
                        Result.success(parseNavigationHtml(parsed, response.body?.string().orEmpty()))
                    }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                Result.failure(error)
            }
        }

    internal fun parseNavigationHtml(parsed: ParsedStoryUrl, html: String): RemoteStoryMetadata {
        val workUrl = "$baseUrl/works/${parsed.externalStoryId}"
        val doc = Jsoup.parse(html, baseUrl)
        if (doc.selectFirst("form#new_user, form[action*=/users/login]") != null &&
            doc.selectFirst("ol.chapter.index") == null) throw AuthenticationRequiredException()
        val heading = doc.selectFirst("h2.heading") ?: error("AO3 chapter heading was not found")
        val title = heading.select("a[href]").firstOrNull {
            it.attr("abs:href").substringBefore('?').trimEnd('/') == workUrl
        }?.text()?.takeIf { it.isNotBlank() } ?: error("AO3 work title was not found")
        val author = heading.select("a[rel=author]").joinToString(", ") { it.text() }
            .ifBlank { "Anonymous" }
        val index = doc.selectFirst("ol.chapter.index") ?: error("AO3 chapter index was not found")
        val links = index.select("li").map { item ->
            val link = item.selectFirst("a[href]") ?: error("AO3 chapter link was not found")
            val url = link.attr("abs:href")
            val chapter = parseUrl(url) ?: error("AO3 returned an unsupported chapter link")
            require(chapter.externalStoryId == parsed.externalStoryId) { "AO3 returned a different work" }
            Triple(chapter.chapterIdentifier, link.text(), item.selectFirst(".datetime")?.text()?.trim('(', ')', ' '))
        }
        require(links.isNotEmpty()) { "AO3 chapter index is empty" }
        val chapters = links.mapIndexed { i, (identifier, title, date) ->
            ChapterInfo(i + 1, title, if (links.size == 1) workUrl else "$workUrl/chapters/$identifier", date)
        }
        val matched = if (parsed.chapterIdentifier == null) 1 else {
            links.indexOfFirst { it.first == parsed.chapterIdentifier }.takeIf { it >= 0 }?.plus(1)
                ?: error("The requested chapter is absent from the AO3 index")
        }
        return RemoteStoryMetadata(providerId, parsed.externalStoryId, title, author, workUrl, chapters, matched)
    }
}
