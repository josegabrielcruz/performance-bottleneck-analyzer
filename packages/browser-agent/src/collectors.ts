/**
 * Core Web Vitals collectors using PerformanceObserver
 */

import { MetricData } from './types';
import { getRating, createLogger } from './utils';

type MetricCallback = (metric: MetricData) => void;
type Logger = ReturnType<typeof createLogger>;

/**
 * Observe Largest Contentful Paint (LCP)
 * Measures loading performance — how long the largest content element takes to render
 */
export function observeLCP(callback: MetricCallback, logger: Logger): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      // LCP may fire multiple times; the last entry is the final LCP
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const value = lastEntry.startTime;
        logger.log('LCP:', value, 'ms');
        callback({
          name: 'LCP',
          value,
          timestamp: Date.now(),
          rating: getRating('LCP', value),
          tags: {
            element:
              (lastEntry as PerformanceEntry & { element?: Element }).element?.tagName || 'unknown',
          },
        });
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('LCP observer not supported', e);
    return null;
  }
}

/**
 * Observe Cumulative Layout Shift (CLS)
 * Measures visual stability — how much the page layout shifts unexpectedly
 */
export function observeCLS(callback: MetricCallback, logger: Logger): PerformanceObserver | null {
  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };

        // Ignore shifts caused by user input
        if (layoutShift.hadRecentInput) continue;

        const shiftValue = layoutShift.value || 0;

        // Session window: group shifts within 1s of each other, max 5s window
        if (
          sessionEntries.length > 0 &&
          entry.startTime - sessionEntries[sessionEntries.length - 1].startTime < 1000 &&
          entry.startTime - sessionEntries[0].startTime < 5000
        ) {
          sessionValue += shiftValue;
          sessionEntries.push(entry);
        } else {
          sessionValue = shiftValue;
          sessionEntries = [entry];
        }

        if (sessionValue > clsValue) {
          clsValue = sessionValue;
          logger.log('CLS:', clsValue);
          callback({
            name: 'CLS',
            value: clsValue,
            timestamp: Date.now(),
            rating: getRating('CLS', clsValue),
          });
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('CLS observer not supported', e);
    return null;
  }
}

/**
 * Observe First Input Delay (FID)
 * Measures interactivity — delay between first user interaction and browser response
 */
export function observeFID(callback: MetricCallback, logger: Logger): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEntry & { processingStart?: number };
      if (firstEntry && firstEntry.processingStart) {
        const value = firstEntry.processingStart - firstEntry.startTime;
        logger.log('FID:', value, 'ms');
        callback({
          name: 'FID',
          value,
          timestamp: Date.now(),
          rating: getRating('FID', value),
          tags: {
            eventType: firstEntry.name,
          },
        });
        observer.disconnect();
      }
    });
    observer.observe({ type: 'first-input', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('FID observer not supported', e);
    return null;
  }
}

/**
 * Observe Interaction to Next Paint (INP)
 * Measures responsiveness — the worst interaction latency throughout the page lifecycle
 */
export function observeINP(callback: MetricCallback, logger: Logger): PerformanceObserver | null {
  try {
    const interactions: number[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const eventEntry = entry as PerformanceEntry & {
          interactionId?: number;
          processingStart?: number;
          processingEnd?: number;
          duration?: number;
        };

        if (eventEntry.interactionId && eventEntry.interactionId > 0) {
          const duration = eventEntry.duration || 0;
          interactions.push(duration);

          // INP is the 98th percentile of interaction durations
          interactions.sort((a, b) => a - b);
          const idx = Math.min(interactions.length - 1, Math.floor(interactions.length * 0.98));
          const inp = interactions[idx];

          logger.log('INP candidate:', inp, 'ms');
          callback({
            name: 'INP',
            value: inp,
            timestamp: Date.now(),
            rating: getRating('INP', inp),
          });
        }
      }
    });
    observer.observe({ type: 'event', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('INP observer not supported', e);
    return null;
  }
}

/**
 * Collect Time to First Byte (TTFB)
 * Measures server responsiveness — time from request to first byte of response
 */
export function collectTTFB(callback: MetricCallback, logger: Logger): void {
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const value = nav.responseStart - nav.requestStart;
      logger.log('TTFB:', value, 'ms');
      callback({
        name: 'TTFB',
        value,
        timestamp: Date.now(),
        rating: getRating('TTFB', value),
        tags: {
          protocol: nav.nextHopProtocol || 'unknown',
          transferSize: String(nav.transferSize || 0),
        },
      });
    }
  } catch (e) {
    logger.warn('TTFB collection failed', e);
  }
}

/**
 * Observe Long Tasks (>50ms)
 * Identifies tasks that block the main thread
 */
export function observeLongTasks(
  callback: MetricCallback,
  logger: Logger
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = entry.duration;
        logger.log('Long Task:', value, 'ms');
        callback({
          name: 'long-task',
          value,
          timestamp: Date.now(),
          rating: value > 150 ? 'poor' : value > 100 ? 'needs-improvement' : 'good',
          tags: {
            entryType: entry.entryType,
          },
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('Long Task observer not supported', e);
    return null;
  }
}

/**
 * Observe Resource Timing
 * Tracks loading performance of individual resources (scripts, images, fonts, etc.)
 */
export function observeResources(
  callback: MetricCallback,
  logger: Logger
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        const duration = resource.duration;

        // Only report slow resources (>500ms)
        if (duration < 500) continue;

        logger.log('Slow resource:', resource.name, duration, 'ms');
        callback({
          name: 'slow-resource',
          value: duration,
          timestamp: Date.now(),
          rating: duration > 2000 ? 'poor' : duration > 1000 ? 'needs-improvement' : 'good',
          tags: {
            resourceType: resource.initiatorType,
            resourceUrl: resource.name.substring(0, 200),
            transferSize: String(resource.transferSize || 0),
          },
        });
      }
    });
    observer.observe({ type: 'resource', buffered: true });
    return observer;
  } catch (e) {
    logger.warn('Resource observer not supported', e);
    return null;
  }
}

/**
 * Collect Navigation Timing metrics
 * Tracks page load phases (DNS, TCP, request, response, DOM processing)
 */
export function collectNavigationTiming(callback: MetricCallback, logger: Logger): void {
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length === 0) return;

    const nav = navEntries[0];

    const timings: Array<{ name: string; value: number }> = [
      { name: 'dns-lookup', value: nav.domainLookupEnd - nav.domainLookupStart },
      { name: 'tcp-connection', value: nav.connectEnd - nav.connectStart },
      { name: 'request-time', value: nav.responseStart - nav.requestStart },
      { name: 'response-time', value: nav.responseEnd - nav.responseStart },
      { name: 'dom-processing', value: nav.domComplete - nav.domInteractive },
      { name: 'dom-content-loaded', value: nav.domContentLoadedEventEnd - nav.startTime },
      { name: 'page-load', value: nav.loadEventEnd - nav.startTime },
    ];

    for (const timing of timings) {
      if (timing.value <= 0) continue;
      logger.log(`${timing.name}:`, timing.value, 'ms');
      callback({
        name: timing.name,
        value: timing.value,
        timestamp: Date.now(),
        rating: 'good', // Navigation timings don't have standard thresholds
      });
    }
  } catch (e) {
    logger.warn('Navigation timing collection failed', e);
  }
}
