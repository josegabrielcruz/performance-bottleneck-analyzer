/**
 * Performance Bottleneck Analyzer - Browser Agent Types
 */

/** Raw metric collected from browser APIs */
export interface MetricData {
  /** Metric name (e.g., 'LCP', 'CLS', 'FID', 'INP', 'TTFB') */
  name: string;
  /** Metric value in milliseconds (or unitless for CLS) */
  value: number;
  /** Unix timestamp when metric was captured */
  timestamp: number;
  /** Rating based on Core Web Vitals thresholds */
  rating: 'good' | 'needs-improvement' | 'poor';
  /** Optional key-value tags for filtering */
  tags?: Record<string, string>;
}

/** Configuration options for the browser agent */
export interface AgentConfig {
  /** URL of the collector API endpoint */
  collectorUrl: string;
  /** Unique site identifier */
  siteId: string;
  /** Maximum metrics to batch before sending */
  batchSize: number;
  /** Interval in ms to flush queued metrics */
  flushInterval: number;
  /** Sampling rate between 0 and 1 (1 = 100% of sessions) */
  sampleRate: number;
  /** Enable debug logging to console */
  debug: boolean;
  /** Maximum number of retries for failed sends */
  maxRetries: number;
  /** Enable offline queuing via localStorage */
  enableOfflineQueue: boolean;
  /** Custom headers sent with metric payloads */
  headers: Record<string, string>;
  /** Which metrics to collect */
  metrics: {
    lcp: boolean;
    cls: boolean;
    fid: boolean;
    inp: boolean;
    ttfb: boolean;
    longTasks: boolean;
    resources: boolean;
    navigation: boolean;
  };
}

/** Payload sent to the collector API */
export interface MetricPayload {
  siteId: string;
  url: string;
  referrer: string;
  sessionId: string;
  timestamp: number;
  context: PageContext;
  metrics: MetricData[];
}

/** Contextual information about the page/device */
export interface PageContext {
  /** User agent string */
  userAgent: string;
  /** Screen dimensions */
  screenWidth: number;
  screenHeight: number;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Connection type (4g, 3g, wifi, etc.) */
  connectionType: string;
  /** Effective connection type */
  effectiveType: string;
  /** Device memory in GB (if available) */
  deviceMemory: number | null;
  /** Number of logical CPU cores */
  hardwareConcurrency: number;
  /** Current page path */
  pathname: string;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
}

/** User-provided partial config */
export type AgentOptions = Partial<Omit<AgentConfig, 'collectorUrl' | 'siteId'>> & {
  collectorUrl: string;
  siteId: string;
};
