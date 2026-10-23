package com.trackstory.app.data.provider

import kotlinx.coroutines.test.runTest
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import org.junit.Assert.*
import org.junit.Test

class Ao3ProviderTest {
    private val provider = Ao3Provider(OkHttpClient())
    private fun fixture(name: String) = javaClass.getResource("/ao3/$name.html")!!.readText()

    @Test fun validatesHostAndPath() {
        assertEquals(ParsedStoryUrl("ao3", "123", "999"), provider.parseUrl("https://archiveofourown.org/works/123/chapters/999?view_adult=true#top"))
        assertEquals(ParsedStoryUrl("ao3", "123"), provider.parseUrl("http://archiveofourown.org/works/123/"))
        listOf("https://archiveofourown.org.evil.org/works/123", "https://archiveofourown.org/users/a", "https://archiveofourown.org/works/123/navigate", "https://evil@archiveofourown.org/works/123", "garbage").forEach {
            assertFalse(it, provider.canHandleUrl(it))
        }
    }

    @Test fun matchesOpaqueChapterIdAgainstIndex() {
        val result = provider.parseNavigationHtml(ParsedStoryUrl("ao3", "123", "999"), fixture("multi"))
        assertEquals("A Story", result.title)
        assertEquals("Writer", result.author)
        assertEquals(2, result.matchedChapterNumber)
        assertEquals(2, result.latestChapterNumber)
        assertEquals("2026-02-01", result.latestChapter.publishDate)
        assertEquals("https://archiveofourown.org/works/123/chapters/999", result.latestChapter.url)
    }

    @Test fun workUrlDefaultsToFirstChapter() {
        assertEquals(1, provider.parseNavigationHtml(ParsedStoryUrl("ao3", "123"), fixture("multi")).matchedChapterNumber)
    }

    @Test fun singleChapterUsesWorkUrl() {
        val result = provider.parseNavigationHtml(ParsedStoryUrl("ao3", "123", "888"), fixture("single"))
        assertEquals(1, result.chapters.size)
        assertEquals("Anonymous", result.author)
        assertEquals("https://archiveofourown.org/works/123", result.latestChapter.url)
    }

    @Test(expected = AuthenticationRequiredException::class)
    fun loginFormReportsAuthenticationRequired() {
        provider.parseNavigationHtml(ParsedStoryUrl("ao3", "123"), fixture("restricted"))
    }

    @Test fun sendsSessionCookiesAndUsesLightweightEndpoint() = runTest {
        var requestedUrl = ""
        var cookieHeader: String? = null
        val cookies = object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) = Unit
            override fun loadForRequest(url: HttpUrl) = listOf(Cookie.Builder().name("_otwarchive_session").value("session").domain(url.host).build())
        }
        okhttp3.mockwebserver.MockWebServer().use { server ->
            server.enqueue(okhttp3.mockwebserver.MockResponse().setBody(fixture("multi")))
            server.start()
            val localClient = OkHttpClient.Builder().cookieJar(cookies).addInterceptor { chain ->
                requestedUrl = chain.request().url.toString()
                val local = chain.request().newBuilder().url(server.url("/index")).build()
                chain.proceed(local)
            }.build()
            assertTrue(Ao3Provider(localClient).fetchStoryMetadata(ParsedStoryUrl("ao3", "123")).isSuccess)
            cookieHeader = server.takeRequest().getHeader("Cookie")
        }
        assertEquals("https://archiveofourown.org/works/123/navigate?view_adult=true", requestedUrl)
        assertEquals("_otwarchive_session=session", cookieHeader)
    }

    @Test fun loginRedirectAndRateLimitAreTypedFailures() = runTest {
        okhttp3.mockwebserver.MockWebServer().use { server ->
            server.start()
            val local = OkHttpClient.Builder().addInterceptor { chain ->
                chain.proceed(chain.request().newBuilder().url(server.url("/index")).build())
            }.build()
            val provider = Ao3Provider(local)
            server.enqueue(okhttp3.mockwebserver.MockResponse().setResponseCode(302).addHeader("Location", "/users/login"))
            assertTrue(provider.fetchStoryMetadata(ParsedStoryUrl("ao3", "123")).exceptionOrNull() is AuthenticationRequiredException)
            server.enqueue(okhttp3.mockwebserver.MockResponse().setResponseCode(429))
            val failure = provider.fetchStoryMetadata(ParsedStoryUrl("ao3", "123")).exceptionOrNull()
            assertEquals(429, (failure as ProviderHttpException).statusCode)
        }
    }
}
