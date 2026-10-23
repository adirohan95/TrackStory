package com.trackstory.app.data.provider

class StoryProviderRegistry(private val providers: List<StoryProvider>) {
    init {
        require(providers.map { it.providerId }.distinct().size == providers.size) {
            "Provider IDs must be unique"
        }
    }

    fun providerForUrl(url: String): StoryProvider? = providers.firstOrNull {
        it.canHandleUrl(url) && it.parseUrl(url)?.providerId == it.providerId
    }

    fun providerById(id: String): StoryProvider? = providers.firstOrNull { it.providerId == id }

    fun resolve(url: String): Pair<StoryProvider, ParsedStoryUrl> {
        val provider = providerForUrl(url) ?: throw UnsupportedStoryUrlException()
        return provider to (provider.parseUrl(url) ?: throw UnsupportedStoryUrlException())
    }
}
