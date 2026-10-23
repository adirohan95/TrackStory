package com.trackstory.app.ui.reader

import android.graphics.Bitmap
import android.annotation.SuppressLint
import android.webkit.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.Lifecycle
import com.trackstory.app.data.ThemePreference
import com.trackstory.app.ui.theme.resolvesToDark

@OptIn(ExperimentalMaterial3Api::class)
// JavaScript supports live-site functionality and theme injection; no native JS bridge is exposed.
// The non-consuming touch observer lets WebView retain its own click and accessibility handling.
@SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
@Composable
fun ReaderScreen(model: ReaderViewModel, theme: ThemePreference, onBack: () -> Unit, onExternal: (String) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    var browser by remember { mutableStateOf<WebView?>(null) }
    val dark = theme.resolvesToDark(isSystemInDarkTheme())
    val currentDark by rememberUpdatedState(dark)
    var restoring by remember { mutableStateOf(true) }
    var touched by remember { mutableStateOf(false) }
    LaunchedEffect(browser, dark) { browser?.let { ReaderAppearance.apply(it, dark) } }
    LaunchedEffect(browser, state.restore, state.loading) {
        val view = browser ?: return@LaunchedEffect
        val restore = state.restore
        if (restore != null) {
            view.postDelayed({
                if (model.state.value.restore == restore && !touched) {
                    view.scrollTo(0, restore.scrollY)
                    restoring = false
                }
            }, 150)
            view.postDelayed({
                if (model.state.value.restore == restore && !touched) {
                    restoring = true
                    view.scrollTo(0, restore.scrollY)
                    restoring = false
                }
            }, 500)
        } else if (!state.loading) restoring = false
    }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) { model.flushScroll(); CookieManager.getInstance().flush() }
    DisposableEffect(model) { onDispose { model.flushScroll() } }
    fun back() { if (browser?.canGoBack() == true) browser?.goBack() else onBack() }
    BackHandler { back() }

    Scaffold(topBar = {
        TopAppBar(title = {
            Column {
                Text(state.story?.title ?: "Reader", maxLines = 1)
                state.story?.let { Text("Chapter ${it.lastReadChapter} / ${it.latestChapter}", style = MaterialTheme.typography.labelSmall) }
            }
        }, navigationIcon = { TextButton(onClick = ::back) { Text("Back") } }, actions = {
            if (state.supported && state.story == null) TextButton(onClick = { model.track(browser?.scrollY ?: 0) }, enabled = !state.busy && !state.loading) { Text("+ Track") }
            TextButton(onClick = { onExternal(state.url) }) { Text("Browser") }
        })
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.loading || state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { error ->
                Row(Modifier.padding(8.dp)) {
                    Text(error, Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = model::dismissError) { Text("Dismiss") }
                }
            }
            AndroidView(modifier = Modifier.fillMaxSize(), factory = { context ->
                WebView(context).apply {
                    browser = this
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
                    setOnTouchListener { _, event ->
                        if (event.action == android.view.MotionEvent.ACTION_DOWN) { touched = true; restoring = false }
                        false
                    }
                    setOnScrollChangeListener { _, _, scrollY, _, _ -> if (!restoring) model.scrollChanged(scrollY) }
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                            if (request.url.scheme == "http") {
                                view.loadUrl(request.url.buildUpon().scheme("https").build().toString())
                                return true
                            }
                            return request.url.scheme != "https"
                        }
                        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                            restoring = true
                            touched = false
                            model.pageStarted(url)
                        }
                        override fun onPageFinished(view: WebView, url: String) {
                            CookieManager.getInstance().flush()
                            ReaderAppearance.apply(view, currentDark)
                            model.pageFinished(url)
                        }
                        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                            if (request.isForMainFrame) model.showError(error.description.toString())
                        }
                    }
                    loadUrl(model.initialUrl)
                }
            }, onRelease = { view ->
                model.flushScroll()
                CookieManager.getInstance().flush()
                view.stopLoading()
                view.destroy()
                browser = null
            })
        }
    }
}
