/**
 * Web Vitals thresholds from Google's Core Web Vitals program
 * https://web.dev/articles/vitals
 */

import { MetricThresholds } from './types';

/** Default thresholds for Core Web Vitals and other metrics (ms or unitless) */
export const WEB_VITALS_THRESHOLDS: Record<string, MetricThresholds> = {
  // Core Web Vitals
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },

  // Other Web Vitals
  TTFB: { good: 800, needsImprovement: 1800 },
  FCP: { good: 1800, needsImprovement: 3000 },

  // Custom/generic (ms-based)
  'long-task': { good: 50, needsImprovement: 100 },
  'resource-load': { good: 500, needsImprovement: 1500 },
};

/** Rate a metric value against thresholds */
export function rateMetric(
  name: string,
  value: number,
  customThresholds?: Record<string, MetricThresholds>
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = customThresholds?.[name] || WEB_VITALS_THRESHOLDS[name];
  if (!thresholds) {
    // Default: treat as ms-based metric with generous thresholds
    return value <= 1000 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
  }

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/** Get severity label for a metric based on how far past threshold */
export function getSeverity(
  name: string,
  value: number,
  customThresholds?: Record<string, MetricThresholds>
): 'critical' | 'warning' | 'info' {
  const thresholds = customThresholds?.[name] || WEB_VITALS_THRESHOLDS[name];
  if (!thresholds) return 'info';

  const ratio = value / thresholds.needsImprovement;
  if (ratio > 1.5) return 'critical';
  if (ratio > 1.0) return 'warning';
  return 'info';
}
