import { describe, it, expect, beforeEach } from 'vitest';
import { RegressionDetector } from '../src/detector';
import type { MetricDataPoint } from '../src/types';

function createPoints(
  name: string,
  values: number[],
  startTime: number = Date.now() - values.length * 1000
): MetricDataPoint[] {
  return values.map((value, i) => ({
    name,
    value,
    timestamp: startTime + i * 1000,
  }));
}

describe('RegressionDetector', () => {
  let detector: RegressionDetector;

  beforeEach(() => {
    detector = new RegressionDetector({
      windowSize: 10,
      minSamples: 5,
      zScoreThreshold: 2.0,
      regressionPercentThreshold: 0.2,
    });
  });

  describe('addDataPoint / getDataPointCount', () => {
    it('tracks data points per series', () => {
      detector.addDataPoint({ name: 'LCP', value: 2000, timestamp: Date.now() });
      detector.addDataPoint({ name: 'LCP', value: 2100, timestamp: Date.now() + 1 });
      expect(detector.getDataPointCount('LCP')).toBe(2);
    });

    it('separates series by URL', () => {
      detector.addDataPoint({ name: 'LCP', value: 2000, timestamp: 1, url: '/a' });
      detector.addDataPoint({ name: 'LCP', value: 2100, timestamp: 2, url: '/b' });
      expect(detector.getDataPointCount('LCP', '/a')).toBe(1);
      expect(detector.getDataPointCount('LCP', '/b')).toBe(1);
      expect(detector.getSeriesCount()).toBe(2);
    });

    it('bounds series length', () => {
      const points = createPoints('LCP', Array(200).fill(1000));
      detector.addDataPoints(points);
      // windowSize=10, max = 10*10 = 100
      expect(detector.getDataPointCount('LCP')).toBe(100);
    });
  });

  describe('detectAnomalies', () => {
    it('returns empty when insufficient data', () => {
      detector.addDataPoints(createPoints('LCP', [1000, 1100]));
      expect(detector.detectAnomalies()).toEqual([]);
    });

    it('detects an anomaly for outlier value', () => {
      // 19 stable values with slight variance, then a spike at 5000
      const stable = Array.from({ length: 19 }, (_, i) => 1000 + ((i % 3) - 1) * 10);
      const points = createPoints('LCP', [...stable, 5000]);
      detector.addDataPoints(points);

      const anomalies = detector.detectAnomalies();
      expect(anomalies.length).toBe(1);
      expect(anomalies[0].isAnomaly).toBe(true);
      expect(anomalies[0].direction).toBe('up');
    });

    it('does not flag normal values as anomalies', () => {
      const values = Array(20)
        .fill(0)
        .map(() => 1000 + Math.random() * 100);
      detector.addDataPoints(createPoints('LCP', values));

      const anomalies = detector.detectAnomalies();
      const flagged = anomalies.filter((a) => a.isAnomaly);
      expect(flagged.length).toBe(0);
    });
  });

  describe('detectRegressions', () => {
    it('returns empty when insufficient data', () => {
      detector.addDataPoints(createPoints('LCP', [1000, 1100, 1200]));
      expect(detector.detectRegressions()).toEqual([]);
    });

    it('detects regression when values increase significantly', () => {
      // Baseline around 1000 with slight variance, then jump to around 1500
      const baseline = [980, 1020, 990, 1010, 1000, 995, 1005, 985, 1015, 1000];
      const regression = [1480, 1520, 1490, 1510, 1500, 1495, 1505, 1485, 1515, 1500];
      detector.addDataPoints(createPoints('LCP', [...baseline, ...regression]));

      const alerts = detector.detectRegressions();
      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('LCP');
      expect(alerts[0].percentageChange).toBeCloseTo(0.5, 1);
      expect(alerts[0].message).toContain('degraded');
    });

    it('does not alert on stable performance', () => {
      const values = Array(20).fill(1000);
      detector.addDataPoints(createPoints('LCP', values));

      const alerts = detector.detectRegressions();
      expect(alerts.length).toBe(0);
    });

    it('does not alert on small improvements', () => {
      // Values decreasing slightly (improving)
      const baseline = Array(10).fill(1000);
      const improved = Array(10).fill(900);
      detector.addDataPoints(createPoints('LCP', [...baseline, ...improved]));

      const alerts = detector.detectRegressions();
      expect(alerts.length).toBe(0);
    });

    it('classifies severity based on percentage change', () => {
      // 100% increase → critical, with variance to pass z-score check
      const baseline = [980, 1020, 990, 1010, 1000, 995, 1005, 985, 1015, 1000];
      const critical = [1980, 2020, 1990, 2010, 2000, 1995, 2005, 1985, 2015, 2000];
      detector.addDataPoints(createPoints('LCP', [...baseline, ...critical]));

      const alerts = detector.detectRegressions();
      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('critical');
    });
  });

  describe('analyzeTrend', () => {
    it('returns null for insufficient data', () => {
      detector.addDataPoints(createPoints('LCP', [1000, 1100]));
      expect(detector.analyzeTrend('LCP')).toBeNull();
    });

    it('detects degrading trend', () => {
      const values = Array.from({ length: 20 }, (_, i) => 1000 + i * 100);
      detector.addDataPoints(createPoints('LCP', values));

      const trend = detector.analyzeTrend('LCP');
      expect(trend).not.toBeNull();
      expect(trend!.direction).toBe('degrading');
      expect(trend!.slope).toBeGreaterThan(0);
    });

    it('detects improving trend', () => {
      const values = Array.from({ length: 20 }, (_, i) => 3000 - i * 100);
      detector.addDataPoints(createPoints('LCP', values));

      const trend = detector.analyzeTrend('LCP');
      expect(trend).not.toBeNull();
      expect(trend!.direction).toBe('improving');
      expect(trend!.slope).toBeLessThan(0);
    });

    it('provides EWMA values', () => {
      const values = Array(20).fill(1000);
      detector.addDataPoints(createPoints('LCP', values));

      const trend = detector.analyzeTrend('LCP');
      expect(trend!.ewmaValues.length).toBe(20);
    });
  });

  describe('clear', () => {
    it('clears a specific series', () => {
      detector.addDataPoints(createPoints('LCP', [1000, 1100]));
      detector.addDataPoints(createPoints('CLS', [0.1, 0.2]));

      detector.clear('LCP');
      expect(detector.getDataPointCount('LCP')).toBe(0);
      expect(detector.getDataPointCount('CLS')).toBe(2);
    });

    it('clears all series', () => {
      detector.addDataPoints(createPoints('LCP', [1000]));
      detector.addDataPoints(createPoints('CLS', [0.1]));

      detector.clear();
      expect(detector.getSeriesCount()).toBe(0);
    });
  });
});
