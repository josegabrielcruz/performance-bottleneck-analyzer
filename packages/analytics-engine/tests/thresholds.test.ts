import { describe, it, expect } from 'vitest';
import { rateMetric, getSeverity, WEB_VITALS_THRESHOLDS } from '../src/thresholds';

describe('thresholds', () => {
  describe('WEB_VITALS_THRESHOLDS', () => {
    it('defines thresholds for core web vitals', () => {
      expect(WEB_VITALS_THRESHOLDS).toHaveProperty('LCP');
      expect(WEB_VITALS_THRESHOLDS).toHaveProperty('FID');
      expect(WEB_VITALS_THRESHOLDS).toHaveProperty('CLS');
      expect(WEB_VITALS_THRESHOLDS).toHaveProperty('INP');
      expect(WEB_VITALS_THRESHOLDS).toHaveProperty('TTFB');
    });

    it('has correct LCP thresholds', () => {
      expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500);
      expect(WEB_VITALS_THRESHOLDS.LCP.needsImprovement).toBe(4000);
    });
  });

  describe('rateMetric', () => {
    it('rates LCP as good when <= 2500', () => {
      expect(rateMetric('LCP', 2000)).toBe('good');
      expect(rateMetric('LCP', 2500)).toBe('good');
    });

    it('rates LCP as needs-improvement when between 2500 and 4000', () => {
      expect(rateMetric('LCP', 3000)).toBe('needs-improvement');
    });

    it('rates LCP as poor when > 4000', () => {
      expect(rateMetric('LCP', 5000)).toBe('poor');
    });

    it('rates CLS correctly', () => {
      expect(rateMetric('CLS', 0.05)).toBe('good');
      expect(rateMetric('CLS', 0.15)).toBe('needs-improvement');
      expect(rateMetric('CLS', 0.3)).toBe('poor');
    });

    it('uses generous defaults for unknown metrics', () => {
      expect(rateMetric('custom-metric', 500)).toBe('good');
      expect(rateMetric('custom-metric', 2000)).toBe('needs-improvement');
      expect(rateMetric('custom-metric', 5000)).toBe('poor');
    });

    it('supports custom thresholds', () => {
      const custom = { 'my-metric': { good: 10, needsImprovement: 50 } };
      expect(rateMetric('my-metric', 5, custom)).toBe('good');
      expect(rateMetric('my-metric', 30, custom)).toBe('needs-improvement');
      expect(rateMetric('my-metric', 100, custom)).toBe('poor');
    });
  });

  describe('getSeverity', () => {
    it('returns info for values within threshold', () => {
      expect(getSeverity('LCP', 1000)).toBe('info');
    });

    it('returns warning for values slightly past poor threshold', () => {
      // LCP poor threshold = 4000, value 4500 → ratio = 4500/4000 = 1.125
      expect(getSeverity('LCP', 4500)).toBe('warning');
    });

    it('returns critical for values significantly past poor threshold', () => {
      // LCP poor threshold = 4000, value 8000 → ratio = 8000/4000 = 2.0
      expect(getSeverity('LCP', 8000)).toBe('critical');
    });

    it('returns info for unknown metrics', () => {
      expect(getSeverity('unknown', 999)).toBe('info');
    });
  });
});
