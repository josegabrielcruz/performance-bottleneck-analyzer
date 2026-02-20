/**
 * API client for the PBN dashboard
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RequestOptions {
  apiKey?: string;
  params?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.apiKey) {
    headers['x-api-key'] = options.apiKey;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message || `HTTP ${res.status}`);
  }
  return res.json();
}

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

export interface TimeSeriesPoint {
  bucket: string;
  avg_value: number;
  count: number;
}

export interface SiteInfo {
  siteId: string;
  name: string;
  createdAt: string;
}

export function fetchSummary(siteId: string, apiKey: string) {
  return request<{ success: boolean; data: MetricSummary[] }>('/api/metrics/summary', {
    apiKey,
    params: { siteId },
  });
}

export function fetchTimeSeries(
  siteId: string,
  metricName: string,
  interval: string,
  apiKey: string,
  startTime?: number,
  endTime?: number
) {
  return request<{ success: boolean; data: TimeSeriesPoint[] }>('/api/metrics/timeseries', {
    apiKey,
    params: { siteId, metricName, interval, startTime, endTime },
  });
}

export function fetchSites() {
  return request<{ success: boolean; data: SiteInfo[] }>('/api/sites');
}
