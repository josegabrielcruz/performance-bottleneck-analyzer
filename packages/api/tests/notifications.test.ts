import { describe, it, expect, vi } from 'vitest';
import {
  sendSlackNotification,
  sendWebhookNotification,
  NotificationManager,
} from '../src/notifications';
import type { NotificationPayload } from '../src/notifications';

// Mock http/https modules with default export pattern
vi.mock('https', () => ({
  default: {
    request: vi.fn((_options: unknown, callback: (res: unknown) => void) => {
      const mockRes = {
        statusCode: 200,
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === 'data') handler(Buffer.from(JSON.stringify({ ok: true })));
          if (event === 'end') handler();
        }),
      };
      callback(mockRes);
      return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
    }),
  },
}));

vi.mock('http', () => ({
  default: {
    request: vi.fn((_options: unknown, callback: (res: unknown) => void) => {
      const mockRes = {
        statusCode: 200,
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === 'data') handler(Buffer.from(JSON.stringify({ ok: true })));
          if (event === 'end') handler();
        }),
      };
      callback(mockRes);
      return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
    }),
  },
}));

const testPayload: NotificationPayload = {
  type: 'regression',
  siteId: 'test-site',
  alerts: [
    {
      metric: 'LCP',
      previousValue: 1000,
      currentValue: 2000,
      absoluteChange: 1000,
      percentageChange: 1.0,
      zScore: 3.5,
      severity: 'critical',
      detectedAt: Date.now(),
      windowSize: 30,
      message: 'LCP degraded by 100%',
    },
  ],
  timestamp: Date.now(),
  summary: 'LCP degraded by 100%',
};

describe('notifications', () => {
  describe('sendSlackNotification', () => {
    it('sends notification for valid payload', async () => {
      const result = await sendSlackNotification('https://hooks.slack.com/test', testPayload);
      expect(result).toBe(true);
    });
  });

  describe('sendWebhookNotification', () => {
    it('sends webhook without secret', async () => {
      const result = await sendWebhookNotification('https://example.com/webhook', testPayload);
      expect(result).toBe(true);
    });

    it('sends webhook with secret', async () => {
      const result = await sendWebhookNotification(
        'https://example.com/webhook',
        testPayload,
        'secret123'
      );
      expect(result).toBe(true);
    });
  });

  describe('NotificationManager', () => {
    it('creates an instance with config', () => {
      const manager = new NotificationManager({});
      expect(manager).toBeDefined();
    });

    it('returns empty results with no channels configured', async () => {
      const manager = new NotificationManager({});
      const results = await manager.notify(testPayload);
      expect(results).toEqual([]);
    });

    it('sends to slack channel when configured', async () => {
      const manager = new NotificationManager({
        slack: { webhookUrl: 'https://hooks.slack.com/test' },
      });
      const results = await manager.notify(testPayload);
      expect(results.length).toBe(1);
      expect(results[0].channel).toBe('slack');
    });
  });
});
