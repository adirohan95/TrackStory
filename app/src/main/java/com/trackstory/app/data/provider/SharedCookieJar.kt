package com.trackstory.app.data.provider

import android.webkit.CookieManager
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class SharedCookieJar(private val manager: CookieManager = CookieManager.getInstance()) : CookieJar {
    override fun loadForRequest(url: HttpUrl): List<Cookie> =
        manager.getCookie(url.toString()).orEmpty().split(';').mapNotNull { part ->
            val name = part.substringBefore('=').trim()
            val value = part.substringAfter('=', "").trim()
            if (name.isEmpty() || '=' !in part) null else runCatching {
                Cookie.Builder().name(name).value(value).hostOnlyDomain(url.host).path("/").build()
            }.getOrNull()
        }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { manager.setCookie(url.toString(), it.toString()) }
        manager.flush()
    }
}
