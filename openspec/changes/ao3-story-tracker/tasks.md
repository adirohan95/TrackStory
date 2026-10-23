# Tasks

## 1. Android Project Scaffolding & Build Configuration

- [x] 1.1 Create root Gradle configuration files (`settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`, and Gradle wrapper scripts) for a single-module Kotlin + Jetpack Compose project (`com.trackstory.app`), and verify the files exist with valid Kotlin DSL syntax.
- [x] 1.2 Create `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml` (including `INTERNET`, `POST_NOTIFICATIONS`, and `ACTION_SEND` text/plain Share intent filter), and `TrackStoryApplication.kt`, and verify all required dependencies (Compose Material 3, Navigation, Room, WorkManager, DataStore, OkHttp, Jsoup, AndroidX WebKit, JUnit) are declared.

## 2. Pluggable StoryProvider Engine & AO3 Provider

- [x] 2.1 Implement the site-agnostic provider contracts (`StoryProvider`, `ParsedStoryUrl`, `ChapterInfo`, `RemoteStoryMetadata`, and `StoryProviderRegistry`) under `app/src/main/java/com/trackstory/app/data/provider/`, and verify unit tests for `StoryProviderRegistry` routing pass.
- [x] 2.2 Implement `SharedCookieJar` bridging `android.webkit.CookieManager` with `OkHttpClient` and implement `Ao3Provider` (`canHandleUrl`, `parseUrl`, and `/works/{workId}/navigate?view_adult=true` HTML parsing with `Jsoup` for multi-chapter, single-chapter, and restricted works), and verify `Ao3ProviderTest` unit tests pass against sample AO3 `/navigate` HTML fixtures.

## 3. Local Storage (Room Database & Theme DataStore)

- [x] 3.1 Implement `TrackedStoryEntity`, `TrackedStoryDao`, `TrackStoryDatabase`, and `StoryRepository` (supporting adding/updating stories from URLs, updating reading progress/scroll position, and manual chapter adjustments), and verify repository/DAO unit tests pass.
- [x] 3.2 Implement `ThemePreference` (`SYSTEM`, `LIGHT`, `DARK`) and `UserPreferencesRepository` backed by Jetpack `DataStore`, together with `TrackStoryTheme` in `ui/theme/`, and verify preference persistence tests pass.

## 4. Hourly Background Sync & Notifications

- [x] 4.1 Implement `UpdateNotificationHelper` (creating the `"story_updates"` notification channel and posting chapter update notifications) and `StorySyncWorker` (`CoroutineWorker` with 2-second per-provider rate-limit pacing and HTTP `429` circuit-breaking), and verify sync worker unit tests cover new-chapter detection and `429` handling.
- [x] 4.2 Implement `SyncScheduler` to enqueue the 1-hour `PeriodicWorkRequest` (`ExistingPeriodicWorkPolicy.KEEP`, `NetworkType.CONNECTED`) on application startup and provide an immediate one-time sync trigger for manual refresh, verifying the work request configuration in unit tests.

## 5. Dashboard Screen & External Browser / Share Intent Handling

- [x] 5.1 Implement `DashboardViewModel` and `DashboardScreen` in Jetpack Compose with "Updates Available" and "Caught Up" sections, story cards showing `lastReadChapter` vs. `latestChapter`, manual pull/button refresh, "Add Story URL" dialog, manual chapter stepper/delete menu, and theme mode selector (`Light` / `Dark` / `System`), verifying UI state transitions in `DashboardViewModelTest`.
- [x] 5.2 Wire `MainActivity` to handle incoming `Intent.ACTION_SEND` shared URLs from external browsers and implement external default browser launching (`Intent.ACTION_VIEW`) for any story's latest or last-read chapter URL, verifying intent URL extraction with unit tests.

## 6. Lightweight Built-In WebView Reader

- [x] 6.1 Implement `ReaderViewModel` and `ReaderScreen` wrapping `android.webkit.WebView` with shared `CookieManager` persistence, top bar displaying current chapter status, one-tap `+ Track` action for untracked stories, and "Open in Default Browser" action, verifying reader state logic in `ReaderViewModelTest`.
- [x] 6.2 Implement automatic chapter detection on `WebViewClient.onPageFinished` (updating `lastReadChapter`, `lastReadUrl`, and resetting `lastReadScrollY` when advancing chapters), debounced vertical `scrollY` persistence/restoration, and WebView dark-mode rendering (`WebSettingsCompat` + dark CSS injection when Dark Mode is active), and document Google AI Studio import & local APK deployment steps in `README.md`.
