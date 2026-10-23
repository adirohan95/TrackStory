import React, { useState, useRef, useEffect } from 'react';
import { TrackedStory } from '../types/story';
import { ExternalLink, BookOpen, MoreVertical, ChevronRight, ChevronLeft, Trash2, AlertCircle, Edit3 } from 'lucide-react';

interface StoryCardProps {
  story: TrackedStory;
  busy: boolean;
  onRead: (url: string) => void;
  onExternal: (url: string) => void;
  onAdjustChapter: (id: string, chapter: number) => void;
  onDelete: (story: TrackedStory) => void;
  onEdit: (story: TrackedStory) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  busy,
  onRead,
  onExternal,
  onAdjustChapter,
  onDelete,
  onEdit,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unreadCount = Math.max(0, story.latestChapter - story.lastReadChapter);
  const isPlaceholder = story.title.startsWith('AO3 Work #') || story.author === 'AO3 Author';

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  return (
    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header with Title, Manage Menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate tracking-tight">
            {story.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            by {story.author}
          </p>
          {isPlaceholder && (
            <button
              onClick={() => onEdit(story)}
              className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Set real title & author name</span>
            </button>
          )}
        </div>

        {/* Manage Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Manage story"
          >
            <span>Manage</span>
            <MoreVertical className="w-4 h-4 opacity-70" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20">
              <button
                disabled={busy || story.lastReadChapter <= 1}
                onClick={() => {
                  setMenuOpen(false);
                  onAdjustChapter(story.id, story.lastReadChapter - 1);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>− Previous chapter</span>
              </button>

              <button
                disabled={busy || story.lastReadChapter >= story.latestChapter}
                onClick={() => {
                  setMenuOpen(false);
                  onAdjustChapter(story.id, story.lastReadChapter + 1);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                <span>+ Next chapter</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(story);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit title & author</span>
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(story);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove story</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Read {story.lastReadChapter} / {story.latestChapter}
          </span>
          <span className="text-gray-400">·</span>
          {unreadCount > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {unreadCount} unread
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Caught up
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {story.lastReadChapterTitle || `Chapter ${story.lastReadChapter}`}
        </p>

        {story.syncError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{story.syncError}</span>
          </div>
        )}
      </div>

      {/* Primary Actions: In-App Reader */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onRead(story.lastReadUrl)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#990000] hover:bg-[#800000] text-white shadow-sm transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>Resume</span>
        </button>

        {story.nextChapterUrl && (
          <button
            onClick={() => onRead(story.nextChapterUrl!)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => onRead(story.latestUrl)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Latest
        </button>
      </div>

      {/* Secondary Actions: External Browser */}
      <div className="mt-2.5 space-y-1">
        <button
          onClick={() => onExternal(story.lastReadUrl)}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
        >
          <span>Resume in default browser</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        <button
          disabled={busy}
          onClick={() => {
            onExternal(story.latestUrl);
            onAdjustChapter(story.id, story.latestChapter);
          }}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 flex items-center gap-1 transition-colors"
        >
          <span>Latest in default browser · mark read</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
