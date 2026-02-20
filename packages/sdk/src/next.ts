/**
 * Performance Bottleneck Analyzer SDK - Next.js Integration
 *
 * Helpers for integrating with Next.js applications.
 * Supports both App Router (13+) and Pages Router.
 *
 * @example App Router (layout.tsx):
 * ```tsx
 * import { PBNProvider } from '@pbn/sdk/react';
 * import { createNextConfig } from '@pbn/sdk/next';
 *
 * const pbnConfig = createNextConfig({
 *   siteId: 'my-site',
 *   environment: process.env.NODE_ENV as 'production' | 'development',
 * });
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <PBNProvider config={pbnConfig}>
 *           {children}
 *         </PBNProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @example Pages Router (_app.tsx):
 * ```tsx
 * import { PBNProvider } from '@pbn/sdk/react';
 * import { createNextConfig, useNextRouteTracking } from '@pbn/sdk/next';
 * import { useRouter } from 'next/router';
 *
 * const config = createNextConfig({ siteId: 'my-site' });
 *
 * function MyApp({ Component, pageProps }) {
 *   const router = useRouter();
 *   useNextRouteTracking(router);
 *
 *   return (
 *     <PBNProvider config={config}>
 *       <Component {...pageProps} />
 *     </PBNProvider>
 *   );
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import type { SDKConfig } from './types';
import { emit } from './helpers';
import type { RouteChangeEvent } from './types';

// ---------------------------------------------------------------------------
// Next.js Config Helper
// ---------------------------------------------------------------------------

interface NextConfigOptions {
  /** Unique site identifier */
  siteId: string;
  /** Collector API URL. Defaults to '/api/pbn/metrics' for API route proxying */
  collectorUrl?: string;
  /** Environment name */
  environment?: 'production' | 'staging' | 'development';
  /** Enable debug logging */
  debug?: boolean;
  /** Sampling rate (0-1) */
  sampleRate?: number;
  /** Batch size for metric payloads */
  batchSize?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Create an SDK configuration optimized for Next.js applications.
 *
 * By default, the collector URL is set to `/api/pbn/metrics` to work
 * with a Next.js API route that proxies metrics to your PBN API server.
 * This avoids CORS issues and keeps your API URL server-side only.
 *
 * @param options - Next.js specific configuration
 * @returns SDKConfig ready to pass to PBNProvider
 */
export function createNextConfig(options: NextConfigOptions): SDKConfig {
  return {
    collectorUrl: options.collectorUrl ?? '/api/pbn/metrics',
    siteId: options.siteId,
    environment: options.environment,
    debug: options.debug ?? options.environment === 'development',
    sampleRate: options.sampleRate ?? (options.environment === 'production' ? 1.0 : 0.1),
    batchSize: options.batchSize ?? 10,
    trackRouteChanges: true, // Next.js SPAs benefit from route tracking
    headers: options.headers,
  };
}

// ---------------------------------------------------------------------------
// Pages Router Integration
// ---------------------------------------------------------------------------

/**
 * A minimal type representing the Next.js Pages Router.
 * This avoids requiring `next` as a dependency.
 */
interface NextPagesRouter {
  pathname: string;
  events: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}

/**
 * Track route changes using Next.js Pages Router events.
 * Use this hook in your `_app.tsx` with `useRouter()`.
 *
 * For App Router, route changes are automatically detected via
 * the history API monkey-patching in the SDK's helpers.
 *
 * @param router - Next.js Pages Router instance from useRouter()
 */
export function useNextRouteTracking(router: NextPagesRouter): void {
  const prevPath = useRef(router.pathname);

  useEffect(() => {
    const handleStart = (...args: unknown[]): void => {
      const url = args[0];
      const routeEvent: RouteChangeEvent = {
        from: prevPath.current,
        to: typeof url === 'string' ? new URL(url, 'http://localhost').pathname : String(url),
        timestamp: Date.now(),
      };

      emit('route-change', routeEvent);
      prevPath.current = routeEvent.to;
    };

    router.events.on('routeChangeComplete', handleStart);

    return () => {
      router.events.off('routeChangeComplete', handleStart);
    };
  }, [router.events]);
}

// ---------------------------------------------------------------------------
// Next.js API Route Helper
// ---------------------------------------------------------------------------

/**
 * Type for a Next.js API route handler request.
 * Avoids importing `next` types directly.
 */
interface NextApiRequest {
  method?: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Type for a Next.js API route handler response.
 */
interface NextApiResponse {
  status: (code: number) => NextApiResponse;
  json: (data: unknown) => void;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

/**
 * Create a Next.js API route handler that proxies metric payloads
 * to your PBN API server. Use this in `pages/api/pbn/metrics.ts`
 * or as an App Router route handler.
 *
 * @param apiUrl - The URL of your PBN API server (e.g., 'https://api.pbn.example.com')
 * @param apiKey - Optional API key for authentication
 *
 * @example pages/api/pbn/metrics.ts (Pages Router):
 * ```ts
 * import { createMetricsProxy } from '@pbn/sdk/next';
 *
 * export default createMetricsProxy(
 *   process.env.PBN_API_URL!,
 *   process.env.PBN_API_KEY
 * );
 * ```
 */
export function createMetricsProxy(
  apiUrl: string,
  apiKey?: string
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Forward the metric payload to the PBN API
      const targetUrl = `${apiUrl.replace(/\/$/, '')}/api/metrics`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch {
      res.status(502).json({ error: 'Failed to proxy metrics to PBN API' });
    }
  };
}

// ---------------------------------------------------------------------------
// Reporting Web Vitals (Pages Router)
// ---------------------------------------------------------------------------

/**
 * Web Vitals metric shape from Next.js `reportWebVitals`.
 */
interface NextWebVitalsMetric {
  id: string;
  name: string;
  startTime: number;
  value: number;
  label: 'web-vital' | 'custom';
}

/**
 * Create a `reportWebVitals` function for Next.js Pages Router.
 * Export the returned function from `_app.tsx` to automatically
 * capture Web Vitals measured by Next.js itself.
 *
 * @param reportFn - Function to report metrics (from usePBN or SDK instance)
 *
 * @example _app.tsx:
 * ```tsx
 * import { createReportWebVitals } from '@pbn/sdk/next';
 * import sdk from './pbn-sdk';
 *
 * export const reportWebVitals = createReportWebVitals(
 *   (name, value) => sdk.reportMetric(name, value)
 * );
 * ```
 */
export function createReportWebVitals(
  reportFn: (name: string, value: number, tags?: Record<string, string>) => void
): (metric: NextWebVitalsMetric) => void {
  return (metric: NextWebVitalsMetric): void => {
    const tags: Record<string, string> = {
      source: 'next-web-vitals',
      label: metric.label,
      id: metric.id,
    };

    reportFn(metric.name, metric.value, tags);
  };
}

// Re-export types
export type { NextConfigOptions, NextPagesRouter, NextWebVitalsMetric };
