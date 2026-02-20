/**
 * Metric routes — ingestion and querying
 */

import { Router, Request, Response } from 'express';
import {
  authenticate,
  ingestRateLimiter,
  queryRateLimiter,
  validateMetricPayload,
} from '../middleware';
import {
  insertMetrics,
  queryMetrics,
  getMetricSummary,
  getTimeSeries,
  getSiteById,
} from '../database';
import { IncomingMetricPayload, MetricsQuery } from '../types';

const router = Router();

/**
 * POST /api/metrics
 * Ingest metrics from browser agent
 * Auth: API key required
 */
router.post(
  '/',
  ingestRateLimiter,
  authenticate,
  validateMetricPayload,
  (req: Request, res: Response) => {
    try {
      const body = req.body as IncomingMetricPayload;

      const defaultContext = {
        userAgent: '',
        screenWidth: 0,
        screenHeight: 0,
        devicePixelRatio: 1,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        deviceMemory: null,
        hardwareConcurrency: 0,
        pathname: '/',
        viewportWidth: 0,
        viewportHeight: 0,
      };

      const count = insertMetrics(
        body.siteId,
        body.sessionId || 'unknown',
        body.url || '',
        body.referrer || '',
        body.context || defaultContext,
        body.metrics
      );

      res.status(201).json({
        success: true,
        received: count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Metrics Ingest Error]', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to store metrics',
        statusCode: 500,
      });
    }
  }
);

/**
 * GET /api/metrics
 * Query metrics with filters
 * Auth: API key required
 */
router.get('/', queryRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const siteId =
      (req.query.siteId as string) ||
      (req as Request & { site?: { site_id: string } }).site?.site_id;

    if (!siteId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'siteId query parameter is required',
        statusCode: 400,
      });
      return;
    }

    const query: MetricsQuery = {
      siteId,
      metricName: req.query.metricName as string,
      startTime: req.query.startTime ? Number(req.query.startTime) : undefined,
      endTime: req.query.endTime ? Number(req.query.endTime) : undefined,
      pathname: req.query.pathname as string,
      rating: req.query.rating as string,
      connectionType: req.query.connectionType as string,
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    };

    const metrics = queryMetrics(query);
    res.json({
      success: true,
      data: metrics,
      count: metrics.length,
      query,
    });
  } catch (error) {
    console.error('[Metrics Query Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to query metrics',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/metrics/summary
 * Get aggregated metric summary (avg, percentiles, ratings distribution)
 * Auth: API key required
 */
router.get('/summary', queryRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const siteId =
      (req.query.siteId as string) ||
      (req as Request & { site?: { site_id: string } }).site?.site_id;

    if (!siteId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'siteId query parameter is required',
        statusCode: 400,
      });
      return;
    }

    // Verify site exists
    const site = getSiteById(siteId);
    if (!site) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Site not found',
        statusCode: 404,
      });
      return;
    }

    const summary = getMetricSummary(
      siteId,
      req.query.metricName as string,
      req.query.startTime ? Number(req.query.startTime) : undefined,
      req.query.endTime ? Number(req.query.endTime) : undefined
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Metrics Summary Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get metric summary',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/metrics/timeseries
 * Get time-series data grouped by interval
 * Auth: API key required
 */
router.get('/timeseries', queryRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const siteId =
      (req.query.siteId as string) ||
      (req as Request & { site?: { site_id: string } }).site?.site_id;
    const metricName = req.query.metricName as string;

    if (!siteId || !metricName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'siteId and metricName query parameters are required',
        statusCode: 400,
      });
      return;
    }

    const interval = (req.query.interval as 'minute' | 'hour' | 'day') || 'hour';
    if (!['minute', 'hour', 'day'].includes(interval)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'interval must be "minute", "hour", or "day"',
        statusCode: 400,
      });
      return;
    }

    const data = getTimeSeries(
      siteId,
      metricName,
      interval,
      req.query.startTime ? Number(req.query.startTime) : undefined,
      req.query.endTime ? Number(req.query.endTime) : undefined
    );

    res.json({ success: true, data });
  } catch (error) {
    console.error('[Timeseries Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get time-series data',
      statusCode: 500,
    });
  }
});

export default router;
