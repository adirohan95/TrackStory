import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrackedStory, ChapterContentResponse } from '../types/story';
import { storyRepository } from '../services/storyRepository';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  AlertCircle,
  Type,
  Sun,
  Moon,
} from 'lucide-react';

interface ReaderScreenProps {
  initialUrl: string;
  onBack: () => void;
  onExternal: (url: string) => void;
}

export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  initialUrl,
  onBack,
  onExternal,
}) => {
  const { isDark, theme, setTheme } = useTheme();
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [story, setStory] = useState<TrackedStory | undefined>(() => storyRepository.find(initialUrl));
  const [supported, setSupported] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<ChapterContentResponse | null>(null);

  // Reader typography preferences
  const [fontSize, setFontSize] = useState<number>(() => {
    return parseInt(localStorage.getItem('trackstory_reader_font_size') || '18', 10);
  });
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>(() => {
    return (localStorage.getItem('trackstory_reader_font_family') as 'serif' | 'sans') || 'serif';
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);
  const latestScrollYRef = useRef<number>(0);
  const restoringRef = useRef<boolean>(true);

  // Update story state if repository changes
  useEffect(() => {
    return storyRepository.subscribe(() => {
      setStory(storyRepository.find(currentUrl));
    });
  }, [currentUrl]);

  // Load chapter content whenever currentUrl changes
  useEffect(() => {
    let active = true;
    const loadChapter = async () => {
      setLoading(true);
      setError(null);
      restoringRef.current = true;

      try {
        const isSupp = await storyRepository.checkUrlSupported(currentUrl);
        if (!active) return;
        setSupported(isSupp);

        const cookie = storyRepository.getCookie();
        const res = await fetch('/api/story/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: currentUrl, cookie }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Unable to load chapter content (HTTP ${res.status})`);
        }

        const data: ChapterContentResponse = await res.json();
        if (!active) return;
        setChapterContent(data);

        // Record page reading in repository if story is already tracked
        const existing = storyRepository.find(currentUrl);
        if (existing) {
          const updated = await storyRepository.recordPage(currentUrl);
          if (active && updated) {
            setStory(updated);
          }
        }
      } catch (err: any) {
        if (!active) return;
        setError(err.message || 'Failed to load chapter');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadChapter();

    return () => {
      active = false;
      flushScroll();
    };
  }, [currentUrl]);

  // Handle scroll position restoration
  useEffect(() => {
    if (!loading && chapterContent) {
      const existing = storyRepository.find(currentUrl);
      const targetY = existing?.lastReadUrl === currentUrl ? existing.lastReadScrollY : 0;
      
      const timer = setTimeout(() => {
        if (scrollContainerRef.current && targetY > 0) {
          scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'instant' });
        }
        restoringRef.current = false;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [loading, chapterContent, currentUrl]);

  // Flush pending scroll changes
  const flushScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    const currentStory = storyRepository.find(currentUrl);
    if (currentStory) {
      storyRepository.saveScroll(currentStory.id, currentUrl, latestScrollYRef.current);
    }
  }, [currentUrl]);

  // Debounced scroll listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (restoringRef.current) return;
    const y = e.currentTarget.scrollTop;
    latestScrollYRef.current = y;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      flushScroll();
    }, 350);
  };

  // Track button action
  const handleTrack = async () => {
    setBusy(true);
    setError(null);
    try {
      const added = await storyRepository.addOrUpdate(currentUrl);
      setStory(added);
      storyRepository.saveScroll(added.id, currentUrl, latestScrollYRef.current);
    } catch (err: any) {
      setError(err.message || 'Unable to track story');
    } finally {
      setBusy(false);
    }
  };

  // Navigate to another chapter within the reader
  const handleNavigateChapter = (newUrl: string) => {
    flushScroll();
    setCurrentUrl(newUrl);
  };

  const changeFontSize = (delta: number) => {
    const next = Math.min(28, Math.max(14, fontSize + delta));
    setFontSize(next);
    localStorage.setItem('trackstory_reader_font_size', next.toString());
  };

  const toggleFontFamily = () => {
    const next = fontFamily === 'serif' ? 'sans' : 'serif';
    setFontFamily(next);
    localStorage.setItem('trackstory_reader_font_family', next);
  };

  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${isDark ? 'reader-dark-skin' : 'bg-[#fcfbf9] text-gray-900'}`}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#181818]/95 backdrop-blur shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              flushScroll();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100 max-w-xs md:max-w-md">
              {story?.title || chapterContent?.workTitle || 'Reader'}
            </h1>
            {story && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Chapter {story.lastReadChapter} / {story.latestChapter}
              </p>
            )}
          </div>
        </div>

        {/* Reader actions */}
        <div className="flex items-center gap-2">
          {/* Typography & Appearance toggles */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 bg-gray-50 dark:bg-gray-800/60">
            <button
              onClick={() => changeFontSize(-2)}
              title="Decrease font size"
              className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              A-
            </button>
            <button
              onClick={() => changeFontSize(2)}
              title="Increase font size"
              className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              A+
            </button>
            <button
              onClick={toggleFontFamily}
              title={`Switch font (${fontFamily})`}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex items-center gap-1"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="uppercase text-[10px]">{fontFamily}</span>
            </button>
            <button
              onClick={() => setTheme(isDark ? 'LIGHT' : 'DARK')}
              title="Toggle theme"
              className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* + Track Button if not tracked */}
          {supported && !story && (
            <button
              onClick={handleTrack}
              disabled={busy || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#990000] hover:bg-[#800000] text-white rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track</span>
            </button>
          )}

          {/* Open external browser */}
          <button
            onClick={() => onExternal(currentUrl)}
            title="Open in AO3"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span>AO3</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Loading Progress Bar */}
      {(loading || busy) && (
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div className="w-full h-full bg-[#990000] animate-pulse" />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="font-medium underline hover:text-red-900 dark:hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Reader Scroll View */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-12"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {loading && !chapterContent ? (
            <div className="space-y-4 py-12 text-center text-gray-500 dark:text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto animate-bounce opacity-60" />
              <p className="text-sm">Retrieving story chapter…</p>
            </div>
          ) : chapterContent ? (
            <article className={`space-y-6 ${fontFamily === 'serif' ? 'font-serif' : 'font-sans'}`}>
              {/* Story Header */}
              <div className="border-b border-gray-200 dark:border-gray-800 pb-6 text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-sans">
                  {chapterContent.workTitle}
                </h1>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-sans">
                  by <span className="font-semibold">{chapterContent.author}</span>
                </p>
                {chapterContent.chapterTitle && (
                  <h2 className="text-lg md:text-xl font-medium text-[#990000] dark:text-[#ff8a80] pt-2">
                    {chapterContent.chapterTitle}
                  </h2>
                )}
              </div>

              {/* Summary / Notes if present */}
              {chapterContent.summary && (
                <div className="bg-gray-100 dark:bg-[#1e1e1e] border-l-4 border-[#990000] p-4 rounded-r-lg text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                    Summary
                  </span>
                  <div
                    dangerouslySetInnerHTML={{ __html: chapterContent.summary }}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />
                </div>
              )}

              {chapterContent.preface && (
                <div className="bg-gray-50 dark:bg-[#1a1a1a] border-l-4 border-gray-400 p-4 rounded-r-lg text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                    Chapter Notes
                  </span>
                  <div
                    dangerouslySetInnerHTML={{ __html: chapterContent.preface }}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />
                </div>
              )}

              {/* Main Chapter Content */}
              <div
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
                className="prose dark:prose-invert max-w-none text-gray-800 dark:text-[#e0e0e0] space-y-4 tracking-normal"
                dangerouslySetInnerHTML={{ __html: chapterContent.bodyHtml }}
              />

              {/* End Notes */}
              {chapterContent.notes && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                    End Notes
                  </span>
                  <div
                    dangerouslySetInnerHTML={{ __html: chapterContent.notes }}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />
                </div>
              )}

              {/* Bottom Navigation */}
              <div className="pt-8 pb-12 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 font-sans">
                {chapterContent.prevUrl ? (
                  <button
                    onClick={() => handleNavigateChapter(chapterContent.prevUrl!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous Chapter</span>
                  </button>
                ) : (
                  <div />
                )}

                {chapterContent.nextUrl ? (
                  <button
                    onClick={() => handleNavigateChapter(chapterContent.nextUrl!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#990000] hover:bg-[#800000] text-white shadow-sm transition-colors"
                  >
                    <span>Next Chapter</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    You've reached the latest chapter!
                  </span>
                )}
              </div>
            </article>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <p>No content could be loaded for this chapter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
