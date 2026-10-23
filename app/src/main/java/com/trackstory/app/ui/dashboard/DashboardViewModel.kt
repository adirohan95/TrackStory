package com.trackstory.app.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackstory.app.data.*
import com.trackstory.app.data.local.TrackedStoryEntity
import com.trackstory.app.data.sync.SyncController
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class DashboardState(
    val stories: List<TrackedStoryEntity> = emptyList(),
    val theme: ThemePreference = ThemePreference.SYSTEM,
    val refreshing: Boolean = false,
    val busy: Boolean = false,
    val error: String? = null,
) {
    val updates get() = stories.filter { it.unreadCount > 0 }
    val caughtUp get() = stories.filter { it.unreadCount == 0 }
}

class DashboardViewModel(
    private val repository: StoryRepository,
    private val preferences: UserPreferencesRepository,
    private val sync: SyncController,
) : ViewModel() {
    private val pending = MutableStateFlow(0)
    private val error = MutableStateFlow<String?>(null)
    val state = combine(repository.stories, preferences.theme, sync.refreshing, pending, error) { stories, theme, refreshing, count, error ->
        DashboardState(stories, theme, refreshing, count > 0, error)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, DashboardState())

    private fun act(block: suspend () -> Unit) = viewModelScope.launch {
        pending.update { it + 1 }
        error.value = null
        try { block() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error.value = failure.message ?: "Unable to complete action" }
        finally { pending.update { it - 1 } }
    }

    fun addUrl(url: String) = act { repository.addOrUpdate(url.trim()) }
    fun adjustChapter(id: Long, chapter: Int) = act { repository.adjustChapter(id, chapter) }
    fun delete(id: Long) = act { repository.delete(id) }
    fun setTheme(theme: ThemePreference) = act { preferences.setTheme(theme) }
    fun refresh() { sync.refresh() }
    fun dismissError() { error.value = null }
    fun supports(url: String) = repository.providers.providerForUrl(url.trim()) != null
}
