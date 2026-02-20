import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceAnalyzerSDK } from '../src/index';
import type { SDKConfig } from '../src/types';
import { off } from '../src/helpers';

// Mock BrowserAgent since it requires DOM
vi.mock('@pbn/browser-agent', () => {
  class MockBrowserAgent {
    start = vi.fn();
    stop = vi.fn();
    reportMetric = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
  }
  return { BrowserAgent: MockBrowserAgent };
});

const testConfig: SDKConfig = {
  collectorUrl: 'https://api.example.com/metrics',
  siteId: 'test-site',
  environment: 'development',
  debug: true,
};

describe('PerformanceAnalyzerSDK', () => {
  let sdk: PerformanceAnalyzerSDK;

  beforeEach(() => {
    sdk = new PerformanceAnalyzerSDK(testConfig);
  });

  afterEach(() => {
    sdk.stop();
    off(); // clean up event listeners
  });

  describe('constructor', () => {
    it('creates an SDK instance', () => {
      expect(sdk).toBeInstanceOf(PerformanceAnalyzerSDK);
      expect(sdk.isInitialized()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('returns a copy of the config', () => {
      const config = sdk.getConfig();
      expect(config.collectorUrl).toBe(testConfig.collectorUrl);
      expect(config.siteId).toBe(testConfig.siteId);

      // Should be a copy, not the original reference
      config.siteId = 'modified';
      expect(sdk.getConfig().siteId).toBe(testConfig.siteId);
    });
  });

  describe('getAgent', () => {
    it('returns null before init', () => {
      expect(sdk.getAgent()).toBeNull();
    });

    it('returns agent after init', () => {
      sdk.init();
      expect(sdk.getAgent()).not.toBeNull();
    });
  });

  describe('init', () => {
    it('initializes the agent', () => {
      sdk.init();
      expect(sdk.isInitialized()).toBe(true);
      expect(sdk.getAgent()).not.toBeNull();
    });

    it('is idempotent', () => {
      sdk.init();
      const agent1 = sdk.getAgent();
      sdk.init();
      const agent2 = sdk.getAgent();
      // Same agent instance
      expect(agent1).toBe(agent2);
    });
  });

  describe('stop', () => {
    it('stops the agent', () => {
      sdk.init();
      sdk.stop();
      expect(sdk.isInitialized()).toBe(false);
      expect(sdk.getAgent()).toBeNull();
    });

    it('is safe to call when not initialized', () => {
      expect(() => sdk.stop()).not.toThrow();
    });
  });

  describe('reportMetric', () => {
    it('does nothing when not initialized', () => {
      // Should not throw
      expect(() => sdk.reportMetric('test', 42)).not.toThrow();
    });

    it('delegates to agent after init', () => {
      sdk.init();
      const agent = sdk.getAgent()!;
      sdk.reportMetric('test', 42, { env: 'test' });
      expect(agent.reportMetric).toHaveBeenCalledWith('test', 42, { env: 'test' });
    });
  });

  describe('flush', () => {
    it('resolves when not initialized', async () => {
      await expect(sdk.flush()).resolves.toBeUndefined();
    });

    it('delegates to agent after init', async () => {
      sdk.init();
      await sdk.flush();
      expect(sdk.getAgent()!.flush).toHaveBeenCalled();
    });
  });

  describe('startSpan', () => {
    it('returns a span object', () => {
      sdk.init();
      const span = sdk.startSpan('test-op');
      expect(span.name).toBe('test-op');
      expect(typeof span.end).toBe('function');
    });

    it('span.end() returns duration', () => {
      sdk.init();
      const span = sdk.startSpan('test-op');
      const duration = span.end();
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measure', () => {
    it('returns function result', () => {
      sdk.init();
      const result = sdk.measure('compute', () => 2 + 2);
      expect(result).toBe(4);
    });
  });

  describe('measureAsync', () => {
    it('returns async function result', async () => {
      sdk.init();
      const result = await sdk.measureAsync('async-op', async () => {
        return 'done';
      });
      expect(result).toBe('done');
    });
  });

  describe('event system', () => {
    it('subscribes to events via on()', () => {
      const received: unknown[] = [];
      const unsub = sdk.on('init', (data) => received.push(data));

      sdk.init();

      expect(received.length).toBe(1);
      unsub();
    });

    it('unsubscribes from events', () => {
      let count = 0;
      sdk.on('metric', () => count++);

      sdk.init();
      sdk.reportMetric('test', 42);
      sdk.off('metric');
      sdk.reportMetric('test', 42);

      expect(count).toBe(1);
    });
  });
});
