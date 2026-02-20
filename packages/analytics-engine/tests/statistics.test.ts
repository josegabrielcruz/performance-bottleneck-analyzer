import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  variance,
  stdDev,
  percentile,
  zScore,
  movingAverage,
  ewma,
  linearTrend,
} from '../src/statistics';

describe('statistics', () => {
  // -----------------------------------------------------------------------
  // mean
  // -----------------------------------------------------------------------
  describe('mean', () => {
    it('returns 0 for empty array', () => {
      expect(mean([])).toBe(0);
    });

    it('computes the arithmetic mean', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('handles single value', () => {
      expect(mean([42])).toBe(42);
    });

    it('handles negative numbers', () => {
      expect(mean([-2, 2])).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // median
  // -----------------------------------------------------------------------
  describe('median', () => {
    it('returns 0 for empty array', () => {
      expect(median([])).toBe(0);
    });

    it('returns middle value for odd-length array', () => {
      expect(median([3, 1, 2])).toBe(2);
    });

    it('returns average of two middle values for even-length array', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it('handles single value', () => {
      expect(median([7])).toBe(7);
    });
  });

  // -----------------------------------------------------------------------
  // variance & stdDev
  // -----------------------------------------------------------------------
  describe('variance', () => {
    it('returns 0 for less than 2 values', () => {
      expect(variance([])).toBe(0);
      expect(variance([5])).toBe(0);
    });

    it('computes sample variance', () => {
      // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, sample variance (n-1) = 32/7 ≈ 4.571
      const result = variance([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(4.5714, 3);
    });
  });

  describe('stdDev', () => {
    it('returns 0 for single value', () => {
      expect(stdDev([5])).toBe(0);
    });

    it('computes standard deviation', () => {
      // sqrt(4.5714) ≈ 2.138
      expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    });
  });

  // -----------------------------------------------------------------------
  // percentile
  // -----------------------------------------------------------------------
  describe('percentile', () => {
    it('returns 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });

    it('returns min for p0', () => {
      expect(percentile([10, 20, 30], 0)).toBe(10);
    });

    it('returns max for p100', () => {
      expect(percentile([10, 20, 30], 100)).toBe(30);
    });

    it('interpolates for p75', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(data, 75)).toBeCloseTo(7.75, 5);
    });
  });

  // -----------------------------------------------------------------------
  // zScore
  // -----------------------------------------------------------------------
  describe('zScore', () => {
    it('returns 0 when stdDev is 0', () => {
      expect(zScore(5, 5, 0)).toBe(0);
    });

    it('computes correct z-score', () => {
      // value=7, mean=5, stdDev=2 → z = 1
      expect(zScore(7, 5, 2)).toBe(1);
    });

    it('returns negative z-score for below-mean values', () => {
      expect(zScore(3, 5, 2)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // movingAverage
  // -----------------------------------------------------------------------
  describe('movingAverage', () => {
    it('returns overall mean if fewer values than window', () => {
      expect(movingAverage([1, 2, 3], 5)).toEqual([mean([1, 2, 3])]);
    });

    it('computes SMA correctly', () => {
      const result = movingAverage([1, 2, 3, 4, 5], 3);
      // windows: [1,2,3]=2, [2,3,4]=3, [3,4,5]=4
      expect(result).toEqual([2, 3, 4]);
    });
  });

  // -----------------------------------------------------------------------
  // ewma
  // -----------------------------------------------------------------------
  describe('ewma', () => {
    it('returns empty for empty input', () => {
      expect(ewma([])).toEqual([]);
    });

    it('first value equals input', () => {
      const result = ewma([10, 20, 30], 0.5);
      expect(result[0]).toBe(10);
    });

    it('converges toward recent values', () => {
      const result = ewma([10, 10, 10, 100, 100, 100], 0.5);
      // Last value should be closer to 100 than to 10
      expect(result[result.length - 1]).toBeGreaterThan(50);
    });
  });

  // -----------------------------------------------------------------------
  // linearTrend
  // -----------------------------------------------------------------------
  describe('linearTrend', () => {
    it('returns stable for less than 2 values', () => {
      expect(linearTrend([5]).direction).toBe('stable');
    });

    it('detects degrading trend (increasing values)', () => {
      const result = linearTrend([100, 200, 300, 400, 500]);
      expect(result.direction).toBe('degrading');
      expect(result.slope).toBeGreaterThan(0);
    });

    it('detects improving trend (decreasing values)', () => {
      const result = linearTrend([500, 400, 300, 200, 100]);
      expect(result.direction).toBe('improving');
      expect(result.slope).toBeLessThan(0);
    });

    it('detects stable trend for flat values', () => {
      const result = linearTrend([100, 100, 100, 100, 100]);
      expect(result.direction).toBe('stable');
    });
  });
});
