/**
 * Performance Bottleneck Analyzer — Analytics Engine
 * Core analysis, regression detection, and statistical utilities
 */

export { RegressionDetector } from './detector';
export {
  mean,
  median,
  variance,
  stdDev,
  percentile,
  zScore,
  movingAverage,
  ewma,
  linearTrend,
} from './statistics';
export { WEB_VITALS_THRESHOLDS, rateMetric, getSeverity } from './thresholds';
export type {
  MetricDataPoint,
  RegressionAlert,
  AnomalyResult,
  MetricStats,
  MetricThresholds,
  AnalyticsConfig,
} from './types';

// ─── Convenience: compute stats from a set of values ─────────────────────────

import {
  mean as _mean,
  median as _median,
  variance as _var,
  stdDev as _sd,
  percentile as _pct,
} from './statistics';
import type { MetricStats, MetricDataPoint } from './types';

/** Compute full statistical summary from a set of metric data points */
export function computeStats(metricName: string, points: MetricDataPoint[]): MetricStats {
  const values = points.map((p) => p.value);

  const good = points.filter((p) => p.rating === 'good').length;
  const ni = points.filter((p) => p.rating === 'needs-improvement').length;
  const poor = points.filter((p) => p.rating === 'poor').length;

  return {
    metric: metricName,
    count: values.length,
    mean: _mean(values),
    median: _median(values),
    stdDev: _sd(values),
    variance: _var(values),
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
    p50: _pct(values, 50),
    p75: _pct(values, 75),
    p90: _pct(values, 90),
    p95: _pct(values, 95),
    p99: _pct(values, 99),
    goodCount: good,
    needsImprovementCount: ni,
    poorCount: poor,
    goodPercent: values.length > 0 ? (good / values.length) * 100 : 0,
  };
}
