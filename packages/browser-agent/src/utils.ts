/**
 * Utility functions for the browser agent
 */

import { PageContext } from './types';

/** Generate a unique session ID */
export function generateSessionId(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Get or create a persistent session ID for this page visit */
export function getSessionId(): string {
  const key = '__pbn_session_id';
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = generateSessionId();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return generateSessionId();
  }
}

/** Collect contextual information about the page and device */
export function getPageContext(): PageContext {
  const nav = navigator as Navigator & {
    connection?: {
      type?: string;
      effectiveType?: string;
    };
    deviceMemory?: number;
  };

  const connection = nav.connection;

  return {
    userAgent: navigator.userAgent,
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    connectionType: connection?.type || 'unknown',
    effectiveType: connection?.effectiveType || 'unknown',
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    pathname: location.pathname,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

/** Determine a metric rating based on Web Vitals thresholds */
export function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    TTFB: [800, 1800],
  };

  const bounds = thresholds[name];
  if (!bounds) return 'good';

  if (value <= bounds[0]) return 'good';
  if (value <= bounds[1]) return 'needs-improvement';
  return 'poor';
}

/** Debug logger that only logs when debug mode is enabled */
export function createLogger(debug: boolean) {
  return {
    log: (...args: unknown[]) => {
      if (debug) console.log('[PBN]', ...args);
    },
    warn: (...args: unknown[]) => {
      if (debug) console.warn('[PBN]', ...args);
    },
    error: (...args: unknown[]) => {
      // Always log errors
      console.error('[PBN]', ...args);
    },
  };
}
