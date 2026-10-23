import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { storyProviderRegistry } from './server/providers/storyProvider.js';
import { ao3Provider, AuthenticationRequiredError, ProviderHttpError } from './server/providers/ao3Provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post('/api/story/check-url', (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }
    const supported = storyProviderRegistry.providerForUrl(url.trim()) !== null;
    res.json({ supported });
  });

  app.post('/api/story/metadata', async (req, res) => {
    try {
      const { url, cookie } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const { provider, parsed } = storyProviderRegistry.resolve(url.trim());
      const metadata = await provider.fetchStoryMetadata(parsed, cookie);
      res.json(metadata);
    } catch (err: any) {
      if (err instanceof AuthenticationRequiredError) {
        return res.status(401).json({ error: err.message, requiresAuth: true });
      }
      if (err instanceof ProviderHttpError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err.message || 'Unable to fetch story metadata' });
    }
  });

  app.post('/api/story/content', async (req, res) => {
    try {
      const { url, cookie } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const content = await ao3Provider.fetchChapterContent(url.trim(), cookie);
      res.json(content);
    } catch (err: any) {
      if (err instanceof AuthenticationRequiredError) {
        return res.status(401).json({ error: err.message, requiresAuth: true });
      }
      if (err instanceof ProviderHttpError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err.message || 'Unable to fetch chapter content' });
    }
  });

  // Batch sync endpoint for checking updates with polite rate-limiting
  app.post('/api/story/batch-check', async (req, res) => {
    try {
      const { stories, cookie } = req.body;
      if (!Array.isArray(stories)) {
        return res.status(400).json({ error: 'stories array is required' });
      }

      const results = [];
      for (const item of stories) {
        try {
          const { provider, parsed } = storyProviderRegistry.resolve(item.workUrl);
          const metadata = await provider.fetchStoryMetadata(parsed, cookie);
          results.push({
            id: item.id,
            success: true,
            metadata,
            hasUpdate: metadata.latestChapterNumber > (item.latestChapter || 0),
          });
        } catch (itemErr: any) {
          results.push({
            id: item.id,
            success: false,
            error: itemErr.message || 'Check failed',
          });
        }
        // Polite delay between checks
        await new Promise(r => setTimeout(r, 600));
      }

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Batch sync failed' });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackStory server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
