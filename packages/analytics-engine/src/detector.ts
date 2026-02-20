/**
 * Regression and anomaly detector
 * Uses z-score based anomaly detection and sliding window comparison
 */

import { MetricDataPoint, RegressionAlert, AnomalyResult, AnalyticsConfig } from './types';
import { mean, stdDev, zScore as calcZScore, ewma, linearTrend } from './statistics';
import { getSeverity } from './thresholds';

const DEFAULT_CONFIG: AnalyticsConfig = {
  windowSize: 30,
  zScoreThreshold: 2.5,
  minSamples: 10,
  regressionPercentThreshold: 0.2,
};

export class RegressionDetector {
  private config: AnalyticsConfig;
  /** Metric data keyed by "metricName|url" */
  private series: Map<string, MetricDataPoint[]> = new Map();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get the unique key for a metric series */
  private key(name: string, url?: string): string {
    return url ? `${name}|${url}` : name;
  }

  /** Add a single data point */
  addDataPoint(point: MetricDataPoint): void {
    const k = this.key(point.name, point.url);
    if (!this.series.has(k)) {
      this.series.set(k, []);
    }
    this.series.get(k)!.push(point);

    // Keep series bounded to prevent unbounded memory growth
    const maxSize = this.config.windowSize * 10;
    const arr = this.series.get(k)!;
    if (arr.length > maxSize) {
      this.series.set(k, arr.slice(-maxSize));
    }
  }

  /** Add multiple data points */
  addDataPoints(points: MetricDataPoint[]): void {
    for (const point of points) {
      this.addDataPoint(point);
    }
  }

  /**
   * Check the latest data point for anomalies (z-score based)
   * Returns anomaly detection result for each metric series
   */
  detectAnomalies(): AnomalyResult[] {
    const results: AnomalyResult[] = [];

    this.series.forEach((points, seriesKey) => {
      if (points.length < this.config.minSamples) return;

      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
      const values = sorted.map((p) => p.value);
      const latest = sorted[sorted.length - 1];

      // Use the window (excluding latest) to establish baseline
      const baselineValues = values.slice(-this.config.windowSize - 1, -1);
      if (baselineValues.length < this.config.minSamples) return;

      const baselineMean = mean(baselineValues);
      const baselineStdDev = stdDev(baselineValues);
      const z = calcZScore(latest.value, baselineMean, baselineStdDev);

      results.push({
        metric: seriesKey,
        value: latest.value,
        timestamp: latest.timestamp,
        zScore: z,
        isAnomaly: Math.abs(z) > this.config.zScoreThreshold,
        direction:
          z > this.config.zScoreThreshold
            ? 'up'
            : z < -this.config.zScoreThreshold
              ? 'down'
              : 'none',
      });
    });

    return results;
  }

  /**
   * Detect regressions by comparing recent window to previous window
   * Uses both percentage change and z-score for confidence
   */
  detectRegressions(): RegressionAlert[] {
    const alerts: RegressionAlert[] = [];

    this.series.forEach((points, seriesKey) => {
      if (points.length < this.config.minSamples * 2) return;

      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
      const values = sorted.map((p) => p.value);

      const windowSize = Math.min(this.config.windowSize, Math.floor(values.length / 2));

      // Split into previous and current windows
      const currentWindow = values.slice(-windowSize);
      const previousWindow = values.slice(-windowSize * 2, -windowSize);

      if (previousWindow.length < this.config.minSamples) return;

      const prevMean = mean(previousWindow);
      const currMean = mean(currentWindow);

      if (prevMean === 0) return;

      const absoluteChange = currMean - prevMean;
      const percentageChange = absoluteChange / prevMean;

      // Only alert on degradation (increasing values = worse performance)
      if (percentageChange < this.config.regressionPercentThreshold) return;

      // Calculate z-score of current mean against previous distribution
      const prevStdDev = stdDev(previousWindow);
      const z = calcZScore(currMean, prevMean, prevStdDev);

      // Need both percentage threshold AND statistical significance
      if (Math.abs(z) < 1.5) return;

      const metricName = seriesKey.split('|')[0];
      const url = seriesKey.includes('|') ? seriesKey.split('|')[1] : undefined;

      const severity =
        percentageChange > 0.5
          ? ('critical' as const)
          : percentageChange > 0.3
            ? ('warning' as const)
            : getSeverity(metricName, currMean);

      alerts.push({
        metric: metricName,
        url,
        previousValue: prevMean,
        currentValue: currMean,
        absoluteChange,
        percentageChange,
        zScore: z,
        severity,
        detectedAt: Date.now(),
        windowSize,
        message: `${metricName} degraded by ${(percentageChange * 100).toFixed(1)}% (${prevMean.toFixed(1)} → ${currMean.toFixed(1)})${url ? ` on ${url}` : ''}`,
      });
    });

    return alerts;
  }

  /**
   * Get trend analysis for a metric
   */
  analyzeTrend(
    metricName: string,
    url?: string
  ): {
    direction: 'improving' | 'degrading' | 'stable';
    slope: number;
    ewmaValues: number[];
    recentMean: number;
    baselineMean: number;
  } | null {
    const k = this.key(metricName, url);
    const points = this.series.get(k);
    if (!points || points.length < this.config.minSamples) return null;

    const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
    const values = sorted.map((p) => p.value);

    const trend = linearTrend(values);
    const ewmaValues = ewma(values, 0.3);
    const windowSize = Math.min(this.config.windowSize, Math.floor(values.length / 2));

    return {
      direction: trend.direction,
      slope: trend.slope,
      ewmaValues,
      recentMean: mean(values.slice(-windowSize)),
      baselineMean: mean(values.slice(0, windowSize)),
    };
  }

  /** Clear data for a specific metric series or all data */
  clear(metricName?: string, url?: string): void {
    if (metricName) {
      this.series.delete(this.key(metricName, url));
    } else {
      this.series.clear();
    }
  }

  /** Get number of series being tracked */
  getSeriesCount(): number {
    return this.series.size;
  }

  /** Get number of data points for a series */
  getDataPointCount(metricName: string, url?: string): number {
    return this.series.get(this.key(metricName, url))?.length || 0;
  }
}
