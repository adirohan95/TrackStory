# Spec Delta

## Purpose

Defines a site-agnostic story provider contract and registry so the core tracking system can support multiple story websites without coupling to site-specific URLs or markup, along with the initial Archive of Our Own (AO3) provider implementation.

## ADDED Requirements

### Requirement: Provider registry resolves story URLs by site

The system SHALL maintain a registry of story providers and route any input URL to the provider that declares support for that domain and path pattern.

#### Scenario: Supported AO3 URL is matched

- **WHEN** a user submits an Archive of Our Own work or chapter URL (`archiveofourown.org/works/...`)
- **THEN** the provider registry SHALL resolve the URL to the AO3 provider

#### Scenario: Unsupported URL is rejected

- **WHEN** a user submits a URL that no registered provider supports
- **THEN** the system SHALL return an unsupported-site error without creating a tracked story record

### Requirement: Provider contract normalizes story metadata and chapter index

Every registered story provider SHALL return a normalized story payload containing the provider identifier, external story identifier, title, author name, ordered list of chapters (chapter number, chapter title, direct chapter URL, and optional publish date), and the matched chapter number if the input URL points to a specific chapter.

#### Scenario: Multi-chapter work URL with specific chapter ID

- **WHEN** a provider processes a URL pointing to chapter 12 of a 15-chapter work
- **THEN** the normalized result SHALL identify chapter 12 as the matched chapter and chapter 15 as the latest available chapter with their respective direct URLs

#### Scenario: Work-level URL without chapter segment

- **WHEN** a provider processes a work URL that does not specify an individual chapter ID
- **THEN** the normalized result SHALL return the full ordered chapter list and default the matched chapter to chapter 1

### Requirement: AO3 provider fetches chapter index via lightweight navigation page

The AO3 provider SHALL retrieve story metadata and the complete ordered chapter list from the AO3 work navigation endpoint (`/works/{workId}/navigate`) rather than downloading the full work text.

#### Scenario: Fetching an ongoing multi-chapter AO3 work

- **WHEN** the AO3 provider fetches `/works/{workId}/navigate` for a valid work
- **THEN** it SHALL extract the story title, author name, and every listed chapter's number, title, chapter URL, and publication date

#### Scenario: Fetching a single-chapter AO3 work

- **WHEN** the AO3 provider fetches a work that has only one chapter
- **THEN** it SHALL return a chapter list of length 1 pointing to `/works/{workId}`

### Requirement: AO3 provider shares session cookies for restricted works

The AO3 provider SHALL attach stored AO3 session cookies from the shared cookie store when making background HTTP requests so archive-locked works remain accessible when the user is signed in.

#### Scenario: Archive-locked work with valid session cookie

- **WHEN** the user has signed into AO3 in the app and the AO3 provider checks an archive-locked work
- **THEN** the request SHALL include the stored session cookies and parse the chapter index normally

#### Scenario: Archive-locked work without session cookie

- **WHEN** the user is not signed in and the AO3 provider receives an authentication redirect for a locked work
- **THEN** the provider SHALL report an authentication-required error for that story without overwriting previously saved chapter progress
