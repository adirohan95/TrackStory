package com.trackstory.app.ui.reader

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackstory.app.data.StoryRepository
import com.trackstory.app.data.local.TrackedStoryEntity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl

data class ReaderState(
    val url: String,
    val supported: Boolean = false,
    val story: TrackedStoryEntity? = null,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val restore: ScrollRestore? = null,
)

data class ScrollRestore(val pageUrl: String, val scrollY: Int, val navigation: Long)

class ReaderViewModel(private val repository: StoryRepository, url: String,
    private val persistenceScope: CoroutineScope) : ViewModel() {
    val initialUrl = url.toHttpUrl().newBuilder().scheme("https").build().toString()
    private val mutableState = MutableStateFlow(ReaderState(initialUrl))
    val state = mutableState.asStateFlow()
    private var lookup: Job? = null
    private var navigation = 0L
    private var latestScrollY = 0
    private data class ScrollSave(val storyId: Long, val chapterUrl: String, val y: Int)
    private var pendingSave: ScrollSave? = null
    private var debounce: Job? = null
    private val saveMutex = Mutex()

    fun pageStarted(url: String) {
        flushScroll()
        lookup?.cancel()
        navigation++
        latestScrollY = 0
        mutableState.value = ReaderState(url, supported = repository.providers.providerForUrl(url) != null)
    }

    fun pageFinished(url: String): Job {
        if (mutableState.value.url != url) return viewModelScope.launch { }
        lookup?.cancel()
        val currentNavigation = navigation
        return viewModelScope.launch {
            try {
                val existing = repository.find(url)
                val sameChapter = existing != null &&
                    repository.providers.resolve(url).second == repository.providers.resolve(existing.lastReadUrl).second
                val story = if (existing == null || sameChapter) existing else repository.recordPage(url)
                if (navigation == currentNavigation) {
                    latestScrollY = story?.lastReadScrollY ?: 0
                    mutableState.value = mutableState.value.copy(story = story, loading = false,
                        restore = story?.let { ScrollRestore(url, it.lastReadScrollY, currentNavigation) })
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { showError(failure.message ?: "Unable to load story progress") }
        }.also { lookup = it }
    }

    fun track(scrollY: Int = latestScrollY) = viewModelScope.launch {
        val url = mutableState.value.url
        val currentNavigation = navigation
        mutableState.value = mutableState.value.copy(busy = true, error = null)
        try {
            val story = repository.addOrUpdate(url)
            if (navigation == currentNavigation) {
                mutableState.value = mutableState.value.copy(story = story, busy = false)
                scrollChanged(scrollY)
                flushScroll()
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            if (mutableState.value.url == url) showError(failure.message ?: "Unable to track story")
        }
    }

    fun scrollChanged(scrollY: Int) {
        latestScrollY = scrollY.coerceAtLeast(0)
        val story = mutableState.value.story ?: return
        pendingSave = ScrollSave(story.id, story.lastReadUrl, latestScrollY)
        debounce?.cancel()
        debounce = viewModelScope.launch { delay(350); debounce = null; flushScroll()?.join() }
    }

    fun flushScroll(): Job? {
        debounce?.cancel()
        debounce = null
        val save = pendingSave ?: return null
        pendingSave = null
        // This save must survive the reader's ViewModel being cleared on Back.
        return persistenceScope.launch {
            try { saveMutex.withLock { repository.saveScroll(save.storyId, save.chapterUrl, save.y) } }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { showError(failure.message ?: "Unable to save reading position") }
        }
    }

    fun showError(message: String) { mutableState.value = mutableState.value.copy(error = message, busy = false, loading = false) }
    fun dismissError() { mutableState.value = mutableState.value.copy(error = null) }
}
