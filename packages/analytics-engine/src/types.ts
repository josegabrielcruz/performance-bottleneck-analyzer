/**
 * Analytics Engine — Types
 */

/** Raw metric data point */
export interface MetricDataPoint {
  name: string;
  value: number;
  timestamp: number;
  url?: string;
  pathname?: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  sessionId?: string;
}

/** A regression alert */
export interface RegressionAlert {
  metric: string;
  url?: string;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentageChange: number;
  zScore: number;
  severity: 'critical' | 'warning' | 'info';
  detectedAt: number;
  windowSize: number;
  message: string;
}

/** Anomaly detection result */
export interface AnomalyResult {
  metric: string;
  value: number;
  timestamp: number;
  zScore: number;
  isAnomaly: boolean;
  direction: 'up' | 'down' | 'none';
}

/** Statistical summary of a metric */
export interface MetricStats {
  metric: string;
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  goodPercent: number;
}

/** Web Vitals threshold configuration */
export interface MetricThresholds {
  good: number;
  needsImprovement: number;
}

/** Analytics engine configuration */
export interface AnalyticsConfig {
  /** Window size for rolling statistics (number of data points) */
  windowSize: number;
  /** Z-score threshold for anomaly detection (default: 2.5) */
  zScoreThreshold: number;
  /** Minimum data points before detection activates */
  minSamples: number;
  /** Percentage change threshold for regression alerts (default: 0.2 = 20%) */
  regressionPercentThreshold: number;
  /** Custom metric thresholds (overrides defaults) */
  customThresholds?: Record<string, MetricThresholds>;
}
