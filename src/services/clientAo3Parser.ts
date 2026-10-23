import { ParsedStoryUrl, RemoteStoryMetadata, ChapterInfo } from '../types/story';

export function parseAo3UrlClient(rawUrl: string): ParsedStoryUrl | null {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes('archiveofourown.org')) return null;

    const match = url.pathname.match(/^\/works\/([1-9][0-9]*)(?:\/chapters\/([1-9][0-9]*))?\/?$/);
    if (!match) return null;

    return {
      providerId: 'ao3',
      externalStoryId: match[1],
      chapterIdentifier: match[2] || null,
    };
  } catch {
    return null;
  }
}

export function createClientFallbackMetadata(
  rawUrl: string,
  customTitle?: string,
  customAuthor?: string
): RemoteStoryMetadata | null {
  const parsed = parseAo3UrlClient(rawUrl);
  if (!parsed) return null;

  const workUrl = `https://archiveofourown.org/works/${parsed.externalStoryId}`;
  const chapterUrl = parsed.chapterIdentifier
    ? `${workUrl}/chapters/${parsed.chapterIdentifier}`
    : workUrl;

  const chapter: ChapterInfo = {
    number: 1,
    title: parsed.chapterIdentifier ? `Chapter (${parsed.chapterIdentifier})` : 'Chapter 1',
    url: chapterUrl,
    publishDate: new Date().toISOString().split('T')[0],
  };

  return {
    providerId: parsed.providerId,
    externalStoryId: parsed.externalStoryId,
    title: customTitle?.trim() || `AO3 Work #${parsed.externalStoryId}`,
    author: customAuthor?.trim() || 'AO3 Author',
    workUrl,
    chapters: [chapter],
    matchedChapterNumber: 1,
    latestChapterNumber: 1,
    matchedChapter: chapter,
    latestChapter: chapter,
  };
}
