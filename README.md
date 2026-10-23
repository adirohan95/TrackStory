# TrackStory

A local Android story tracker built with Kotlin and Jetpack Compose. AO3 is the first provider. Track a work or chapter URL, share a browser tab to TrackStory, or choose **Read first** in the add dialog and tap **+ Track** while reading.

## Build and install locally

Requirements: JDK 17 or newer (Android Studio's bundled JDK works), Android SDK platform 36, and an Android 8.0/API 26 or newer phone/emulator. Set `JAVA_HOME` to the JDK and `ANDROID_HOME` to your SDK, or configure `sdk.dir` in an untracked `local.properties` file. Android Studio can configure these for you when opening this directory.

On Windows PowerShell:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On macOS/Linux, run `chmod +x gradlew` once, then `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`. You can also copy the debug APK to your phone and use Android's install prompt. Debug builds are locally signed; Play/release distribution needs the signing configuration supplied by your deployment environment.

This project includes a Gradle 8.13 wrapper and uses AGP 8.13.2 and Kotlin 2.3.20. The first build downloads dependencies. If OneDrive turns generated files into reparse points and Gradle reports that outputs are not regular files, run `:app:clean` before rebuilding, or keep your working checkout outside a synced directory.

## Import into Google AI Studio

1. Put this project's source and Gradle wrapper in your GitHub repository. Exclude `local.properties`, build outputs, credentials, and local caches.
2. Open [Google AI Studio](https://aistudio.google.com/), enter Build mode, and choose the **Android** platform.
3. Select **Import from GitHub** from the **Add files (+)** menu and choose the repository. Ask Studio to preserve the single `:app` Kotlin/Compose module and application ID `com.trackstory.app`.
4. Build and preview the app in Studio's Android emulator. Check the SDK/JDK configuration if Studio prompts for project setup.
5. If your account has personal-library publishing, select **Publish**, connect your personal Google Account when prompted, and choose **Create app**. When ready, scan the install QR code or open Play Store → Profile → Manage apps & device → **Your personal library** on a phone using that account. Use **Update app** for later versions.

These steps follow Google's [Build mode documentation](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) and [personal-library guide](https://support.google.com/googleplay/android-developer/answer/18765789). As of October 23, 2026, Google describes personal-library publishing as a beta rolling out in the US; availability depends on your account and region. Local APK installation remains available. Import and publishing have not been exercised against your Google account.

## Reading and updates

- **Resume** restores the saved chapter and scroll position. **Next** opens the next chapter; **Latest** jumps to the newest one. Navigating inside the reader automatically updates tracked progress. Non-story pages do not change it.
- **Manage** adjusts chapters or confirms removal. External reading cannot detect your scroll position. The latest-chapter browser action marks that chapter read; the resume browser action leaves progress as it is.
- Light, Dark, and System preferences persist locally. Dark mode applies to the native UI and reader; changing back to Light removes the injected dark stylesheet.
- WorkManager checks hourly when connected, with Android battery/background scheduling affecting the actual time. **Refresh** requests a check immediately when connected. Each provider's requests are spaced by two seconds; HTTP 429 stops further checks for that provider in the current pass and requests a later retry.
- Allow notification permission to receive chapter alerts. To access an archive-locked work, open it with **Read first**, sign into AO3 inside the reader, then track it. WebView and background HTTP share the same cookie store. Signing into an external browser does not sign into the app.
- Story metadata, reading progress, preferences, and cookies are local. Removing the app clears them. The reader loads live pages; offline downloads and cloud sync are outside this version.

## Provider development and checks

Implement `StoryProvider`, return a consecutive one-based chapter index, and register the provider in `AppContainer`. The database, dashboard, sync, and reader use provider contracts. AO3 index parsing follows the upstream [navigation template](https://github.com/otwcode/otwarchive/blob/master/app/views/works/navigate.html.erb); fixture tests cover work/chapter URLs, single and multiple chapters, login-required responses, cookies, and HTTP 429 without accessing live AO3.

The JVM suite also exercises Room operations, theme persistence, sync/WorkManager configuration, share intents, and dashboard/reader state transitions. On a device, verify AO3 login, chapter navigation, close/reopen scroll restoration, Light/Dark/System rendering, permission grants/denials, and a manual refresh before relying on background checks.
