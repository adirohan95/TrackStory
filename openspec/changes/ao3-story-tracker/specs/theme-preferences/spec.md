# Spec Delta

## Purpose

Manages the user's visual theme preference (Light, Dark, or System Default) and applies it consistently across both the native application screens and the built-in web reader.

## ADDED Requirements

### Requirement: User can select and persist a Light, Dark, or System theme mode

The system SHALL provide a theme setting allowing the user to choose between Light Mode, Dark Mode, and System Default, and SHALL persist this choice across app restarts.

#### Scenario: Switching from System Default to Dark Mode

- **WHEN** the user selects Dark Mode in the app theme toggle
- **THEN** the app UI SHALL immediately switch to the dark color palette and persist the Dark Mode setting

### Requirement: Built-in web reader adapts page rendering to the active theme mode

When the active theme resolves to Dark Mode, the built-in web reader SHALL apply dark-mode styling to loaded story pages so web content is displayed with a dark background and light text.

#### Scenario: Opening an AO3 chapter while Dark Mode is active

- **WHEN** Dark Mode is active and the user opens an AO3 story in the built-in reader
- **THEN** the built-in reader SHALL render the story webpage using a dark color scheme

#### Scenario: Opening an AO3 chapter while Light Mode is active

- **WHEN** Light Mode is active and the user opens an AO3 story in the built-in reader
- **THEN** the built-in reader SHALL render the story webpage in its standard light appearance
