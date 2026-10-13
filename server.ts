/**
 * HostelGuard Full-Stack Server
 * Express API server hosting protected scheduler endpoints with Vite middleware integration.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { schedulerRouter } from './src/api/schedulerRouter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Mount protected scheduler endpoint called by Cloudflare Worker Cron
  app.use('/api/scheduler', schedulerRouter);

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'HostelGuard Night Roll-Call System',
      version: '2.4.0',
      timestamp: new Date().toISOString(),
    });
  });

  if (!isProd) {
    // Development mode: attach Vite dev server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HostelGuard Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[HostelGuard Server] Failed to initialize:', err);
  process.exit(1);
});
