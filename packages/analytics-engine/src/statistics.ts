/**
 * Statistical utility functions
 */

/** Calculate the arithmetic mean */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Calculate the median */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Calculate variance */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
}

/** Calculate standard deviation */
export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Calculate a specific percentile (0-100) */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/** Calculate z-score for a value given population mean and stdDev */
export function zScore(value: number, populationMean: number, populationStdDev: number): number {
  if (populationStdDev === 0) return 0;
  return (value - populationMean) / populationStdDev;
}

/**
 * Simple Moving Average (SMA) over a window
 * Returns array of averages, one per window position
 */
export function movingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) return [mean(values)];
  const result: number[] = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    result.push(mean(window));
  }
  return result;
}

/**
 * Exponentially Weighted Moving Average (EWMA)
 * Alpha controls decay: higher = more weight on recent values
 */
export function ewma(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/** Calculate trend direction and slope via simple linear regression */
export function linearTrend(values: number[]): {
  slope: number;
  direction: 'improving' | 'degrading' | 'stable';
} {
  if (values.length < 2) return { slope: 0, direction: 'stable' };

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;

  // Normalize slope relative to mean to determine significance
  const normalizedSlope = yMean === 0 ? 0 : slope / yMean;

  let direction: 'improving' | 'degrading' | 'stable';
  if (Math.abs(normalizedSlope) < 0.005) {
    direction = 'stable';
  } else {
    // For performance metrics, increasing value = degrading
    direction = normalizedSlope > 0 ? 'degrading' : 'improving';
  }

  return { slope, direction };
}
