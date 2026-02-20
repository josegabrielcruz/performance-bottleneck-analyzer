/**
 * Performance Bottleneck Analyzer API
 * Backend server for data collection and processing
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDatabase, closeDatabase } from './database';
import { errorHandler, notFoundHandler } from './middleware';
import metricsRoutes from './routes/metrics';
import sitesRoutes from './routes/sites';
import webhooksRoutes from './routes/webhooks';

// Load .env in development
try {
  require('dotenv').config();
} catch {
  /* dotenv optional */
}

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ───────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/metrics', metricsRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/webhooks', webhooksRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Server Lifecycle ────────────────────────────────────────────────────────

function start(dbPath?: string): void {
  // Initialize database (async)
  initDatabase(dbPath)
    .then(() => {
      console.log('[PBN API] Database initialized');

      const server = app.listen(PORT, () => {
        console.log(`[PBN API] Server running on http://localhost:${PORT}`);
        console.log(`[PBN API] Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Graceful shutdown
      const shutdown = (signal: string) => {
        console.log(`\n[PBN API] Received ${signal}. Shutting down gracefully...`);
        server.close(() => {
          closeDatabase();
          console.log('[PBN API] Server closed');
          process.exit(0);
        });
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((err) => {
      console.error('[PBN API] Failed to initialize database:', err);
      process.exit(1);
    });
}

// Start server when run directly
if (require.main === module) {
  start();
}

export { app, start };
