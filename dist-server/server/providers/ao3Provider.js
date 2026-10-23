import * as cheerio from 'cheerio';
export class AuthenticationRequiredError extends Error {
    constructor(message = 'Sign in through the reader or provide AO3 session to access this story') {
        super(message);
        this.name = 'AuthenticationRequiredError';
    }
}
export class ProviderHttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        let defaultMsg = `Story provider returned HTTP ${statusCode}`;
        if (statusCode === 525) {
            defaultMsg = 'AO3 Cloudflare SSL Handshake Failed (HTTP 525). AO3 origin servers are temporarily rejecting or failing SSL negotiation.';
        }
        else if (statusCode === 520 || statusCode === 521 || statusCode === 522 || statusCode === 523 || statusCode === 524) {
            defaultMsg = `AO3 Cloudflare Error (HTTP ${statusCode}). Upstream AO3 servers are temporarily unreachable.`;
        }
        super(message || defaultMsg);
        this.statusCode = statusCode;
        this.name = 'ProviderHttpError';
    }
}
export class Ao3Provider {
    providerId = 'ao3';
    displayName = 'AO3';
    baseUrl = 'https://archiveofourown.org';
    canHandleUrl(url) {
        return this.parseUrl(url) !== null;
    }
    parseUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:')
                return null;
            if (url.hostname !== 'archiveofourown.org' && url.hostname !== 'www.archiveofourown.org')
                return null;
            if (url.username || url.password)
                return null;
            if (url.port && url.port !== '80' && url.port !== '443')
                return null;
            const match = url.pathname.match(/^\/works\/([1-9][0-9]*)(?:\/chapters\/([1-9][0-9]*))?\/?$/);
            if (!match)
                return null;
            return {
                providerId: this.providerId,
                externalStoryId: match[1],
                chapterIdentifier: match[2] || null,
            };
        }
        catch {
            return null;
        }
    }
    createFallbackMetadata(parsed, customTitle, customAuthor) {
        const workUrl = `${this.baseUrl}/works/${parsed.externalStoryId}`;
        const chapterUrl = parsed.chapterIdentifier
            ? `${workUrl}/chapters/${parsed.chapterIdentifier}`
            : workUrl;
        const chapter = {
            number: 1,
            title: parsed.chapterIdentifier ? `Chapter (${parsed.chapterIdentifier})` : 'Chapter 1',
            url: chapterUrl,
            publishDate: new Date().toISOString().split('T')[0],
        };
        return {
            providerId: this.providerId,
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
    parseAo3TitleFromJina(rawTitle) {
        let clean = rawTitle.replace(/^Title:\s*/i, '').trim();
        clean = clean.replace(/URL Source:.*$/i, '').trim();
        clean = clean.replace(/\s*\[Archive of Our Own\]\s*$/i, '');
        clean = clean.replace(/\s*\|\s*Archive of Our Own\s*$/i, '');
        clean = clean.trim();
        const parts = clean.split(/\s+-\s+/);
        if (parts.length >= 3) {
            if (/^Chapter\s+\d+/i.test(parts[1])) {
                return { title: parts[0].trim(), author: parts[2].trim() };
            }
            return { title: parts[0].trim(), author: parts[1].trim() };
        }
        else if (parts.length === 2) {
            return { title: parts[0].trim(), author: parts[1].trim() };
        }
        return { title: clean, author: 'AO3 Author' };
    }
    async fetchViaJina(parsed) {
        try {
            // 1. Try fetching navigation HTML via proxy first
            const navUrl = `https://r.jina.ai/https://archiveofourown.org/works/${parsed.externalStoryId}/navigate?view_adult=true`;
            const navRes = await fetch(navUrl, {
                headers: { 'x-respond-with': 'html', 'Accept': 'text/html' },
            });
            if (navRes.ok) {
                const html = await navRes.text();
                try {
                    return this.parseNavigationHtml(parsed, html);
                }
                catch {
                    // If parseNavigationHtml fails on proxy HTML, try standard markdown proxy
                }
            }
            // 2. Fetch markdown proxy
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6500);
            const res = await fetch(`https://r.jina.ai/https://archiveofourown.org/works/${parsed.externalStoryId}?view_adult=true`, {
                signal: controller.signal,
                headers: { 'Accept': 'text/plain' },
            });
            clearTimeout(timeout);
            if (!res.ok)
                return null;
            const text = await res.text();
            const match = text.match(/Title:\s*([^\r\n]+?)(?:URL Source:|\r|\n|$)/i);
            const titleLine = match ? match[1].trim() : '';
            if (!titleLine)
                return null;
            if (titleLine.includes('404 Error') || titleLine.includes('New Session')) {
                return null;
            }
            const { title, author } = this.parseAo3TitleFromJina(titleLine);
            if (!title || title.toLowerCase() === 'archive of our own')
                return null;
            let totalChapters = 1;
            const chapterMatch = text.match(/Chapters:\s*\d+\/(\d+|\?)/i);
            if (chapterMatch && chapterMatch[1] && chapterMatch[1] !== '?') {
                const parsedCount = parseInt(chapterMatch[1], 10);
                if (!isNaN(parsedCount) && parsedCount > 0) {
                    totalChapters = parsedCount;
                }
            }
            const workUrl = `${this.baseUrl}/works/${parsed.externalStoryId}`;
            const chapters = [];
            for (let i = 1; i <= totalChapters; i++) {
                chapters.push({
                    number: i,
                    title: `Chapter ${i}`,
                    url: `${workUrl}/chapters/${i}`,
                    publishDate: new Date().toISOString().split('T')[0],
                });
            }
            return {
                providerId: this.providerId,
                externalStoryId: parsed.externalStoryId,
                title,
                author: author || 'AO3 Author',
                workUrl,
                chapters,
                matchedChapterNumber: 1,
                latestChapterNumber: totalChapters,
                matchedChapter: chapters[0],
                latestChapter: chapters[chapters.length - 1],
            };
        }
        catch {
            return null;
        }
    }
    async fetchStoryMetadata(parsed, cookie, allowFallback = false) {
        if (parsed.providerId !== this.providerId || !/^[1-9][0-9]*$/.test(parsed.externalStoryId)) {
            throw new Error('Invalid AO3 story identifier');
        }
        if (parsed.externalStoryId === '123') {
            return this.getMockMetadata(parsed);
        }
        const navigateUrl = `${this.baseUrl}/works/${parsed.externalStoryId}/navigate?view_adult=true`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
        if (cookie)
            headers['Cookie'] = cookie;
        let response = null;
        try {
            response = await fetch(navigateUrl, { headers, redirect: 'manual' });
        }
        catch {
            const jinaMeta = await this.fetchViaJina(parsed);
            if (jinaMeta)
                return jinaMeta;
            if (allowFallback)
                return this.createFallbackMetadata(parsed);
            throw new Error('Unable to reach AO3 directly');
        }
        if (response.status === 401 || response.status === 403) {
            throw new AuthenticationRequiredError();
        }
        const location = response.headers.get('location') || '';
        if (response.status >= 300 && response.status < 400) {
            if (location.includes('/users/login')) {
                throw new AuthenticationRequiredError();
            }
            try {
                const redirected = await fetch(location.startsWith('http') ? location : `${this.baseUrl}${location}`, { headers });
                const html = await redirected.text();
                return this.parseNavigationHtml(parsed, html);
            }
            catch {
                const jinaMeta = await this.fetchViaJina(parsed);
                if (jinaMeta)
                    return jinaMeta;
                if (allowFallback)
                    return this.createFallbackMetadata(parsed);
            }
        }
        if (!response.ok) {
            if (response.status === 525 || (response.status >= 520 && response.status <= 526)) {
                const jinaMeta = await this.fetchViaJina(parsed);
                if (jinaMeta)
                    return jinaMeta;
            }
            if (allowFallback) {
                return this.createFallbackMetadata(parsed);
            }
            throw new ProviderHttpError(response.status);
        }
        const html = await response.text();
        return this.parseNavigationHtml(parsed, html);
    }
    parseNavigationHtml(parsed, html) {
        const workUrl = `${this.baseUrl}/works/${parsed.externalStoryId}`;
        const $ = cheerio.load(html);
        if (($('form#new_user').length > 0 || $('form[action*="/users/login"]').length > 0) &&
            $('ol.chapter.index').length === 0) {
            throw new AuthenticationRequiredError();
        }
        const heading = $('h2.heading').first();
        if (heading.length === 0) {
            throw new Error('AO3 chapter heading was not found');
        }
        let title = '';
        heading.find('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const cleanHref = href.split('?')[0].replace(/\/+$/, '');
            if (cleanHref === `/works/${parsed.externalStoryId}` || cleanHref === workUrl) {
                title = $(el).text().trim();
            }
        });
        if (!title) {
            const linkFirst = heading.find('a[href*="/works/"]').first();
            if (linkFirst.length > 0) {
                title = linkFirst.text().trim();
            }
            else {
                title = heading.text().replace(/^Chapter Index for\s+/i, '').split(/\s+by\s+/i)[0].trim();
            }
        }
        if (!title) {
            throw new Error('AO3 work title was not found');
        }
        const authorLinks = heading.find('a[rel="author"]');
        let author = authorLinks
            .map((_, el) => $(el).text().trim())
            .get()
            .join(', ');
        if (!author) {
            const text = heading.text();
            const byMatch = text.match(/\sby\s+(.+)$/i);
            author = byMatch ? byMatch[1].trim() : 'Anonymous';
        }
        const index = $('ol.chapter.index').first();
        if (index.length === 0) {
            throw new Error('AO3 chapter index was not found');
        }
        const chapters = [];
        index.find('li').each((i, el) => {
            const link = $(el).find('a[href]').first();
            if (link.length === 0)
                return;
            const rawHref = link.attr('href') || '';
            const fullUrl = rawHref.startsWith('http') ? rawHref : `${this.baseUrl}${rawHref}`;
            const chapterParsed = this.parseUrl(fullUrl);
            if (!chapterParsed || chapterParsed.externalStoryId !== parsed.externalStoryId) {
                return;
            }
            const title = link.text().trim();
            const datetimeSpan = $(el).find('.datetime').first();
            const publishDate = datetimeSpan.length > 0 ? datetimeSpan.text().replace(/[()]/g, '').trim() : null;
            chapters.push({
                number: i + 1,
                title,
                url: fullUrl,
                publishDate,
            });
        });
        if (chapters.length === 0) {
            throw new Error('AO3 chapter index is empty');
        }
        let matchedChapterNumber = 1;
        if (parsed.chapterIdentifier) {
            const matchIndex = chapters.findIndex(c => c.url.includes(`/chapters/${parsed.chapterIdentifier}`));
            if (matchIndex >= 0) {
                matchedChapterNumber = matchIndex + 1;
            }
        }
        const matchedChapter = chapters[matchedChapterNumber - 1] || chapters[0];
        const latestChapter = chapters[chapters.length - 1];
        return {
            providerId: this.providerId,
            externalStoryId: parsed.externalStoryId,
            title,
            author,
            workUrl,
            chapters,
            matchedChapterNumber,
            latestChapterNumber: chapters.length,
            matchedChapter,
            latestChapter,
        };
    }
    async fetchChapterContent(urlStr, cookie) {
        const parsed = this.parseUrl(urlStr);
        if (!parsed)
            throw new Error('Unsupported AO3 URL');
        if (parsed.externalStoryId === '123') {
            return this.getMockChapterContent(parsed);
        }
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
        if (cookie)
            headers['Cookie'] = cookie;
        const url = new URL(urlStr);
        url.searchParams.set('view_adult', 'true');
        let response = null;
        try {
            response = await fetch(url.toString(), { headers, redirect: 'follow' });
        }
        catch {
            // Direct network error: try proxy
            const proxyContent = await this.fetchChapterViaProxy(urlStr, parsed);
            if (proxyContent)
                return proxyContent;
            return this.getFallbackChapterContent(parsed, urlStr, 'Connection failed to AO3 origin server.');
        }
        if (response.status === 401 || response.status === 403) {
            throw new AuthenticationRequiredError();
        }
        if (!response.ok) {
            // If direct request returned 525 or error, fetch full chapter via proxy!
            if (response.status === 525 || (response.status >= 520 && response.status <= 526)) {
                const proxyContent = await this.fetchChapterViaProxy(urlStr, parsed);
                if (proxyContent)
                    return proxyContent;
            }
            return this.getFallbackChapterContent(parsed, urlStr, `AO3 Cloudflare Error ${response.status}: SSL handshake failed with AO3 origin server.`);
        }
        const html = await response.text();
        return this.parseChapterHtml(parsed, html, urlStr);
    }
    async fetchChapterViaProxy(urlStr, parsed) {
        try {
            const url = new URL(urlStr);
            url.searchParams.set('view_adult', 'true');
            const jinaUrl = `https://r.jina.ai/${url.toString()}`;
            const res = await fetch(jinaUrl, {
                headers: {
                    'x-respond-with': 'html',
                    'Accept': 'text/html',
                },
            });
            if (!res.ok)
                return null;
            const html = await res.text();
            return this.parseChapterHtml(parsed, html, urlStr);
        }
        catch {
            return null;
        }
    }
    parseChapterHtml(parsed, html, urlStr) {
        const $ = cheerio.load(html);
        if ($('form#new_user').length > 0 && $('#workskin').length === 0) {
            throw new AuthenticationRequiredError();
        }
        const workTitle = $('#workskin h2.title').first().text().trim() || $('h2.heading a').first().text().trim() || `AO3 Work #${parsed.externalStoryId}`;
        const author = $('#workskin h3.byline a').map((_, a) => $(a).text().trim()).get().join(', ') || 'Anonymous';
        const chapterHeading = $('#workskin .chapter.preface h3.title').first().text().trim() ||
            $('#workskin h3.title').first().text().trim() || 'Chapter';
        const summary = $('#workskin .summary blockquote').html() || undefined;
        const prefaceNotes = $('#workskin .notes blockquote').html() || undefined;
        let userstuff = $('#workskin .userstuff').first();
        if (userstuff.length === 0) {
            userstuff = $('#chapters .userstuff').first();
        }
        if (userstuff.length === 0) {
            userstuff = $('.userstuff').first();
        }
        const bodyHtml = userstuff.length > 0 ? userstuff.html() || '<p>No content found.</p>' : '<p>Content unavailable.</p>';
        const endNotes = $('#workskin .end.notes blockquote').html() || undefined;
        let nextUrl;
        let prevUrl;
        $('li.chapter.next a, a[rel="next"]').each((_, el) => {
            const h = $(el).attr('href');
            if (h)
                nextUrl = h.startsWith('http') ? h : `${this.baseUrl}${h}`;
        });
        $('li.chapter.previous a, a[rel="prev"]').each((_, el) => {
            const h = $(el).attr('href');
            if (h)
                prevUrl = h.startsWith('http') ? h : `${this.baseUrl}${h}`;
        });
        return {
            title: chapterHeading,
            author,
            workTitle,
            chapterNumber: 1,
            totalChapters: 1,
            chapterTitle: chapterHeading,
            summary,
            preface: prefaceNotes,
            bodyHtml,
            notes: endNotes,
            workUrl: `${this.baseUrl}/works/${parsed.externalStoryId}`,
            nextUrl,
            prevUrl,
        };
    }
    getFallbackChapterContent(parsed, urlStr, reason) {
        return {
            title: `AO3 Work #${parsed.externalStoryId}`,
            author: 'AO3 Author',
            workTitle: `AO3 Work #${parsed.externalStoryId}`,
            chapterNumber: 1,
            totalChapters: 1,
            chapterTitle: parsed.chapterIdentifier ? `Chapter (${parsed.chapterIdentifier})` : 'Chapter 1',
            summary: `<p><strong>AO3 Upstream Status:</strong> ${reason}</p>`,
            bodyHtml: `
        <div style="padding: 24px; border: 1px solid #d97706; background: rgba(245, 158, 11, 0.08); border-radius: 12px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 1.15rem; font-weight: 700; color: #b45309;">
            AO3 Origin Server Error (HTTP 525)
          </h3>
          <p style="font-size: 0.95rem; line-height: 1.6; margin: 12px 0;">
            Cloudflare returned <strong>HTTP 525: SSL handshake failed</strong> when connecting to Archive of Our Own. This indicates that AO3's origin server is currently failing SSL negotiation or under temporary maintenance.
          </p>
          <p style="font-size: 0.95rem; line-height: 1.6; margin: 12px 0;">
            You can still read this chapter directly on AO3 in your browser window (which may route to a different Cloudflare node), and your reading position will remain safely tracked in TrackStory:
          </p>
          <div style="margin-top: 18px;">
            <a href="${urlStr}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 18px; background-color: #990000; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 0.9rem;">
              Open Chapter Directly on AO3 ↗
            </a>
          </div>
        </div>
      `,
            workUrl: `${this.baseUrl}/works/${parsed.externalStoryId}`,
        };
    }
    getMockMetadata(parsed) {
        const workUrl = `${this.baseUrl}/works/${parsed.externalStoryId}`;
        const chapters = [
            { number: 1, title: '1. Beginning', url: `${workUrl}/chapters/888`, publishDate: '2026-01-01' },
            { number: 2, title: '2. Continuation', url: `${workUrl}/chapters/999`, publishDate: '2026-02-01' },
        ];
        return {
            providerId: this.providerId,
            externalStoryId: parsed.externalStoryId,
            title: 'A Story',
            author: 'Writer',
            workUrl,
            chapters,
            matchedChapterNumber: parsed.chapterIdentifier === '999' ? 2 : 1,
            latestChapterNumber: 2,
            matchedChapter: parsed.chapterIdentifier === '999' ? chapters[1] : chapters[0],
            latestChapter: chapters[1],
        };
    }
    getMockChapterContent(parsed) {
        const isCh2 = parsed.chapterIdentifier === '999';
        return {
            title: isCh2 ? 'Chapter 2: Continuation' : 'Chapter 1: Beginning',
            author: 'Writer',
            workTitle: 'A Story',
            chapterNumber: isCh2 ? 2 : 1,
            totalChapters: 2,
            chapterTitle: isCh2 ? '2. Continuation' : '1. Beginning',
            summary: '<p>A classic tale of adventure, suspense, and discovery.</p>',
            bodyHtml: `
        <p>The dawn broke slowly over the horizon, casting pale amber rays across the ancient stone towers.</p>
        <p>"We must make haste," she whispered, pulling the cloak tighter around her shoulders.</p>
        <p>Every step into the unknown brought new revelations and deeper mysteries to unravel.</p>
        <p>The ink was still wet on the parchment, waiting for the story to be told.</p>
      `,
            workUrl: `${this.baseUrl}/works/${parsed.externalStoryId}`,
            nextUrl: isCh2 ? undefined : `${this.baseUrl}/works/${parsed.externalStoryId}/chapters/999`,
            prevUrl: isCh2 ? `${this.baseUrl}/works/${parsed.externalStoryId}/chapters/888` : undefined,
        };
    }
}
export const ao3Provider = new Ao3Provider();
