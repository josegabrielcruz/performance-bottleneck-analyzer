/**
 * Webhook management routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, managementRateLimiter } from '../middleware';
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  getWebhookById,
  getSiteById,
} from '../database';

const router = Router();

/**
 * POST /api/webhooks
 * Register a new webhook for a site
 * Auth: API key required
 */
router.post('/', managementRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const { siteId, url, eventTypes } = req.body;

    if (!siteId || typeof siteId !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'siteId is required',
        statusCode: 400,
      });
      return;
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'url is required',
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

    const validEventTypes = ['regression', 'threshold', 'summary'];
    const resolvedEventTypes = eventTypes || ['regression'];
    for (const et of resolvedEventTypes) {
      if (!validEventTypes.includes(et)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid event type "${et}". Valid: ${validEventTypes.join(', ')}`,
          statusCode: 400,
        });
        return;
      }
    }

    const secret = `whsec_${uuidv4().replace(/-/g, '')}`;
    const webhook = createWebhook(siteId, url, resolvedEventTypes, secret);

    res.status(201).json({
      success: true,
      data: {
        id: webhook.id,
        siteId: webhook.site_id,
        url: webhook.url,
        eventTypes: JSON.parse(webhook.event_types),
        secret,
        active: Boolean(webhook.active),
        createdAt: webhook.created_at,
      },
      message: 'Save this webhook secret — it will not be shown again.',
    });
  } catch (error) {
    console.error('[Create Webhook Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create webhook',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/webhooks
 * List webhooks for a site
 * Auth: API key required
 */
router.get('/', managementRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const siteId = req.query.siteId as string;

    if (!siteId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'siteId query parameter is required',
        statusCode: 400,
      });
      return;
    }

    const webhooks = listWebhooks(siteId).map((w) => ({
      id: w.id,
      siteId: w.site_id,
      url: w.url,
      eventTypes: JSON.parse(w.event_types),
      active: Boolean(w.active),
      createdAt: w.created_at,
    }));

    res.json({ success: true, data: webhooks, count: webhooks.length });
  } catch (error) {
    console.error('[List Webhooks Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list webhooks',
      statusCode: 500,
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 * Auth: API key required
 */
router.delete('/:id', managementRateLimiter, authenticate, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid webhook ID',
        statusCode: 400,
      });
      return;
    }

    const webhook = getWebhookById(id);
    if (!webhook) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Webhook not found',
        statusCode: 404,
      });
      return;
    }

    deleteWebhook(id);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('[Delete Webhook Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete webhook',
      statusCode: 500,
    });
  }
});

export default router;
