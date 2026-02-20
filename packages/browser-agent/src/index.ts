/**
 * Performance Bottleneck Analyzer - Browser Agent
 * Lightweight snippet for collecting Core Web Vitals and performance metrics
 * from production sites.
 *
 * Usage:
 *   import { BrowserAgent } from '@pbn/browser-agent';
 *   const agent = new BrowserAgent({ collectorUrl: '...', siteId: 'my-site' });
 *   agent.start();
 */

import { AgentConfig, AgentOptions, MetricData } from './types';
import { createLogger } from './utils';
import { Transport } from './transport';
import {
  observeLCP,
  observeCLS,
  observeFID,
  observeINP,
  collectTTFB,
  observeLongTasks,
  observeResources,
  collectNavigationTiming,
} from './collectors';

const DEFAULT_CONFIG: Omit<AgentConfig, 'collectorUrl' | 'siteId'> = {
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  sampleRate: 1.0,
  debug: false,
  maxRetries: 3,
  enableOfflineQueue: true,
  headers: {},
  metrics: {
    lcp: true,
    cls: true,
    fid: true,
    inp: true,
    ttfb: true,
    longTasks: true,
    resources: true,
    navigation: true,
  },
};

class BrowserAgent {
  private config: AgentConfig;
  private transport: Transport;
  private logger: ReturnType<typeof createLogger>;
  private observers: PerformanceObserver[] = [];
  private started = false;
  private sampled: boolean;

  constructor(options: AgentOptions) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
      metrics: { ...DEFAULT_CONFIG.metrics, ...options.metrics },
    };
    this.logger = createLogger(this.config.debug);
    this.transport = new Transport(this.config, this.logger);

    // Determine if this session should be sampled
    this.sampled = Math.random() < this.config.sampleRate;

    if (!this.sampled) {
      this.logger.log('Session not sampled, agent will not collect metrics');
    }
  }

  /** Start collecting metrics */
  public start(): void {
    if (this.started || !this.sampled) return;
    this.started = true;

    this.logger.log('Starting browser agent for site:', this.config.siteId);

    // Wait for the page to be interactive before collecting
    if (document.readyState === 'complete') {
      this.initCollectors();
    } else {
      window.addEventListener('load', () => {
        this.initCollectors();
      });
    }
  }

  /** Stop collecting metrics and flush remaining data */
  public stop(): void {
    this.logger.log('Stopping browser agent');
    this.started = false;
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
    this.transport.destroy();
  }

  /** Manually report a custom metric */
  public reportMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.sampled) return;
    this.handleMetric({
      name,
      value,
      timestamp: Date.now(),
      rating: 'good',
      tags,
    });
  }

  /** Flush any queued metrics immediately */
  public async flush(): Promise<void> {
    await this.transport.flush();
  }

  private initCollectors(): void {
    const m = this.config.metrics;
    const cb = this.handleMetric.bind(this);

    // Core Web Vitals
    if (m.lcp) this.addObserver(observeLCP(cb, this.logger));
    if (m.cls) this.addObserver(observeCLS(cb, this.logger));
    if (m.fid) this.addObserver(observeFID(cb, this.logger));
    if (m.inp) this.addObserver(observeINP(cb, this.logger));

    // Navigation timings (one-shot)
    if (m.ttfb) collectTTFB(cb, this.logger);
    if (m.navigation) collectNavigationTiming(cb, this.logger);

    // Ongoing observers
    if (m.longTasks) this.addObserver(observeLongTasks(cb, this.logger));
    if (m.resources) this.addObserver(observeResources(cb, this.logger));

    this.logger.log('All collectors initialized');
  }

  private addObserver(observer: PerformanceObserver | null): void {
    if (observer) {
      this.observers.push(observer);
    }
  }

  private handleMetric(metric: MetricData): void {
    this.transport.enqueue(metric);
  }
}

// Re-export everything
export { BrowserAgent };
export type { MetricData, AgentConfig, AgentOptions, MetricPayload, PageContext } from './types';
export { getRating, getPageContext, getSessionId } from './utils';
