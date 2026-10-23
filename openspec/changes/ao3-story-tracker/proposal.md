# Proposal

## Why

Keeping dozens of browser tabs open to track ongoing stories on Archive of Our Own (AO3) is error-prone, loses exact reading progress, and requires manually refreshing pages to check for updates. Building a dedicated Android app with an extensible provider architecture lets readers automatically check for new chapters hourly, get notified of updates, read in a lightweight built-in browser that remembers their exact chapter and scroll position, or jump directly to the latest chapter in their default browser—while laying a clean foundation for future sites like FanFiction.net and AsuraScans.

## What Changes

- Create a single-module native Android application (`TrackStory`) in Kotlin and Jetpack Compose, structured for both local APK builds and import into Google AI Studio for Google Play "Your Personal Library" deployment.
- Introduce a site-agnostic `StoryProvider` plugin architecture so the core database, UI, reader, and background sync engine are decoupled from site-specific URL and HTML structures.
- Implement the V1 `Ao3Provider` (`archiveofourown.org`) using lightweight chapter index parsing (`/works/{workId}/navigate`) and shared cookie support for archive-locked works.
- Add a Tracked Stories Dashboard displaying unread updates versus caught-up stories, manual refresh triggers, direct links to open either the last-read or latest chapter, and an external browser launcher.
- Add a lightweight built-in WebView Reader that automatically tracks and updates the user's `lastReadChapter` and vertical scroll position (`scrollY`) as they navigate between chapters, plus a one-tap `+ Track` action when browsing stories.
- Add an hourly background update checker (`WorkManager`) and manual refresh flow that detects newly published chapters and sends Android notifications when updates arrive.
- Add a persisted Dark / Light / System theme preference (`DataStore`) that styles both the Material 3 app UI and the built-in WebView reader content.

## Capabilities

### New Capabilities
- `story-provider-engine`: Pluggable multi-site `StoryProvider` contract, provider registry, and the V1 `Ao3Provider` implementation for parsing AO3 URLs and fetching chapter lists via `/works/{id}/navigate`.
- `story-tracking-dashboard`: Local SQLite (`Room`) persistence for tracked stories, dashboard UI with Unread/Caught-Up sections, URL addition/Share sheet intake, and quick actions to open the last-read or latest chapter in either the built-in reader or the external default browser.
- `in-app-reader`: Lightweight built-in WebView browser with shared cookie persistence, one-tap story tracking while browsing, automatic detection of chapter navigation to update `lastReadChapter`, scroll position (`scrollY`) restoration, and external browser handoff.
- `chapter-update-sync`: Hourly periodic `WorkManager` background sync and manual refresh orchestration with polite rate-limiting and Android system notifications when new chapters are found.
- `theme-preferences`: Persisted Light, Dark, and System theme setting (`DataStore`) applied across the Jetpack Compose Material 3 UI and the built-in WebView reader.

### Modified Capabilities
<!-- No existing capabilities are being modified in this greenfield project. -->

## Impact

- **New Android Codebase**: Adds standard single-module Gradle configuration (`build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `app/build.gradle.kts`, `AndroidManifest.xml`) and Kotlin/Compose application source under `app/src/main/`.
- **Dependencies**: Jetpack Compose (Material 3, Navigation), Room (SQLite persistence), WorkManager (hourly background checks), DataStore Preferences (theme & settings), OkHttp + Jsoup (lightweight HTML fetching and parsing), AndroidX WebKit (WebView dark mode support), and Kotlin Coroutines/Flow.
- **External Systems**: Makes polite HTTP requests (`GET /works/{id}/navigate` and user-initiated WebView page loads) to `https://archiveofourown.org`.
