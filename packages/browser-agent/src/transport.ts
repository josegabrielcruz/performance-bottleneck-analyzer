/**
 * Transport layer for sending metrics to the collector API
 * Handles batching, retries, offline queuing, and sendBeacon fallback
 */

import { MetricData, MetricPayload, AgentConfig } from './types';
import { getPageContext, getSessionId, createLogger } from './utils';

type Logger = ReturnType<typeof createLogger>;

const OFFLINE_QUEUE_KEY = '__pbn_offline_queue';

export class Transport {
  private queue: MetricData[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private config: AgentConfig;
  private logger: Logger;
  private sessionId: string;

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.sessionId = getSessionId();

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flush();
    }, config.flushInterval);

    // Flush on page unload using sendBeacon
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushWithBeacon();
        }
      });

      window.addEventListener('pagehide', () => {
        this.flushWithBeacon();
      });
    }

    // Try to send any previously queued offline metrics
    if (config.enableOfflineQueue) {
      this.drainOfflineQueue();
    }
  }

  /** Add a metric to the send queue */
  public enqueue(metric: MetricData): void {
    this.queue.push(metric);
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /** Flush all queued metrics via fetch */
  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const metrics = [...this.queue];
    this.queue = [];

    const payload = this.buildPayload(metrics);
    await this.send(payload);
  }

  /** Flush using sendBeacon (for page unload) */
  private flushWithBeacon(): void {
    if (this.queue.length === 0) return;

    const metrics = [...this.queue];
    this.queue = [];

    const payload = this.buildPayload(metrics);
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json',
    });

    try {
      const sent = navigator.sendBeacon(this.config.collectorUrl, blob);
      if (sent) {
        this.logger.log('Sent', metrics.length, 'metrics via sendBeacon');
      } else {
        this.logger.warn('sendBeacon failed, queuing offline');
        this.saveToOfflineQueue(metrics);
      }
    } catch {
      this.saveToOfflineQueue(metrics);
    }
  }

  /** Build the full payload with page context */
  private buildPayload(metrics: MetricData[]): MetricPayload {
    return {
      siteId: this.config.siteId,
      url: window.location.href,
      referrer: document.referrer,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      context: getPageContext(),
      metrics,
    };
  }

  /** Send payload via fetch with retries */
  private async send(payload: MetricPayload): Promise<void> {
    try {
      const response = await fetch(this.config.collectorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      if (response.ok) {
        this.logger.log('Sent', payload.metrics.length, 'metrics successfully');
        this.retryCount = 0;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.retryCount++;
      this.logger.warn(
        `Failed to send metrics (attempt ${this.retryCount}/${this.config.maxRetries}):`,
        error
      );

      if (this.retryCount < this.config.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
        setTimeout(() => {
          this.send(payload);
        }, delay);
      } else {
        this.logger.error('Max retries reached, saving to offline queue');
        this.retryCount = 0;
        if (this.config.enableOfflineQueue) {
          this.saveToOfflineQueue(payload.metrics);
        }
      }
    }
  }

  /** Save metrics to localStorage for later retry */
  private saveToOfflineQueue(metrics: MetricData[]): void {
    try {
      const existing = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: MetricData[] = existing ? JSON.parse(existing) : [];
      queue.push(...metrics);
      // Cap offline queue at 1000 entries to avoid storage issues
      const capped = queue.slice(-1000);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(capped));
      this.logger.log('Saved', metrics.length, 'metrics to offline queue');
    } catch {
      this.logger.warn('Failed to save to offline queue');
    }
  }

  /** Try to send any metrics saved in the offline queue */
  private async drainOfflineQueue(): Promise<void> {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!stored) return;

      const metrics: MetricData[] = JSON.parse(stored);
      if (metrics.length === 0) return;

      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      this.logger.log('Draining', metrics.length, 'metrics from offline queue');

      const payload = this.buildPayload(metrics);
      await this.send(payload);
    } catch {
      this.logger.warn('Failed to drain offline queue');
    }
  }

  /** Stop the transport (clean up timers) */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
