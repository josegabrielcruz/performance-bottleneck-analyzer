import { describe, it, expect } from 'vitest';
import {
  on,
  off,
  emit,
  getRating,
  WEB_VITALS_THRESHOLDS,
  debounce,
  throttle,
  startSpan,
  measureSync,
} from '../src/helpers';

describe('helpers', () => {
  // -----------------------------------------------------------------------
  // Event Emitter
  // -----------------------------------------------------------------------
  describe('event emitter', () => {
    it('emits and receives events', () => {
      const received: unknown[] = [];
      const unsub = on('metric', (data) => received.push(data));

      emit('metric', { value: 42 });

      expect(received).toEqual([{ value: 42 }]);
      unsub();
    });

    it('unsubscribes via returned function', () => {
      let count = 0;
      const unsub = on('metric', () => count++);

      emit('metric');
      unsub();
      emit('metric');

      expect(count).toBe(1);
    });

    it('removes listeners with off()', () => {
      let count = 0;
      on('metric', () => count++);

      emit('metric');
      off('metric');
      emit('metric');

      expect(count).toBe(1);
      // Clean up all remaining
      off();
    });

    it('off() without args clears everything', () => {
      let count = 0;
      on('metric', () => count++);
      on('error', () => count++);

      off();
      emit('metric');
      emit('error');

      expect(count).toBe(0);
    });

    it('swallows listener errors', () => {
      on('metric', () => {
        throw new Error('boom');
      });

      // Should not throw
      expect(() => emit('metric')).not.toThrow();
      off();
    });
  });

  // -----------------------------------------------------------------------
  // getRating
  // -----------------------------------------------------------------------
  describe('getRating', () => {
    it('returns good for low LCP', () => {
      expect(getRating('LCP', 1000)).toBe('good');
    });

    it('returns needs-improvement for mid LCP', () => {
      expect(getRating('LCP', 3000)).toBe('needs-improvement');
    });

    it('returns poor for high LCP', () => {
      expect(getRating('LCP', 5000)).toBe('poor');
    });

    it('returns good for unknown metrics', () => {
      expect(getRating('unknown', 100)).toBe('good');
    });
  });

  // -----------------------------------------------------------------------
  // WEB_VITALS_THRESHOLDS
  // -----------------------------------------------------------------------
  describe('WEB_VITALS_THRESHOLDS', () => {
    it('has correct LCP thresholds', () => {
      expect(WEB_VITALS_THRESHOLDS.LCP).toEqual({ good: 2500, poor: 4000 });
    });

    it('has correct CLS thresholds', () => {
      expect(WEB_VITALS_THRESHOLDS.CLS).toEqual({ good: 0.1, poor: 0.25 });
    });
  });

  // -----------------------------------------------------------------------
  // startSpan & measureSync
  // -----------------------------------------------------------------------
  describe('startSpan', () => {
    it('returns a span with name and startTime', () => {
      const span = startSpan('test');
      expect(span.name).toBe('test');
      expect(span.startTime).toBeGreaterThan(0);
      off(); // clean up events
    });

    it('end() returns a positive duration', () => {
      const span = startSpan('test');
      // Simulate a tiny delay
      const duration = span.end();
      expect(duration).toBeGreaterThanOrEqual(0);
      off();
    });

    it('calls reportFn on end()', () => {
      let reported: { name: string; value: number } | null = null;
      const span = startSpan('test', (name, value) => {
        reported = { name, value };
      });
      span.end();
      expect(reported).not.toBeNull();
      expect(reported!.name).toBe('span.test');
      off();
    });
  });

  describe('measureSync', () => {
    it('returns the function result', () => {
      const result = measureSync('add', () => 2 + 3);
      expect(result).toBe(5);
      off();
    });

    it('calls reportFn with duration', () => {
      let reported = false;
      measureSync(
        'op',
        () => 42,
        () => {
          reported = true;
        }
      );
      expect(reported).toBe(true);
      off();
    });
  });

  // -----------------------------------------------------------------------
  // debounce
  // -----------------------------------------------------------------------
  describe('debounce', () => {
    it('delays execution', async () => {
      let count = 0;
      const fn = debounce(() => count++, 50);

      fn();
      fn();
      fn();

      expect(count).toBe(0);

      await new Promise((r) => setTimeout(r, 100));
      expect(count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // throttle
  // -----------------------------------------------------------------------
  describe('throttle', () => {
    it('executes immediately then throttles', () => {
      let count = 0;
      const fn = throttle(() => count++, 1000);

      fn(); // should execute
      fn(); // should be throttled
      fn(); // should be throttled

      expect(count).toBe(1);
    });
  });
});
