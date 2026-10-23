import React, { useState, useEffect } from 'react';
import { storyRepository } from '../services/storyRepository';
import { Link2, BookOpen, Plus, X, AlertTriangle, ExternalLink } from 'lucide-react';

interface AddStoryDialogProps {
  isOpen: boolean;
  busy: boolean;
  onClose: () => void;
  onTrack: (url: string, allowFallback?: boolean, customTitle?: string, customAuthor?: string) => Promise<void> | void;
  onReadFirst: (url: string) => void;
}

export const AddStoryDialog: React.FC<AddStoryDialogProps> = ({
  isOpen,
  busy,
  onClose,
  onTrack,
  onReadFirst,
}) => {
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setTitle('');
      setAuthor('');
      setIsSupported(false);
      setUpstreamError(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setIsSupported(false);
      return;
    }
    const check = async () => {
      const supported = await storyRepository.checkUrlSupported(trimmed);
      setIsSupported(supported);
    };
    check();
  }, [input]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !busy) {
      setUpstreamError(null);
      try {
        await onTrack(input.trim(), false, title.trim() || undefined, author.trim() || undefined);
        onClose();
      } catch (err: any) {
        if (err.upstreamStatus === 525 || err.isCloudflareError || err.message?.includes('525')) {
          setUpstreamError('AO3 origin is returning HTTP 525 (Cloudflare SSL handshake failed). Enter the story name and author below, then click "Track with Details" to save your story.');
        } else {
          setUpstreamError(err.message || 'Failed to add story');
        }
      }
    }
  };

  const handleTrackAnyway = async () => {
    if (input.trim()) {
      await onTrack(input.trim(), true, title.trim() || undefined, author.trim() || undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#990000]" />
            <span>Add Story URL</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {upstreamError && (
          <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                {upstreamError}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTrackAnyway}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
              >
                Track with Details
              </button>
              <a
                href={input.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300 hover:underline px-2 py-1"
              >
                <span>Check in AO3</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Story or chapter URL *
            </label>
            <input
              type="url"
              required
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="https://archiveofourown.org/works/..."
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990000] focus:border-transparent text-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Story Title (Name)
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Story name"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990000] focus:border-transparent text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Author Name
              </label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990000] focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Tip: Fill in the title and author name directly to ensure they display immediately even during AO3 downtime.
          </p>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              disabled={!isSupported}
              onClick={() => {
                onClose();
                onReadFirst(input.trim());
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read first</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#990000] hover:bg-[#800000] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{busy ? 'Connecting…' : 'Track'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
