package com.trackstory.app.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackstory.app.data.ThemePreference
import com.trackstory.app.data.local.TrackedStoryEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(model: DashboardViewModel, onRead: (String) -> Unit, onExternal: (String) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    var addDialog by remember { mutableStateOf(false) }
    var input by remember { mutableStateOf("") }
    var themeMenu by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<TrackedStoryEntity?>(null) }

    Scaffold(topBar = {
        TopAppBar(title = { Text("TrackStory") }, actions = {
            Box {
                TextButton(onClick = { themeMenu = true }) { Text("Theme") }
                DropdownMenu(expanded = themeMenu, onDismissRequest = { themeMenu = false }) {
                    ThemePreference.entries.forEach { preference ->
                        DropdownMenuItem(text = {
                            Text((if (state.theme == preference) "✓ " else "") + preference.name.lowercase().replaceFirstChar { it.uppercase() })
                        }, onClick = { model.setTheme(preference); themeMenu = false })
                    }
                }
            }
        })
    }, floatingActionButton = {
        FloatingActionButton(onClick = { addDialog = true }) { Text("+ Story", Modifier.padding(horizontal = 16.dp)) }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Your reading library", style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = model::refresh, enabled = !state.refreshing) { Text(if (state.refreshing) "Checking…" else "Refresh") }
                }
                if (state.busy || state.refreshing) LinearProgressIndicator(Modifier.fillMaxWidth())
            }
            state.error?.let { message -> item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(message)
                        TextButton(onClick = model::dismissError) { Text("Dismiss") }
                    }
                }
            } }
            if (state.stories.isEmpty()) item {
                Text("Keep your place. Find your next chapter.", style = MaterialTheme.typography.headlineSmall)
                Text("Add a story URL to track chapter updates, or read it first in the built-in reader.", Modifier.padding(top = 12.dp))
            }
            if (state.updates.isNotEmpty()) {
                item { Text("Updates Available", style = MaterialTheme.typography.titleLarge) }
                items(state.updates, key = { it.id }) { story ->
                    StoryCard(story, state.busy, onRead, onExternal, model::adjustChapter) { deleting = story }
                }
            }
            if (state.caughtUp.isNotEmpty()) {
                item { Text("Caught Up", style = MaterialTheme.typography.titleLarge) }
                items(state.caughtUp, key = { it.id }) { story ->
                    StoryCard(story, state.busy, onRead, onExternal, model::adjustChapter) { deleting = story }
                }
            }
        }
    }
    if (addDialog) AlertDialog(onDismissRequest = { addDialog = false }, title = { Text("Add Story URL") }, text = {
        Column {
            OutlinedTextField(value = input, onValueChange = { input = it }, label = { Text("Story or chapter URL") }, singleLine = true)
            TextButton(onClick = { addDialog = false; onRead(input.trim()) }, enabled = model.supports(input)) { Text("Read first") }
        }
    }, confirmButton = {
        TextButton(onClick = { model.addUrl(input); addDialog = false; input = "" }, enabled = input.isNotBlank() && !state.busy) { Text("Track") }
    }, dismissButton = { TextButton(onClick = { addDialog = false }) { Text("Cancel") } })
    deleting?.let { story ->
        AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Remove story?") }, text = { Text("Stop tracking “${story.title}” and remove its saved progress?") }, confirmButton = {
            TextButton(onClick = { model.delete(story.id); deleting = null }) { Text("Remove") }
        }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } })
    }
}

@Composable
private fun StoryCard(story: TrackedStoryEntity, busy: Boolean, onRead: (String) -> Unit, onExternal: (String) -> Unit,
    adjust: (Long, Int) -> Any, delete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(story.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                Box {
                    TextButton(onClick = { menu = true }) { Text("Manage") }
                    DropdownMenu(menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("− Previous chapter") }, enabled = !busy && story.lastReadChapter > 1,
                            onClick = { adjust(story.id, story.lastReadChapter - 1); menu = false })
                        DropdownMenuItem(text = { Text("+ Next chapter") }, enabled = !busy && story.lastReadChapter < story.latestChapter,
                            onClick = { adjust(story.id, story.lastReadChapter + 1); menu = false })
                        DropdownMenuItem(text = { Text("Remove story") }, onClick = { menu = false; delete() })
                    }
                }
            }
            Text(story.author, style = MaterialTheme.typography.bodyMedium)
            Text("Read ${story.lastReadChapter} / ${story.latestChapter}" + if (story.unreadCount > 0) " · ${story.unreadCount} unread" else " · Caught up")
            Text(story.lastReadChapterTitle, style = MaterialTheme.typography.bodySmall)
            story.syncError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onRead(story.lastReadUrl) }) { Text("Resume") }
                story.nextChapterUrl?.let { next -> OutlinedButton(onClick = { onRead(next) }) { Text("Next") } }
                TextButton(onClick = { onRead(story.latestUrl) }) { Text("Latest") }
            }
            TextButton(onClick = { onExternal(story.lastReadUrl) }) { Text("Resume in default browser") }
            TextButton(onClick = { onExternal(story.latestUrl); adjust(story.id, story.latestChapter) }, enabled = !busy) {
                Text("Latest in default browser · mark read")
            }
        }
    }
}
