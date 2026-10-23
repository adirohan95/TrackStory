# TrackStory (React Web App)

A web story tracker and reader built with React, TypeScript, Tailwind CSS, and Express. AO3 (Archive of Our Own) is the primary provider. Track a work or chapter URL, choose **Read first** in the add dialog to read without tracking, or tap **+ Track** while reading.

## Features

- **Story Tracking Dashboard**: Keep track of in-progress and caught-up stories from AO3 with live chapter counts, titles, authors, and unread badges.
- **Reading Progress Sync**: Restores exact reading chapter and debounced vertical scroll position (`scrollY`) when resuming reading.
- **In-App Reader**: Clean reader mode with distraction-free layout, customizable font sizes (A- / A+), serif and sans-serif typography, and chapter navigation (Previous / Next).
- **AO3 Theme Matching**: Persistent Light, Dark, and System theme preferences applied seamlessly to both the UI and reader view, using AO3's dark reading skin palette.
- **Hourly & Manual Update Checks**: Automatic background checks and one-click manual **Refresh** with polite rate-limiting to discover newly published chapters.
- **Browser & External Actions**: Direct links to resume or view the latest chapter on AO3 in a new tab, with "mark read" convenience for external reading.
- **Archive-Locked Stories Support**: Configure AO3 `_otwarchive_session` cookie locally to access and track restricted works.

## Development and Running

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

## Architecture

- `server.ts` & `server/providers/`: Express backend providing CORS proxying and navigation/metadata parsing for AO3 with Cheerio (`/api/story/metadata`, `/api/story/content`, `/api/story/batch-check`).
- `src/services/storyRepository.ts`: Local storage persistence and reactive state management for tracked stories and reading history.
- `src/services/syncScheduler.ts`: Chapter update synchronization engine with Web Notifications support.
- `src/components/`:
  - `DashboardScreen`: Library dashboard with Unread Updates, Caught Up stories, refresh status, and theme controls.
  - `StoryCard`: Story entry with progress, quick navigation, and chapter management.
  - `ReaderScreen`: Built-in reading view with scroll preservation and chapter controls.
  - `AddStoryDialog`: URL input modal with "Read first" and "Track" actions.
  - `CookieSettingsModal`: AO3 session configuration modal for restricted stories.
