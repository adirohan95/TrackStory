import { TrackedStory, RemoteStoryMetadata, ThemePreference } from '../types/story';

const STORAGE_KEY = 'trackstory_tracked_stories';
const THEME_KEY = 'trackstory_theme';
const COOKIE_KEY = 'trackstory_ao3_cookie';

export class StoryRepository {
  private listeners: Set<() => void> = new Set();
  private storiesCache: TrackedStory[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.storiesCache = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load stories from storage:', e);
      this.storiesCache = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storiesCache));
      this.notify();
    } catch (e) {
      console.error('Failed to save stories to storage:', e);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  getStories(): TrackedStory[] {
    return [...this.storiesCache];
  }

  getStoryById(id: string): TrackedStory | undefined {
    return this.storiesCache.find(s => s.id === id);
  }

  getCookie(): string {
    return localStorage.getItem(COOKIE_KEY) || '';
  }

  setCookie(cookie: string) {
    localStorage.setItem(COOKIE_KEY, cookie.trim());
  }

  getTheme(): ThemePreference {
    return (localStorage.getItem(THEME_KEY) as ThemePreference) || 'SYSTEM';
  }

  setTheme(theme: ThemePreference) {
    localStorage.setItem(THEME_KEY, theme);
    this.notify();
  }

  async checkUrlSupported(url: string): Promise<boolean> {
    try {
      const res = await fetch('/api/story/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      return !!data.supported;
    } catch {
      return false;
    }
  }

  async fetchMetadata(url: string): Promise<RemoteStoryMetadata> {
    const res = await fetch('/api/story/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookie: this.getCookie() }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch story (HTTP ${res.status})`);
    }

    return await res.json();
  }

  find(url: string): TrackedStory | undefined {
    // Match by work URL or story ID from url
    const match = url.match(/\/works\/([1-9][0-9]*)/);
    if (!match) return undefined;
    const storyId = match[1];
    return this.storiesCache.find(s => s.providerId === 'ao3' && s.externalStoryId === storyId);
  }

  async addOrUpdate(url: string): Promise<TrackedStory> {
    const remote = await this.fetchMetadata(url);
    return this.applyReading(remote);
  }

  private applyReading(remote: RemoteStoryMetadata): TrackedStory {
    const existingIndex = this.storiesCache.findIndex(
      s => s.providerId === remote.providerId && s.externalStoryId === remote.externalStoryId
    );
    const existing = existingIndex >= 0 ? this.storiesCache[existingIndex] : undefined;
    const timestamp = Date.now();
    const chapter = remote.matchedChapter;

    const nextChapter = remote.chapters[chapter.number]; // chapter.number is 1-indexed, so remote.chapters[chapter.number] is the next chapter!

    const entity: TrackedStory = {
      id: existing ? existing.id : `story_${remote.providerId}_${remote.externalStoryId}`,
      providerId: remote.providerId,
      externalStoryId: remote.externalStoryId,
      title: remote.title,
      author: remote.author,
      workUrl: remote.workUrl,
      lastReadChapter: chapter.number,
      lastReadChapterTitle: chapter.title,
      lastReadUrl: chapter.url,
      lastReadScrollY: existing && existing.lastReadUrl === chapter.url ? existing.lastReadScrollY : 0,
      nextChapterUrl: nextChapter ? nextChapter.url : null,
      latestChapter: remote.latestChapterNumber,
      latestChapterTitle: remote.latestChapter.title,
      latestUrl: remote.latestChapter.url,
      latestPublishDate: remote.latestChapter.publishDate || null,
      lastCheckedAt: timestamp,
      lastUpdatedAt: timestamp,
      syncError: null,
    };

    if (existingIndex >= 0) {
      this.storiesCache[existingIndex] = entity;
    } else {
      this.storiesCache.unshift(entity);
    }

    this.saveToStorage();
    return entity;
  }

  async recordPage(url: string): Promise<TrackedStory | null> {
    const current = this.find(url);
    if (!current) return null;
    const remote = await this.fetchMetadata(url);
    // If deleted in the meantime
    if (!this.storiesCache.some(s => s.id === current.id)) return null;
    return this.applyReading(remote);
  }

  async adjustChapter(id: string, chapterNumber: number): Promise<TrackedStory | null> {
    const existing = this.getStoryById(id);
    if (!existing) return null;

    const remote = await this.fetchMetadata(existing.workUrl);
    const targetChapterNum = Math.max(1, Math.min(chapterNumber, remote.latestChapterNumber));
    const targetChapter = remote.chapters[targetChapterNum - 1];

    const updatedRemote: RemoteStoryMetadata = {
      ...remote,
      matchedChapterNumber: targetChapterNum,
      matchedChapter: targetChapter,
    };

    return this.applyReading(updatedRemote);
  }

  saveScroll(id: string, chapterUrl: string, scrollY: number) {
    const idx = this.storiesCache.findIndex(s => s.id === id);
    if (idx >= 0) {
      const s = this.storiesCache[idx];
      if (s.lastReadUrl === chapterUrl) {
        this.storiesCache[idx] = {
          ...s,
          lastReadScrollY: Math.max(0, scrollY),
        };
        this.saveToStorage();
      }
    }
  }

  delete(id: string) {
    this.storiesCache = this.storiesCache.filter(s => s.id !== id);
    this.saveToStorage();
  }

  reportSyncError(id: string, errorMessage: string) {
    const idx = this.storiesCache.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.storiesCache[idx] = {
        ...this.storiesCache[idx],
        syncError: errorMessage || 'Unable to check story',
        lastCheckedAt: Date.now(),
      };
      this.saveToStorage();
    }
  }

  applySync(id: string, remote: RemoteStoryMetadata): TrackedStory | null {
    const idx = this.storiesCache.findIndex(s => s.id === id);
    if (idx < 0) return null;
    const current = this.storiesCache[idx];
    const timestamp = Date.now();
    const hasNewChapter = remote.latestChapterNumber > current.latestChapter;
    const nextChapter = remote.chapters[current.lastReadChapter];

    const updated: TrackedStory = {
      ...current,
      title: remote.title,
      author: remote.author,
      latestChapter: remote.latestChapterNumber,
      latestChapterTitle: remote.latestChapter.title,
      latestUrl: remote.latestChapter.url,
      latestPublishDate: remote.latestChapter.publishDate || null,
      nextChapterUrl: nextChapter ? nextChapter.url : null,
      lastCheckedAt: timestamp,
      lastUpdatedAt: hasNewChapter ? timestamp : current.lastUpdatedAt,
      syncError: null,
    };

    this.storiesCache[idx] = updated;
    this.saveToStorage();
    return updated;
  }
}

export const storyRepository = new StoryRepository();
