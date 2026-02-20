/**
 * Performance Bottleneck Analyzer SDK - Types
 */

/** SDK configuration options */
export interface SDKConfig {
  /** URL of the collector API endpoint */
  collectorUrl: string;
  /** Unique site identifier */
  siteId: string;
  /** Environment tag */
  environment?: 'production' | 'staging' | 'development';
  /** Maximum metrics to batch before sending */
  batchSize?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Sampling rate between 0 and 1 */
  sampleRate?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Enable automatic route change tracking for SPAs */
  trackRouteChanges?: boolean;
  /** Custom headers for API requests */
  headers?: Record<string, string>;
  /** Which metrics to collect */
  metrics?: Partial<MetricToggle>;
}

/** Toggle individual metric collectors */
export interface MetricToggle {
  lcp: boolean;
  cls: boolean;
  fid: boolean;
  inp: boolean;
  ttfb: boolean;
  longTasks: boolean;
  resources: boolean;
  navigation: boolean;
}

/** Web Vitals data returned by hooks */
export interface WebVitalsData {
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  inp: number | null;
  ttfb: number | null;
}

/** Web Vital rating */
export type Rating = 'good' | 'needs-improvement' | 'poor';

/** Individual metric state */
export interface MetricState {
  value: number;
  rating: Rating;
  timestamp: number;
}

/** Route change event */
export interface RouteChangeEvent {
  from: string;
  to: string;
  timestamp: number;
  duration?: number;
}

/** SDK lifecycle events */
export type SDKEvent = 'metric' | 'route-change' | 'flush' | 'error' | 'init' | 'stop';

/** Event listener callback */
export type SDKEventListener = (data: unknown) => void;

/** Custom metric options */
export interface CustomMetricOptions {
  /** Optional tags for filtering */
  tags?: Record<string, string>;
  /** Rating override */
  rating?: Rating;
}

/** Performance mark for measuring custom spans */
export interface PerformanceSpan {
  name: string;
  startTime: number;
  end: () => number;
}
