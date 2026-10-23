import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { storyProviderRegistry } from './server/providers/storyProvider.js';
import { ao3Provider, AuthenticationRequiredError, ProviderHttpError } from './server/providers/ao3Provider.js';

function apiDevPlugin(): Plugin {
  return {
    name: 'trackstory-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        // Parse JSON request body
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(Buffer.from(chunk));
        }
        const bodyStr = Buffer.concat(buffers).toString('utf-8');
        let body: any = {};
        if (bodyStr) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // body parse error
          }
        }

        const pathname = req.url.split('?')[0];
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        try {
          if (pathname === '/api/story/check-url' && req.method === 'POST') {
            const url = body.url;
            const supported = Boolean(url && storyProviderRegistry.providerForUrl(url.trim()) !== null);
            res.statusCode = 200;
            return res.end(JSON.stringify({ supported }));
          }

          if (pathname === '/api/story/metadata' && req.method === 'POST') {
            const { url, cookie, allowFallback, customTitle, customAuthor } = body;
            if (!url || typeof url !== 'string') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'URL is required' }));
            }

            const { provider, parsed } = storyProviderRegistry.resolve(url.trim());
            try {
              const metadata = await provider.fetchStoryMetadata(parsed, cookie, true);
              res.statusCode = 200;
              return res.end(JSON.stringify(metadata));
            } catch (innerErr: any) {
              const jinaMeta = await ao3Provider.fetchViaJina(parsed);
              if (jinaMeta) {
                res.statusCode = 200;
                return res.end(JSON.stringify(jinaMeta));
              }
              if (allowFallback) {
                const fallback = ao3Provider.createFallbackMetadata(parsed, customTitle, customAuthor);
                res.statusCode = 200;
                return res.end(JSON.stringify(fallback));
              }
              throw innerErr;
            }
          }

          if (pathname === '/api/story/content' && req.method === 'POST') {
            const { url, cookie } = body;
            if (!url || typeof url !== 'string') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'URL is required' }));
            }
            const content = await ao3Provider.fetchChapterContent(url.trim(), cookie);
            res.statusCode = 200;
            return res.end(JSON.stringify(content));
          }

          if (pathname === '/api/story/batch-check' && req.method === 'POST') {
            const { stories, cookie } = body;
            if (!Array.isArray(stories)) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'stories array is required' }));
            }
            const results = [];
            for (const item of stories) {
              try {
                const { provider, parsed } = storyProviderRegistry.resolve(item.workUrl);
                const metadata = await provider.fetchStoryMetadata(parsed, cookie, false);
                results.push({
                  id: item.id,
                  success: true,
                  metadata,
                  hasUpdate: metadata.latestChapterNumber > (item.latestChapter || 0),
                });
              } catch (itemErr: any) {
                const is525 = itemErr instanceof ProviderHttpError && itemErr.statusCode === 525;
                results.push({
                  id: item.id,
                  success: false,
                  error: is525 ? 'AO3 origin SSL error (HTTP 525). Will retry.' : itemErr.message || 'Check failed',
                });
              }
            }
            res.statusCode = 200;
            return res.end(JSON.stringify({ results }));
          }

          // Unmatched API route: never fall through to Vite SPA index.html!
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: `API route not found: ${req.method} ${pathname}` }));
        } catch (err: any) {
          if (err instanceof AuthenticationRequiredError) {
            res.statusCode = 401;
            return res.end(JSON.stringify({ error: err.message, requiresAuth: true }));
          }
          if (err instanceof ProviderHttpError) {
            const status = (err.statusCode >= 520 && err.statusCode <= 526) ? 503 : err.statusCode;
            res.statusCode = status;
            return res.end(JSON.stringify({
              error: err.message,
              upstreamStatus: err.statusCode,
              isCloudflareError: err.statusCode >= 520 && err.statusCode <= 526,
            }));
          }
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
