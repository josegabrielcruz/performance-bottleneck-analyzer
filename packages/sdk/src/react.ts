/**
 * Performance Bottleneck Analyzer SDK - React Integration
 *
 * React hooks and context provider for seamless integration
 * with React applications. Works with React 16.8+ (hooks support).
 *
 * @example
 * ```tsx
 * import { PBNProvider, useWebVitals, usePBN } from '@pbn/sdk/react';
 *
 * function App() {
 *   return (
 *     <PBNProvider config={{ collectorUrl: '/api/metrics', siteId: 'my-site' }}>
 *       <Dashboard />
 *     </PBNProvider>
 *   );
 * }
 *
 * function Dashboard() {
 *   const vitals = useWebVitals();
 *   const { reportMetric, startSpan } = usePBN();
 *   // ...
 * }
 * ```
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  createElement,
} from 'react';
import type { ReactNode } from 'react';

import { BrowserAgent } from '@pbn/browser-agent';
import type { AgentOptions, MetricData } from '@pbn/browser-agent';
import type { SDKConfig, WebVitalsData, MetricState } from './types';
import { trackRouteChanges, startSpan as createSpan, on, emit } from './helpers';
import type { PerformanceSpan } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PBNContextValue {
  /** The underlying BrowserAgent instance */
  agent: BrowserAgent | null;
  /** SDK configuration */
  config: SDKConfig;
  /** Whether the agent is initialized and collecting */
  isActive: boolean;
  /** Report a custom metric */
  reportMetric: (name: string, value: number, tags?: Record<string, string>) => void;
  /** Flush pending metrics immediately */
  flush: () => Promise<void>;
  /** Start a performance span */
  startSpan: (name: string) => PerformanceSpan;
}

const PBNContext = createContext<PBNContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PBNProviderProps {
  /** SDK configuration */
  config: SDKConfig;
  /** Child components */
  children: ReactNode;
}

/**
 * PBNProvider initializes the Performance Bottleneck Analyzer agent
 * and makes it available to all child components via React context.
 *
 * Place this at the root of your React application.
 */
export function PBNProvider(props: PBNProviderProps): ReturnType<typeof createElement> {
  const { config, children } = props;
  const agentRef = useRef<BrowserAgent | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Initialize agent on mount
  useEffect(() => {
    const agentOptions: AgentOptions = {
      collectorUrl: config.collectorUrl,
      siteId: config.siteId,
      debug: config.debug,
      sampleRate: config.sampleRate,
      batchSize: config.batchSize,
      flushInterval: config.flushInterval,
      headers: config.headers,
      metrics: config.metrics
        ? {
            lcp: config.metrics.lcp ?? true,
            cls: config.metrics.cls ?? true,
            fid: config.metrics.fid ?? true,
            inp: config.metrics.inp ?? true,
            ttfb: config.metrics.ttfb ?? true,
            longTasks: config.metrics.longTasks ?? false,
            resources: config.metrics.resources ?? false,
            navigation: config.metrics.navigation ?? false,
          }
        : undefined,
    };

    const agent = new BrowserAgent(agentOptions);
    agentRef.current = agent;
    agent.start();
    setIsActive(true);
    emit('init', config);

    // Optional SPA route change tracking
    let stopTracking: (() => void) | undefined;
    if (config.trackRouteChanges !== false) {
      stopTracking = trackRouteChanges((_event) => {
        // Route changes are tracked via the event emitter
      });
    }

    return () => {
      agent.stop();
      agentRef.current = null;
      setIsActive(false);
      stopTracking?.();
      emit('stop', undefined);
    };
  }, [config.collectorUrl, config.siteId]); // Re-init only if endpoint or site changes

  const reportMetric = useCallback((name: string, value: number, tags?: Record<string, string>) => {
    agentRef.current?.reportMetric(name, value, tags);
  }, []);

  const flush = useCallback(async () => {
    await agentRef.current?.flush();
  }, []);

  const startSpanFn = useCallback((name: string): PerformanceSpan => {
    return createSpan(name, (metricName, metricValue) => {
      agentRef.current?.reportMetric(metricName, metricValue);
    });
  }, []);

  const contextValue: PBNContextValue = {
    agent: agentRef.current,
    config,
    isActive,
    reportMetric,
    flush,
    startSpan: startSpanFn,
  };

  return createElement(PBNContext.Provider, { value: contextValue }, children);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the PBN SDK context. Must be used within a `<PBNProvider>`.
 *
 * @returns SDK context with agent, reporting functions, and state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { reportMetric, startSpan, isActive } = usePBN();
 *
 *   const handleClick = async () => {
 *     const span = startSpan('button-action');
 *     await doSomething();
 *     span.end();
 *   };
 * }
 * ```
 */
export function usePBN(): PBNContextValue {
  const context = useContext(PBNContext);
  if (!context) {
    throw new Error('usePBN must be used within a <PBNProvider>');
  }
  return context;
}

/**
 * Subscribe to real-time Web Vitals metrics as they are collected.
 * Returns the latest values for each Core Web Vital.
 *
 * @example
 * ```tsx
 * function VitalsDisplay() {
 *   const vitals = useWebVitals();
 *
 *   return (
 *     <div>
 *       <p>LCP: {vitals.lcp ?? 'Loading...'}</p>
 *       <p>CLS: {vitals.cls ?? 'Loading...'}</p>
 *       <p>INP: {vitals.inp ?? 'Loading...'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebVitals(): WebVitalsData {
  const [vitals, setVitals] = useState<WebVitalsData>({
    lcp: null,
    cls: null,
    fid: null,
    inp: null,
    ttfb: null,
  });

  useEffect(() => {
    const unsubscribe = on('metric', (data) => {
      const metric = data as MetricData;
      const key = metric.name.toLowerCase() as keyof WebVitalsData;
      if (key in vitals) {
        setVitals((prev) => ({ ...prev, [key]: metric.value }));
      }
    });

    return unsubscribe;
  }, []);

  return vitals;
}

/**
 * Track a specific metric by name with full state (value, rating, timestamp).
 *
 * @example
 * ```tsx
 * function LCPCard() {
 *   const lcp = useMetric('LCP');
 *   if (!lcp) return <p>Waiting for LCP...</p>;
 *   return <p>LCP: {lcp.value}ms ({lcp.rating})</p>;
 * }
 * ```
 */
export function useMetric(metricName: string): MetricState | null {
  const [state, setState] = useState<MetricState | null>(null);
  const targetName = metricName.toLowerCase();

  useEffect(() => {
    const unsubscribe = on('metric', (data) => {
      const metric = data as MetricData;
      if (metric.name.toLowerCase() === targetName) {
        setState({
          value: metric.value,
          rating: metric.rating,
          timestamp: metric.timestamp,
        });
      }
    });

    return unsubscribe;
  }, [targetName]);

  return state;
}

/**
 * Measure a component's render performance.
 * Reports the time between mount and the next paint.
 *
 * @param componentName - Name to tag the metric with
 *
 * @example
 * ```tsx
 * function HeavyComponent() {
 *   useRenderTiming('HeavyComponent');
 *   return <div>...</div>;
 * }
 * ```
 */
export function useRenderTiming(componentName: string): void {
  const context = useContext(PBNContext);

  useEffect(() => {
    const start = performance.now();

    // Use requestAnimationFrame to measure until next paint
    const frameId = requestAnimationFrame(() => {
      const duration = performance.now() - start;
      context?.reportMetric(`render.${componentName}`, duration, {
        component: componentName,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [componentName]);
}

/**
 * Hook to create performance spans for async operations within components.
 *
 * @example
 * ```tsx
 * function DataLoader() {
 *   const { measure } = usePerformanceSpan();
 *
 *   useEffect(() => {
 *     measure('load-data', async () => {
 *       const data = await fetchData();
 *       setData(data);
 *     });
 *   }, []);
 * }
 * ```
 */
export function usePerformanceSpan(): {
  measure: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  span: (name: string) => PerformanceSpan;
} {
  const context = useContext(PBNContext);

  const measure = useCallback(
    async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const s = createSpan(name, (metricName, metricValue) => {
        context?.reportMetric(metricName, metricValue);
      });
      try {
        const result = await fn();
        s.end();
        return result;
      } catch (err) {
        s.end();
        throw err;
      }
    },
    [context]
  );

  const span = useCallback(
    (name: string): PerformanceSpan => {
      return createSpan(name, (metricName, metricValue) => {
        context?.reportMetric(metricName, metricValue);
      });
    },
    [context]
  );

  return { measure, span };
}

// Re-export types used by consumers
export type { SDKConfig, WebVitalsData, MetricState, PBNContextValue, PBNProviderProps };
