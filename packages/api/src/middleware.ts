/**
 * Express middleware: authentication, rate limiting, validation, error handling
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { getSiteByApiKey } from './database';
import { IncomingMetricPayload } from './types';

// ─── Authentication ──────────────────────────────────────────────────────────

/**
 * API key authentication middleware
 * Expects header: x-api-key: <key>
 * Attaches the site record to req.site
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-api-key header',
      statusCode: 401,
    });
    return;
  }

  const site = getSiteByApiKey(apiKey);
  if (!site) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      statusCode: 401,
    });
    return;
  }

  // Attach site info to request for downstream handlers
  (req as Request & { site: typeof site }).site = site;
  next();
}

/**
 * Optional authentication — attaches site if key provided, continues either way
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey) {
    const site = getSiteByApiKey(apiKey);
    if (site) {
      (req as Request & { site: typeof site }).site = site;
    }
  }

  next();
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

/** Rate limiter for metric ingestion (generous: 1000 req/min per IP) */
export const ingestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again later.',
    statusCode: 429,
  },
});

/** Rate limiter for API queries (100 req/min per IP) */
export const queryRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again later.',
    statusCode: 429,
  },
});

/** Rate limiter for site management (20 req/min per IP) */
export const managementRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again later.',
    statusCode: 429,
  },
});

// ─── Validation ──────────────────────────────────────────────────────────────

/** Validate incoming metric payload */
export function validateMetricPayload(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as Partial<IncomingMetricPayload>;

  if (!body.siteId || typeof body.siteId !== 'string') {
    res.status(400).json({
      error: 'Validation Error',
      message: 'siteId is required and must be a string',
      statusCode: 400,
    });
    return;
  }

  if (!body.metrics || !Array.isArray(body.metrics) || body.metrics.length === 0) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'metrics must be a non-empty array',
      statusCode: 400,
    });
    return;
  }

  // Cap metrics per request to prevent abuse
  if (body.metrics.length > 500) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Maximum 500 metrics per request',
      statusCode: 400,
    });
    return;
  }

  // Validate each metric
  for (const metric of body.metrics) {
    if (!metric.name || typeof metric.name !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Each metric must have a name (string)',
        statusCode: 400,
      });
      return;
    }

    if (typeof metric.value !== 'number' || isNaN(metric.value)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Metric "${metric.name}" must have a numeric value`,
        statusCode: 400,
      });
      return;
    }
  }

  // Sanitize strings to prevent injection
  body.url = sanitizeString(body.url || '');
  body.referrer = sanitizeString(body.referrer || '');
  body.sessionId = sanitizeString(body.sessionId || 'unknown');

  next();
}

/** Basic string sanitization */
function sanitizeString(input: string): string {
  return input.substring(0, 2000).replace(/[<>]/g, '');
}

// ─── Error Handling ──────────────────────────────────────────────────────────

/** Global error handler */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[API Error]', err.message, err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    statusCode: 500,
  });
}

/** 404 handler */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    statusCode: 404,
  });
}
