/**
 * Performance Bottleneck Analyzer SDK - Framework-Agnostic Helpers
 *
 * SPA route change detection, custom metric helpers,
 * performance spans, and utility functions.
 */

import type { RouteChangeEvent, SDKEvent, SDKEventListener, PerformanceSpan } from './types';

// ---------------------------------------------------------------------------
// Event Emitter
// ---------------------------------------------------------------------------

type ListenerMap = Map<SDKEvent, Set<SDKEventListener>>;

const listeners: ListenerMap = new Map();

/** Subscribe to an SDK event */
export function on(event: SDKEvent, listener: SDKEventListener): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(listener);

  // Return unsubscribe function
  return () => {
    listeners.get(event)?.delete(listener);
  };
}

/** Emit an SDK event */
export function emit(event: SDKEvent, data?: unknown): void {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(data);
    } catch {
      // Swallow listener errors to prevent SDK crashes
    }
  });
}

/** Remove all listeners for an event (or all events) */
export function off(event?: SDKEvent): void {
  if (event) {
    listeners.delete(event);
  } else {
    listeners.clear();
  }
}

// ---------------------------------------------------------------------------
// SPA Route Change Detection
// ---------------------------------------------------------------------------

let routeChangeCleanup: (() => void) | null = null;
let lastPath = '';

/**
 * Start tracking route changes in a Single Page Application.
 * Detects both pushState/replaceState and popstate (back/forward).
 * Calls `onRouteChange` with route change details.
 */
export function trackRouteChanges(onRouteChange: (event: RouteChangeEvent) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  lastPath = window.location.pathname;

  const handleRouteChange = (): void => {
    const newPath = window.location.pathname;
    if (newPath !== lastPath) {
      const event: RouteChangeEvent = {
        from: lastPath,
        to: newPath,
        timestamp: Date.now(),
      };
      lastPath = newPath;
      onRouteChange(event);
      emit('route-change', event);
    }
  };

  // Monkey-patch pushState and replaceState
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPushState(...args);
    handleRouteChange();
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState(...args);
    handleRouteChange();
  };

  // Listen for popstate (browser back/forward)
  window.addEventListener('popstate', handleRouteChange);

  const cleanup = (): void => {
    history.pushState = origPushState;
    history.replaceState = origReplaceState;
    window.removeEventListener('popstate', handleRouteChange);
    routeChangeCleanup = null;
  };

  routeChangeCleanup = cleanup;
  return cleanup;
}

/** Stop tracking route changes if active */
export function stopRouteTracking(): void {
  routeChangeCleanup?.();
}

// ---------------------------------------------------------------------------
// Performance Spans (custom timing measurements)
// ---------------------------------------------------------------------------

/**
 * Start a performance span for measuring custom operations.
 * Call `span.end()` when the operation completes to get duration.
 *
 * @example
 * ```ts
 * const span = startSpan('api-call');
 * await fetch('/api/data');
 * const duration = span.end(); // duration in ms
 * // Automatically reported as a custom metric
 * ```
 */
export function startSpan(
  name: string,
  reportFn?: (name: string, value: number) => void
): PerformanceSpan {
  const startTime = performance.now();

  return {
    name,
    startTime,
    end(): number {
      const duration = performance.now() - startTime;
      if (reportFn) {
        reportFn(`span.${name}`, duration);
      }
      emit('metric', { name: `span.${name}`, value: duration, timestamp: Date.now() });
      return duration;
    },
  };
}

// ---------------------------------------------------------------------------
// Component Performance Tracking
// ---------------------------------------------------------------------------

/**
 * Measure the time it takes for a function to execute.
 * Useful for tracking render times, data processing, etc.
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  reportFn?: (name: string, value: number) => void
): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (reportFn) {
    reportFn(`measure.${name}`, duration);
  }
  emit('metric', { name: `measure.${name}`, value: duration, timestamp: Date.now() });

  return result;
}

/**
 * Measure the time it takes for an async function to resolve.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  reportFn?: (name: string, value: number) => void
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (reportFn) {
    reportFn(`measure.${name}`, duration);
  }
  emit('metric', { name: `measure.${name}`, value: duration, timestamp: Date.now() });

  return result;
}

// ---------------------------------------------------------------------------
// Threshold Utilities
// ---------------------------------------------------------------------------

/** Core Web Vitals thresholds (good / needs-improvement boundaries) */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
} as const;

/**
 * Get a human-readable rating for a metric value.
 */
export function getRating(
  metricName: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const key = metricName.toUpperCase() as keyof typeof WEB_VITALS_THRESHOLDS;
  const thresholds = WEB_VITALS_THRESHOLDS[key];

  if (!thresholds) return 'good';

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

// ---------------------------------------------------------------------------
// Debounce / Throttle Utilities
// ---------------------------------------------------------------------------

/**
 * Create a debounced version of a function.
 * Useful for batching metric reports from high-frequency events.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a throttled version of a function.
 * Ensures the function is called at most once per `interval` ms.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    }
  };
}
