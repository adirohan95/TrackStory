export interface ChapterInfo {
  number: number;
  title: string;
  url: string;
  publishDate?: string | null;
}

export interface RemoteStoryMetadata {
  providerId: string;
  externalStoryId: string;
  title: string;
  author: string;
  workUrl: string;
  chapters: ChapterInfo[];
  matchedChapterNumber: number;
  latestChapterNumber: number;
  matchedChapter: ChapterInfo;
  latestChapter: ChapterInfo;
}

export interface TrackedStory {
  id: string;
  providerId: string;
  externalStoryId: string;
  title: string;
  author: string;
  workUrl: string;
  lastReadChapter: number;
  lastReadChapterTitle: string;
  lastReadUrl: string;
  lastReadScrollY: number;
  nextChapterUrl?: string | null;
  latestChapter: number;
  latestChapterTitle: string;
  latestUrl: string;
  latestPublishDate?: string | null;
  lastCheckedAt: number;
  lastUpdatedAt: number;
  syncError?: string | null;
}

export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';

export interface ParsedStoryUrl {
  providerId: string;
  externalStoryId: string;
  chapterIdentifier?: string | null;
}

export interface ChapterContentResponse {
  title: string;
  author: string;
  workTitle: string;
  chapterNumber: number;
  totalChapters: number;
  chapterTitle: string;
  summary?: string;
  preface?: string;
  bodyHtml: string;
  notes?: string;
  workUrl: string;
  nextUrl?: string;
  prevUrl?: string;
}
