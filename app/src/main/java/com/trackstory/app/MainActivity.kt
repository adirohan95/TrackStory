package com.trackstory.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.net.Uri
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.trackstory.app.data.ThemePreference
import com.trackstory.app.data.sync.SyncScheduler
import com.trackstory.app.ui.dashboard.*
import com.trackstory.app.ui.theme.TrackStoryTheme
import com.trackstory.app.ui.reader.ReaderScreen
import com.trackstory.app.ui.reader.ReaderViewModel

class MainActivity : ComponentActivity() {
    private var sharedUrl by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) sharedUrl = StoryIntents.extractSharedUrl(intent)
        val container = (application as TrackStoryApplication).container
        setContent {
            val theme by container.preferences.theme.collectAsStateWithLifecycle(ThemePreference.SYSTEM)
            val model: DashboardViewModel = viewModel(factory = viewModelFactory {
                initializer { DashboardViewModel(container.stories, container.preferences, SyncScheduler(this@MainActivity)) }
            })
            LaunchedEffect(sharedUrl) { sharedUrl?.let { model.addUrl(it); sharedUrl = null } }
            val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
            LaunchedEffect(Unit) {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            TrackStoryTheme(theme) {
                val nav = rememberNavController()
                NavHost(navController = nav, startDestination = "dashboard") {
                    composable("dashboard") { DashboardScreen(model,
                        onRead = { nav.navigate("reader?url=${Uri.encode(it)}") }, onExternal = ::openBrowser) }
                    composable("reader?url={url}", arguments = listOf(navArgument("url") { type = NavType.StringType })) { entry ->
                        val url = entry.arguments?.getString("url") ?: return@composable
                        val reader: ReaderViewModel = viewModel(factory = viewModelFactory {
                            initializer { ReaderViewModel(container.stories, url, container.applicationScope) }
                        })
                        ReaderScreen(reader, theme, onBack = { nav.popBackStack() }, onExternal = ::openBrowser)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedUrl = StoryIntents.extractSharedUrl(intent)
    }

    private fun openBrowser(url: String) {
        try { StoryIntents.openBrowser(this, url) }
        catch (_: ActivityNotFoundException) { Toast.makeText(this, "No browser is installed", Toast.LENGTH_LONG).show() }
    }
}
