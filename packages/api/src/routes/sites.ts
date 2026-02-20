/**
 * Site management routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { managementRateLimiter } from '../middleware';
import { createSite, getSiteById, listSites, deleteSite } from '../database';

const router = Router();

/**
 * POST /api/sites
 * Create a new site
 * No auth required (creates the site and returns the API key)
 */
router.post('/', managementRateLimiter, (req: Request, res: Response) => {
  try {
    const { name, siteId } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'name is required and must be a string',
        statusCode: 400,
      });
      return;
    }

    const resolvedSiteId = siteId || name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Check if site already exists
    const existing = getSiteById(resolvedSiteId);
    if (existing) {
      res.status(409).json({
        error: 'Conflict',
        message: `Site "${resolvedSiteId}" already exists`,
        statusCode: 409,
      });
      return;
    }

    const apiKey = `pbn_${uuidv4().replace(/-/g, '')}`;
    const site = createSite(resolvedSiteId, name, apiKey);

    res.status(201).json({
      success: true,
      data: {
        siteId: site.site_id,
        name: site.name,
        apiKey: site.api_key,
        createdAt: site.created_at,
      },
      message: 'Save this API key — it will not be shown again.',
    });
  } catch (error) {
    console.error('[Create Site Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create site',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/sites
 * List all sites (without API keys)
 */
router.get('/', managementRateLimiter, (_req: Request, res: Response) => {
  try {
    const sites = listSites().map((site) => ({
      siteId: site.site_id,
      name: site.name,
      createdAt: site.created_at,
      updatedAt: site.updated_at,
    }));

    res.json({ success: true, data: sites, count: sites.length });
  } catch (error) {
    console.error('[List Sites Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list sites',
      statusCode: 500,
    });
  }
});

/**
 * GET /api/sites/:siteId
 * Get site details (without API key)
 */
router.get('/:siteId', managementRateLimiter, (req: Request, res: Response) => {
  try {
    const site = getSiteById(req.params.siteId);
    if (!site) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Site not found',
        statusCode: 404,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        siteId: site.site_id,
        name: site.name,
        createdAt: site.created_at,
        updatedAt: site.updated_at,
      },
    });
  } catch (error) {
    console.error('[Get Site Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get site',
      statusCode: 500,
    });
  }
});

/**
 * DELETE /api/sites/:siteId
 * Delete a site and all its data
 */
router.delete('/:siteId', managementRateLimiter, (req: Request, res: Response) => {
  try {
    const site = getSiteById(req.params.siteId);
    if (!site) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Site not found',
        statusCode: 404,
      });
      return;
    }

    deleteSite(req.params.siteId);
    res.json({
      success: true,
      message: `Site "${req.params.siteId}" and all associated data deleted`,
    });
  } catch (error) {
    console.error('[Delete Site Error]', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete site',
      statusCode: 500,
    });
  }
});

export default router;
