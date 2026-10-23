# Spec Delta

## Purpose

Provides a lightweight built-in web reader that renders story chapters, persists authentication cookies, enables one-tap story tracking while browsing, and automatically records the user's current chapter and vertical scroll position.

## ADDED Requirements

### Requirement: Built-in reader automatically updates last-read chapter on navigation

When the user navigates to a chapter URL of a tracked story inside the built-in reader, the system SHALL automatically identify the chapter through its provider and update the story's `lastReadChapter` and `lastReadUrl` in local storage.

#### Scenario: Clicking "Next Chapter" inside an AO3 story page

- **WHEN** the user taps "Next Chapter" on a tracked AO3 work inside the built-in reader and the new chapter page loads
- **THEN** the system SHALL match the loaded URL against the story's chapter index and update `lastReadChapter` and `lastReadUrl` to the newly opened chapter

#### Scenario: Navigating to a non-story page while browsing

- **WHEN** the user navigates to an author profile, tag search, or index page inside the built-in reader
- **THEN** the system SHALL allow browsing without altering any tracked story's saved chapter progress

### Requirement: Built-in reader saves and restores vertical scroll position per story

The built-in reader SHALL record the user's vertical scroll position on the active chapter of a tracked story and restore that scroll position when the user reopens the same chapter.

#### Scenario: Reopening a partially read chapter

- **WHEN** the user scrolls halfway down a tracked chapter, closes the reader, and later reopens the same chapter from the dashboard
- **THEN** the built-in reader SHALL restore the saved vertical scroll offset after the page finishes rendering

#### Scenario: Advancing to a different chapter resets scroll offset

- **WHEN** the user navigates from one chapter to a different chapter of a tracked story
- **THEN** the built-in reader SHALL reset the stored scroll offset for the new chapter to the top of the page (`0`)

### Requirement: Built-in reader provides one-tap story tracking while browsing

When the built-in reader is displaying a story URL supported by a registered provider, the reader toolbar SHALL display a tracking control that lets the user start tracking an untracked story or shows the current tracked chapter status.

#### Scenario: Tracking a newly discovered story from the built-in reader

- **WHEN** the user browses to an untracked AO3 story chapter in the built-in reader and taps the "Track" button in the toolbar
- **THEN** the system SHALL add the story to local storage with `lastReadChapter` set to the currently open chapter

### Requirement: Built-in reader supports launching the current page in the external default browser

The built-in reader toolbar SHALL include an action that opens the currently loaded URL in the device's default external browser.

#### Scenario: Handing off the current chapter to the default browser

- **WHEN** the user taps "Open in Browser" in the built-in reader toolbar
- **THEN** the system SHALL launch an Android `ACTION_VIEW` intent for the current URL in the device's default browser
