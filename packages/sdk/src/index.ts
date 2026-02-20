/**
 * Performance Bottleneck Analyzer SDK
 *
 * The core SDK class wrapping the browser agent with a higher-level API.
 * For framework integrations see:
 *   - `@pbn/sdk/react`  – React hooks & context
 *   - `@pbn/sdk/next`   – Next.js helpers
 *
 * @example
 * ```ts
 * import { PerformanceAnalyzerSDK } from '@pbn/sdk';
 *
 * const sdk = new PerformanceAnalyzerSDK({
 *   collectorUrl: 'https://api.example.com/api/metrics',
 *   siteId: 'my-site',
 * });
 * sdk.init();
 * ```
 */

import { BrowserAgent } from '@pbn/browser-agent';
import type { AgentOptions } from '@pbn/browser-agent';
import type { SDKConfig, PerformanceSpan, CustomMetricOptions } from './types';
import {
  trackRouteChanges,
  stopRouteTracking,
  startSpan,
  measureSync,
  measureAsync,
  on,
  off,
  emit,
  getRating,
} from './helpers';
import type { SDKEvent, SDKEventListener, RouteChangeEvent } from './types';

class PerformanceAnalyzerSDK {
  private agent: BrowserAgent | null = null;
  private config: SDKConfig;
  private routeCleanup: (() => void) | null = null;
  private initialized = false;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  /** Get the current SDK configuration */
  public getConfig(): SDKConfig {
    return { ...this.config };
  }

  /** Get the underlying BrowserAgent instance (null if not initialized) */
  public getAgent(): BrowserAgent | null {
    return this.agent;
  }

  /** Whether the SDK has been initialized */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the SDK and start collecting metrics.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  public init(): void {
    if (this.initialized) return;

    const agentOptions: AgentOptions = {
      collectorUrl: this.config.collectorUrl,
      siteId: this.config.siteId,
      debug: this.config.debug,
      sampleRate: this.config.sampleRate,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval,
      headers: this.config.headers,
      metrics: this.config.metrics
        ? {
            lcp: this.config.metrics.lcp ?? true,
            cls: this.config.metrics.cls ?? true,
            fid: this.config.metrics.fid ?? true,
            inp: this.config.metrics.inp ?? true,
            ttfb: this.config.metrics.ttfb ?? true,
            longTasks: this.config.metrics.longTasks ?? false,
            resources: this.config.metrics.resources ?? false,
            navigation: this.config.metrics.navigation ?? false,
          }
        : undefined,
    };

    this.agent = new BrowserAgent(agentOptions);
    this.agent.start();
    this.initialized = true;

    // SPA route change tracking
    if (this.config.trackRouteChanges) {
      this.routeCleanup = trackRouteChanges((_event: RouteChangeEvent) => {
        // Events are emitted via the helpers event system
      });
    }

    emit('init', this.config);
  }

  /** Stop the SDK and clean up all resources */
  public stop(): void {
    if (!this.initialized) return;

    this.agent?.stop();
    this.agent = null;
    this.initialized = false;
    this.routeCleanup?.();
    this.routeCleanup = null;
    stopRouteTracking();
    emit('stop', undefined);
  }

  /** Report a custom metric */
  public reportMetric(
    name: string,
    value: number,
    options?: CustomMetricOptions | Record<string, string>
  ): void {
    if (!this.agent) return;

    // Support both simple tags object and CustomMetricOptions
    const tags =
      options && 'tags' in options
        ? (options as CustomMetricOptions).tags
        : (options as Record<string, string> | undefined);

    this.agent.reportMetric(name, value, tags);
    emit('metric', { name, value, timestamp: Date.now(), rating: getRating(name, value) });
  }

  /** Flush pending metrics to the server immediately */
  public async flush(): Promise<void> {
    await this.agent?.flush();
    emit('flush', undefined);
  }

  /**
   * Start a performance span for timing operations.
   *
   * @example
   * ```ts
   * const span = sdk.startSpan('api-call');
   * await fetch('/api/data');
   * const duration = span.end(); // reports automatically
   * ```
   */
  public startSpan(name: string): PerformanceSpan {
    return startSpan(name, (metricName, metricValue) => {
      this.agent?.reportMetric(metricName, metricValue);
    });
  }

  /**
   * Measure synchronous function execution time.
   *
   * @example
   * ```ts
   * const result = sdk.measure('parse-data', () => JSON.parse(jsonString));
   * ```
   */
  public measure<T>(name: string, fn: () => T): T {
    return measureSync(name, fn, (metricName, metricValue) => {
      this.agent?.reportMetric(metricName, metricValue);
    });
  }

  /**
   * Measure async function execution time.
   *
   * @example
   * ```ts
   * const data = await sdk.measureAsync('fetch-users', () => fetch('/api/users'));
   * ```
   */
  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return measureAsync(name, fn, (metricName, metricValue) => {
      this.agent?.reportMetric(metricName, metricValue);
    });
  }

  /** Subscribe to SDK events */
  public on(event: SDKEvent, listener: SDKEventListener): () => void {
    return on(event, listener);
  }

  /** Remove event listeners */
  public off(event?: SDKEvent): void {
    off(event);
  }
}

// Export the class and all types
export { PerformanceAnalyzerSDK };
export type {
  SDKConfig,
  SDKEvent,
  SDKEventListener,
  PerformanceSpan,
  CustomMetricOptions,
  RouteChangeEvent,
} from './types';
export type { WebVitalsData, MetricState, MetricToggle, Rating } from './types';

// Re-export helpers for direct use
export {
  trackRouteChanges,
  stopRouteTracking,
  startSpan,
  measureSync,
  measureAsync,
  on,
  off,
  emit,
  getRating,
  debounce,
  throttle,
  WEB_VITALS_THRESHOLDS,
} from './helpers';
