import React, { useState, useEffect } from 'react';
import { storyRepository } from '../services/storyRepository';
import { Link2, BookOpen, Plus, X } from 'lucide-react';

interface AddStoryDialogProps {
  isOpen: boolean;
  busy: boolean;
  onClose: () => void;
  onTrack: (url: string) => void;
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
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setIsSupported(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !busy) {
      onTrack(input.trim());
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Story or chapter URL
            </label>
            <input
              type="url"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="https://archiveofourown.org/works/..."
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#990000] focus:border-transparent text-sm transition-all"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Supports any AO3 work or chapter link (e.g. archiveofourown.org/works/123).
            </p>
          </div>

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
                <span>Track</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
