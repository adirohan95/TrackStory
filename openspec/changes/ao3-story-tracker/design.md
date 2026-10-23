# Design

## Context

`TrackStory` is a greenfield Android application (see [proposal.md](./proposal.md) for motivation). The project must satisfy two structural constraints from day one:
1. **Google AI Studio & Local Build Compatibility**: The user intends to develop the codebase in this repository and import it into Google AI Studio (Build Mode -> Android) to deploy via Google Play's **"Your Personal Library"** (as well as supporting direct local APK builds). This requires a standard, single-module Android Gradle layout using Kotlin and Jetpack Compose without custom Gradle plugins or native C++ (`NDK`) dependencies.
2. **Multi-Site Extensibility**: While V1 targets Archive of Our Own (`archiveofourown.org`), future iterations will add sites with different structures and bot protections (such as `fanfiction.net` and `asurascans.com`). All persistence, UI, reader, and background sync components must depend strictly on a site-agnostic `StoryProvider` abstraction.

## Goals / Non-Goals

**Goals:**
- Provide a clean `StoryProvider` interface and registry so adding a new website requires zero changes to the Room database schema, Compose UI screens, or `WorkManager` sync worker.
- Fetch AO3 metadata and chapter lists with minimal bandwidth and rate-limit overhead using `/works/{workId}/navigate`.
- Automatically track the user's current chapter (`lastReadChapter`, `lastReadUrl`) and vertical scroll position (`scrollY`) inside a lightweight built-in `WebView` reader while preserving an one-tap action to open any chapter in the phone's default external browser.
- Share cookies between the built-in `WebView` (`CookieManager`) and background HTTP requests (`OkHttp`) so logged-in AO3 sessions unlock archive-locked stories automatically.
- Support hourly periodic background checks (`WorkManager`) with Android system notifications, manual refresh, and a Dark / Light / System theme toggle applied to both the app UI and the WebView reader.

**Non-Goals:**
- Implementing `FanFiction.net` or `AsuraScans` providers in V1 (only the pluggable architecture and `Ao3Provider` are in V1 scope).
- Downloading full story text for offline EPUB reading (reading happens live in the lightweight built-in WebView or external browser).
- Cloud account sync across multiple devices (all state is stored locally on the Android device in Room and DataStore).

## Decisions

### 1. Single-Module Kotlin + Jetpack Compose Architecture
- **Decision**: Structure the app as a single `:app` Gradle module organized by feature/layer packages (`data/local`, `data/provider`, `data/sync`, `ui/dashboard`, `ui/reader`, `ui/theme`).
- **Rationale**: Google AI Studio's Android Build Mode expects a standard single-module Kotlin + Jetpack Compose project structure. Keeping everything in `:app` with clear package boundaries ensures effortless GitHub import into AI Studio while maintaining clean separation of concerns.
- **Alternatives Considered**: Multi-module Gradle (`:core`, `:provider-ao3`, `:feature-reader`) — rejected because cloud IDE builders frequently fail to resolve custom multi-module Gradle graphs.

### 2. Pluggable `StoryProvider` Interface & Normalized Domain Model
- **Decision**: Define a `StoryProvider` interface with:
  - `val providerId: String` (e.g., `"ao3"`)
  - `val displayName: String` (e.g., `"AO3"`)
  - `val baseUrl: String`
  - `fun canHandleUrl(url: String): Boolean`
  - `fun parseUrl(url: String): ParsedStoryUrl?` (extracts `externalStoryId` and optional `chapterIdentifier` from any story/chapter URL)
  - `suspend fun fetchStoryMetadata(parsed: ParsedStoryUrl): Result<RemoteStoryMetadata>`
- **Rationale**: Different sites identify chapters differently (AO3 uses `/works/{workId}/chapters/{chapterId}` where `chapterId` is a database primary key, whereas FanFiction.net uses `/s/{storyId}/{chapterNumber}/`). By passing the URL to `fetchStoryMetadata`, the provider can map a site-specific `chapterId` against the ordered chapter index and return a normalized 1-based `matchedChapterNumber` alongside `latestChapterNumber`.
- **Alternatives Considered**: Extracting chapter numbers via regex alone — rejected because AO3 URLs contain opaque chapter IDs (`/chapters/98765432`) that only map to a chapter number (`Chapter 12`) by inspecting the `/navigate` chapter list.

### 3. AO3 `/works/{workId}/navigate` Parsing with `Jsoup` + Shared `CookieManager`
- **Decision**: `Ao3Provider` fetches `https://archiveofourown.org/works/{workId}/navigate?view_adult=true` using `OkHttp` and parses the HTML `<ol class="chapter index group">` with `Jsoup`. `OkHttp` reads cookies for `archiveofourown.org` directly from `android.webkit.CookieManager.getInstance()`.
- **Rationale**:
  - Full AO3 work pages can exceed several megabytes and trigger adult-content interstitial forms. The `/navigate` page is tiny (~5–15 KB) and contains the work title, author link, and every chapter's ordered index, title, `/chapters/{id}` path, and `<span class="datetime">` publish date.
  - Reading cookies from `CookieManager` means if the user logs into AO3 once in the built-in `WebView`, background hourly checks automatically authenticate for archive-locked (`restricted`) works.
- **Alternatives Considered**: Scraping the main `/works/{workId}` page or `/users/{user}/readings` exclusively — rejected because `/works/{workId}` is heavy and `/readings` does not list individual chapter URLs or mid-binge chapter progress.

### 4. Room Database Schema (`tracked_stories`)
- **Decision**: Store tracked stories in a single `tracked_stories` Room table with a composite unique index on `(providerId, externalStoryId)`:
  ```text
  +-------------------------------------------------------------------+
  | tracked_stories                                                   |
  +-------------------------------------------------------------------+
  | id: Long (PK, autoGenerate)                                       |
  | providerId: String ("ao3")                                        |
  | externalStoryId: String ("12345678")                              |
  | title: String                                                     |
  | author: String                                                    |
  | workUrl: String                                                   |
  | lastReadChapter: Int                                              |
  | lastReadChapterTitle: String                                      |
  | lastReadUrl: String                                               |
  | lastReadScrollY: Int (default 0)                                  |
  | nextChapterUrl: String? (nullable, direct link to lastRead + 1)   |
  | latestChapter: Int                                                |
  | latestChapterTitle: String                                        |
  | latestUrl: String                                                 |
  | latestPublishDate: String?                                        |
  | lastCheckedAt: Long (epoch millis)                                |
  | lastUpdatedAt: Long (epoch millis)                                |
  | syncError: String?                                                |
  +-------------------------------------------------------------------+
  ```
- **Rationale**: Storing `lastReadUrl`, `nextChapterUrl`, and `latestUrl` directly on the entity allows the Dashboard and Built-in Reader to open any target chapter instantaneously without waiting on a network call.

### 5. Lightweight Built-In WebView Reader with Auto-Tracking & Dark Mode
- **Decision**: Implement `ReaderScreen` wrapping `android.webkit.WebView` via Compose `AndroidView`:
  - **Auto-Tracking**: On `WebViewClient.onPageFinished(view, url)`, ask `StoryProviderRegistry` if `url` belongs to a tracked story. If it resolves to a chapter different from the stored `lastReadUrl`, invoke the provider (or cached chapter list) to update `lastReadChapter`, `lastReadUrl`, `nextChapterUrl`, and reset `lastReadScrollY = 0`. If it matches the existing `lastReadUrl`, restore `view.scrollTo(0, story.lastReadScrollY)`.
  - **Scroll Persistence**: Attach `WebView.setOnScrollChangeListener` (debounced) to persist `scrollY` to Room for the currently active tracked story.
  - **Dark Mode**: When the app theme resolves to Dark Mode, apply `WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, true)` (on Android 13+ / AndroidX WebKit) AND inject a lightweight dark-theme CSS stylesheet on `onPageFinished` so AO3 pages render with a dark background (`#121212`) and soft light text (`#E0E0E0`) regardless of Android OS version.
- **Rationale**: Gives the user a zero-friction reading experience where clicking "Next Chapter" on AO3's web page automatically updates their reading progress, while dark mode works even without an AO3 account skin.

### 6. Hourly Background Sync with `WorkManager`
- **Decision**: Schedule a `PeriodicWorkRequestBuilder<StorySyncWorker>(1, TimeUnit.HOURS)` with `ExistingPeriodicWorkPolicy.KEEP` and `NetworkType.CONNECTED` constraint on app startup.
- **Rationale**: `WorkManager` is Android's recommended API for reliable periodic background execution that survives device reboots and respects Doze mode. Inside `StorySyncWorker`, iterate over tracked stories with a `2000ms` delay between requests to the same provider, halt provider checks if HTTP `429` is returned, and post a notification to a `"story_updates"` `NotificationChannel` when any story's `latestChapter` increases.

## Risks / Trade-offs

- **[Risk] AO3 Rate Limiting (`HTTP 429 Too Many Requests`)** → **Mitigation**: Fetch only the lightweight `/works/{id}/navigate` endpoint, enforce a 2-second delay between stories during sync, use a polite custom `User-Agent`, and abort remaining checks for that provider if a `429` status is encountered.
- **[Risk] Android 13+ Notification Permission (`POST_NOTIFICATIONS`)** → **Mitigation**: Request runtime `POST_NOTIFICATIONS` permission on the Dashboard so hourly background notifications are not silently blocked by the OS.
- **[Risk] WebView Page Height Changes Before Scroll Restoration** → **Mitigation**: Restore `scrollY` inside `onPageFinished` with a short `postDelayed` fallback if `contentHeight` is still growing.

## Migration Plan

- Greenfield Android app: no existing database migrations required (`Room` database starts at `version = 1`).
- Deployment workflow:
  1. Build and verify locally (or push to GitHub and import into Google AI Studio -> Build Mode -> Android).
  2. Deploy to Google Play **"Your Personal Library"** or install the generated debug/release `.apk` via ADB/sideloading.
