# Spec Delta

## Purpose

Provides persistent local storage and the main dashboard interface for managing tracked stories, viewing unread chapter updates versus caught-up stories, adding stories by URL or Android Share intent, and launching either the last-read or latest chapter.

## ADDED Requirements

### Requirement: System persists tracked story progress and chapter metadata locally

The system SHALL store each tracked story locally with its provider ID, external story ID, title, author, last-read chapter number, last-read chapter title, last-read chapter URL, saved vertical scroll offset, latest available chapter number, latest chapter title, latest chapter URL, last-checked timestamp, and unread update status.

#### Scenario: Adding a new story from a chapter URL

- **WHEN** a user adds a story URL pointing to chapter 8 of a 10-chapter story
- **THEN** the system SHALL save the story with `lastReadChapter` set to 8, `latestChapter` set to 10, their corresponding chapter URLs, and mark the story as having unread chapters

#### Scenario: Re-adding an already tracked story updates reading progress

- **WHEN** a user submits or shares a chapter URL for a story that is already tracked
- **THEN** the system SHALL update the existing story's `lastReadChapter` and `lastReadUrl` to the shared chapter without creating a duplicate entry

### Requirement: Dashboard separates stories with unread chapters from caught-up stories

The dashboard SHALL display tracked stories grouped so that stories where `latestChapter > lastReadChapter` appear in an "Updates Available" section and stories where `latestChapter == lastReadChapter` appear in a "Caught Up" section.

#### Scenario: Story receives a new chapter

- **WHEN** a tracked story's `latestChapter` becomes greater than its `lastReadChapter`
- **THEN** the dashboard SHALL display the story under "Updates Available" with a badge showing the number of unread chapters

#### Scenario: User catches up to the latest chapter

- **WHEN** a tracked story's `lastReadChapter` is updated to equal `latestChapter`
- **THEN** the dashboard SHALL move the story to the "Caught Up" section

### Requirement: Dashboard provides actions to open last-read or latest chapter

Each tracked story card on the dashboard SHALL display the user's last-read chapter and the latest available chapter, and provide actions to open the story at the last-read/next chapter or jump directly to the latest chapter.

#### Scenario: Opening a story in the built-in reader

- **WHEN** the user taps the primary read action on a story card
- **THEN** the system SHALL open the built-in reader at the selected chapter URL

#### Scenario: Opening the latest chapter in the external default browser

- **WHEN** the user selects the "Open in Default Browser" action for a story's latest chapter
- **THEN** the system SHALL launch an Android `ACTION_VIEW` intent with the direct URL to the latest chapter in the device's default browser and offer or apply an update to `lastReadChapter`

### Requirement: System accepts story URLs via manual input and Android Share sheet

The system SHALL allow users to add or update tracked stories both by pasting a URL inside the app and by sharing a URL from any external browser via the Android system Share sheet (`ACTION_SEND`).

#### Scenario: Sharing a story tab from an external mobile browser

- **WHEN** the user shares an AO3 chapter URL from their mobile browser to TrackStory
- **THEN** the system SHALL parse the shared URL, fetch the story's chapter metadata, and save or update the tracked story's progress

### Requirement: User can manually adjust last-read chapter or remove a tracked story

The dashboard SHALL allow the user to manually change a tracked story's `lastReadChapter` or delete the story from tracking.

#### Scenario: Deleting a tracked story

- **WHEN** the user confirms removal of a tracked story on the dashboard
- **THEN** the system SHALL remove the story from local storage and exclude it from future hourly checks
