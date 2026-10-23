import { storyRepository } from './storyRepository';
import { TrackedStory } from '../types/story';
import { safeFetchJson } from './safeFetch';

export class SyncScheduler {
  private intervalId: any = null;
  private isRefreshing = false;
  private refreshListeners: Set<(refreshing: boolean) => void> = new Set();
  private updateListeners: Set<(updatedStories: TrackedStory[]) => void> = new Set();

  constructor() {
    this.startHourlySchedule();
  }

  onRefreshState(listener: (refreshing: boolean) => void): () => void {
    this.refreshListeners.add(listener);
    return () => this.refreshListeners.delete(listener);
  }

  onUpdatesFound(listener: (updatedStories: TrackedStory[]) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  private setRefreshing(val: boolean) {
    this.isRefreshing = val;
    this.refreshListeners.forEach(fn => fn(val));
  }

  get refreshing(): boolean {
    return this.isRefreshing;
  }

  startHourlySchedule() {
    if (this.intervalId) clearInterval(this.intervalId);
    // 1 hour interval
    this.intervalId = setInterval(() => {
      this.refresh();
    }, 60 * 60 * 1000);
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.error('Notification permission error:', e);
      }
    }
  }

  async refresh(): Promise<TrackedStory[]> {
    if (this.isRefreshing) return [];
    this.setRefreshing(true);

    const stories = storyRepository.getStories();
    if (stories.length === 0) {
      this.setRefreshing(false);
      return [];
    }

    const updatedStories: TrackedStory[] = [];

    try {
      // Use batch check endpoint with polite rate-limiting
      const { results } = await safeFetchJson<{ results: any[] }>('/api/story/batch-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stories: stories.map(s => ({
            id: s.id,
            workUrl: s.workUrl,
            latestChapter: s.latestChapter,
          })),
          cookie: storyRepository.getCookie(),
        }),
      });

      for (const item of results) {
        if (item.success && item.metadata) {
          const beforeStory = storyRepository.getStoryById(item.id);
          const saved = storyRepository.applySync(item.id, item.metadata);
          if (saved && beforeStory && item.metadata.latestChapterNumber > beforeStory.latestChapter) {
            updatedStories.push(saved);
          }
        } else if (!item.success) {
          storyRepository.reportSyncError(item.id, item.error || 'Check failed');
        }
      }

      if (updatedStories.length > 0) {
        this.notifyUserOfUpdates(updatedStories);
        this.updateListeners.forEach(fn => fn(updatedStories));
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      this.setRefreshing(false);
    }

    return updatedStories;
  }

  private notifyUserOfUpdates(stories: TrackedStory[]) {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (stories.length === 1) {
        new Notification(`TrackStory: ${stories[0].title} updated`, {
          body: `Chapter ${stories[0].latestChapter}: ${stories[0].latestChapterTitle} is now available!`,
          icon: '/favicon.ico',
        });
      } else {
        new Notification(`TrackStory: ${stories.length} stories updated`, {
          body: `${stories.map(s => s.title).slice(0, 3).join(', ')} have new chapters.`,
          icon: '/favicon.ico',
        });
      }
    }
  }
}

export const syncScheduler = new SyncScheduler();
