# Spec Delta

## Purpose

Orchestrates automatic hourly background checks and user-initiated manual refreshes across all tracked stories, politely pacing network requests and sending Android system notifications when new chapters are published.

## ADDED Requirements

### Requirement: System schedules hourly background checks for new chapters

The system SHALL register a periodic background job with a 1-hour interval (requiring network connectivity) that checks all tracked stories through their respective providers and updates their `latestChapter`, `latestUrl`, and `lastCheckedAt` fields.

#### Scenario: Hourly background check detects a new chapter

- **WHEN** the hourly background sync runs and a tracked story's remote chapter count increases from 12 to 13
- **THEN** the system SHALL update `latestChapter` to 13, store the chapter 13 URL as `latestUrl`, and mark the story as having unread updates

#### Scenario: Hourly background check finds no new chapters

- **WHEN** the hourly background sync runs and a tracked story's remote chapter count matches the stored `latestChapter`
- **THEN** the system SHALL update `lastCheckedAt` without triggering an unread notification

### Requirement: User can trigger an immediate manual refresh

The dashboard SHALL provide a manual refresh action that immediately runs the chapter update check across all tracked stories (or a single selected story) and displays a loading indicator until completion.

#### Scenario: Manual refresh from the dashboard

- **WHEN** the user triggers a manual refresh on the dashboard
- **THEN** the system SHALL query each tracked story's provider, update any changed chapter counts and URLs in local storage, and refresh the dashboard UI

### Requirement: System paces requests to respect site rate limits

When checking multiple tracked stories from the same provider, the sync runner SHALL wait between consecutive requests and halt requests to that provider if an HTTP `429 Too Many Requests` response is received.

#### Scenario: Rate limit encountered during multi-story sync

- **WHEN** a provider returns HTTP `429 Too Many Requests` during a sync pass
- **THEN** the sync runner SHALL stop further requests to that provider for the remainder of the current pass and preserve existing story data

### Requirement: System sends an Android notification when new chapters are discovered

When a background check detects that one or more tracked stories have a higher `latestChapter` than previously recorded, the system SHALL post an Android notification summarizing the updated stories.

#### Scenario: Single tracked story receives a new chapter in the background

- **WHEN** the hourly background check detects that a tracked story has published a new chapter
- **THEN** the system SHALL display a system notification naming the story and new chapter that opens the app when tapped
