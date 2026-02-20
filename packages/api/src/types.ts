/**
 * API Types
 */

/** Stored metric record in the database */
export interface MetricRecord {
  id: number;
  site_id: string;
  session_id: string;
  url: string;
  referrer: string;
  metric_name: string;
  metric_value: number;
  rating: string;
  tags: string; // JSON string
  user_agent: string;
  screen_width: number;
  screen_height: number;
  device_pixel_ratio: number;
  connection_type: string;
  effective_type: string;
  device_memory: number | null;
  hardware_concurrency: number;
  pathname: string;
  viewport_width: number;
  viewport_height: number;
  created_at: string;
}

/** Incoming metric payload from browser agent */
export interface IncomingMetricPayload {
  siteId: string;
  url: string;
  referrer: string;
  sessionId: string;
  timestamp: number;
  context: {
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    connectionType: string;
    effectiveType: string;
    deviceMemory: number | null;
    hardwareConcurrency: number;
    pathname: string;
    viewportWidth: number;
    viewportHeight: number;
  };
  metrics: Array<{
    name: string;
    value: number;
    timestamp: number;
    rating: string;
    tags?: Record<string, string>;
  }>;
}

/** Site configuration stored in the database */
export interface SiteRecord {
  id: number;
  site_id: string;
  name: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

/** Webhook configuration */
export interface WebhookRecord {
  id: number;
  site_id: string;
  url: string;
  event_types: string; // JSON array of event types
  secret: string;
  active: boolean;
  created_at: string;
}

/** Query parameters for metrics endpoint */
export interface MetricsQuery {
  siteId: string;
  metricName?: string;
  startTime?: number;
  endTime?: number;
  pathname?: string;
  rating?: string;
  connectionType?: string;
  limit?: number;
  offset?: number;
}

/** Aggregated metric summary */
export interface MetricSummary {
  metric_name: string;
  count: number;
  avg_value: number;
  p50_value: number;
  p75_value: number;
  p95_value: number;
  min_value: number;
  max_value: number;
  good_count: number;
  needs_improvement_count: number;
  poor_count: number;
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
