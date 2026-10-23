import React, { useState, useEffect, useRef } from 'react';
import { TrackedStory, ThemePreference } from '../types/story';
import { storyRepository } from '../services/storyRepository';
import { syncScheduler } from '../services/syncScheduler';
import { useTheme } from '../context/ThemeContext';
import { StoryCard } from './StoryCard';
import { AddStoryDialog } from './AddStoryDialog';
import { CookieSettingsModal } from './CookieSettingsModal';
import {
  BookOpen,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  AlertCircle,
  Bell,
  Check,
  Library,
} from 'lucide-react';

interface DashboardScreenProps {
  onRead: (url: string) => void;
  onExternal: (url: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onRead, onExternal }) => {
  const { theme, setTheme } = useTheme();
  const [stories, setStories] = useState<TrackedStory[]>(() => storyRepository.getStories());
  const [refreshing, setRefreshing] = useState<boolean>(syncScheduler.refreshing);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [cookieModalOpen, setCookieModalOpen] = useState<boolean>(false);
  const [deletingStory, setDeletingStory] = useState<TrackedStory | null>(null);

  const [themeMenuOpen, setThemeMenuOpen] = useState<boolean>(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Subscribe to story repository changes
  useEffect(() => {
    return storyRepository.subscribe(() => {
      setStories(storyRepository.getStories());
    });
  }, []);

  // Subscribe to sync scheduler refresh state
  useEffect(() => {
    return syncScheduler.onRefreshState(isRef => {
      setRefreshing(isRef);
    });
  }, []);

  // Close theme dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    if (themeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen]);

  const handleRefresh = async () => {
    try {
      setError(null);
      await syncScheduler.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to check for updates');
    }
  };

  const handleAddUrl = async (url: string) => {
    setBusy(true);
    setError(null);
    try {
      await storyRepository.addOrUpdate(url);
    } catch (err: any) {
      setError(err.message || 'Unable to track story');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustChapter = async (id: string, chapter: number) => {
    setBusy(true);
    setError(null);
    try {
      await storyRepository.adjustChapter(id, chapter);
    } catch (err: any) {
      setError(err.message || 'Unable to update chapter progress');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingStory) {
      storyRepository.delete(deletingStory.id);
      setDeletingStory(null);
    }
  };

  const updates = stories.filter(s => (s.latestChapter - s.lastReadChapter) > 0);
  const caughtUp = stories.filter(s => (s.latestChapter - s.lastReadChapter) <= 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-[#e0e0e0]">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#181818]/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#990000] flex items-center justify-center text-white shadow-sm font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              TrackStory
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* AO3 Cookie Settings Button */}
            <button
              onClick={() => setCookieModalOpen(true)}
              title="AO3 Account / Session Cookie"
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Notification Permission Request */}
            <button
              onClick={() => syncScheduler.requestNotificationPermission()}
              title="Enable update notifications"
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Theme Dropdown Menu */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {theme === 'DARK' ? (
                  <Moon className="w-4 h-4" />
                ) : theme === 'LIGHT' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                <span className="capitalize">{theme.toLowerCase()}</span>
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-30 text-sm">
                  {(['SYSTEM', 'LIGHT', 'DARK'] as ThemePreference[]).map(pref => (
                    <button
                      key={pref}
                      onClick={() => {
                        setTheme(pref);
                        setThemeMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center justify-between"
                    >
                      <span className="capitalize">{pref.toLowerCase()}</span>
                      {theme === pref && <Check className="w-4 h-4 text-[#990000] dark:text-[#ff8a80]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-28 space-y-6">
        {/* Library Subheader and Refresh Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200">
            Your reading library
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#990000]' : ''}`} />
            <span>{refreshing ? 'Checking…' : 'Refresh'}</span>
          </button>
        </div>

        {/* Linear Progress Indicator */}
        {(busy || refreshing) && (
          <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="w-full h-full bg-[#990000] animate-pulse" />
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-start justify-between gap-3 text-sm text-red-800 dark:text-red-300 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs font-semibold px-2 py-1 bg-red-100 dark:bg-red-900/60 rounded-md hover:bg-red-200 transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty State */}
        {stories.length === 0 && !busy && (
          <div className="py-16 text-center max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 text-[#990000] dark:text-[#ff8a80] flex items-center justify-center mx-auto shadow-inner">
              <Library className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Keep your place. Find your next chapter.
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Add a story URL to track chapter updates, or read it first in the built-in reader.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setAddDialogOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#990000] hover:bg-[#800000] text-white shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add your first story</span>
              </button>
            </div>
          </div>
        )}

        {/* Updates Available Section */}
        {updates.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span>Updates Available</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#990000] text-white">
                {updates.length}
              </span>
            </h3>
            <div className="grid gap-3">
              {updates.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  busy={busy}
                  onRead={onRead}
                  onExternal={onExternal}
                  onAdjustChapter={handleAdjustChapter}
                  onDelete={setDeletingStory}
                />
              ))}
            </div>
          </section>
        )}

        {/* Caught Up Section */}
        {caughtUp.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Caught Up
            </h3>
            <div className="grid gap-3">
              {caughtUp.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  busy={busy}
                  onRead={onRead}
                  onExternal={onExternal}
                  onAdjustChapter={handleAdjustChapter}
                  onDelete={setDeletingStory}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating Action Button for "+ Story" */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setAddDialogOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-white bg-[#990000] hover:bg-[#800000] shadow-lg hover:shadow-xl transition-all scale-100 hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>+ Story</span>
        </button>
      </div>

      {/* Add Story Dialog */}
      <AddStoryDialog
        isOpen={addDialogOpen}
        busy={busy}
        onClose={() => setAddDialogOpen(false)}
        onTrack={handleAddUrl}
        onReadFirst={onRead}
      />

      {/* AO3 Cookie Settings Modal */}
      <CookieSettingsModal
        isOpen={cookieModalOpen}
        onClose={() => setCookieModalOpen(false)}
      />

      {/* Remove Story Confirmation Modal */}
      {deletingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Remove story?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Stop tracking “{deletingStory.title}” and remove its saved progress?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingStory(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
