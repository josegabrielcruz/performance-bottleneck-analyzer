import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { validateMetricPayload, errorHandler, notFoundHandler } from '../src/middleware';

// Helper to create mock Request
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock Response
function mockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

describe('middleware', () => {
  // -----------------------------------------------------------------------
  // validateMetricPayload
  // -----------------------------------------------------------------------
  describe('validateMetricPayload', () => {
    let next: NextFunction;

    beforeEach(() => {
      next = vi.fn();
    });

    it('rejects missing siteId', () => {
      const req = mockReq({ body: { metrics: [{ name: 'LCP', value: 1000 }] } });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
      expect((res._json as { message: string }).message).toContain('siteId');
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects missing metrics array', () => {
      const req = mockReq({ body: { siteId: 'test-site' } });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
      expect((res._json as { message: string }).message).toContain('metrics');
    });

    it('rejects empty metrics array', () => {
      const req = mockReq({ body: { siteId: 'test-site', metrics: [] } });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
    });

    it('rejects too many metrics (>500)', () => {
      const metrics = Array(501).fill({ name: 'LCP', value: 1000 });
      const req = mockReq({ body: { siteId: 'test-site', metrics } });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
      expect((res._json as { message: string }).message).toContain('500');
    });

    it('rejects metric without name', () => {
      const req = mockReq({
        body: { siteId: 'test-site', metrics: [{ value: 1000 }] },
      });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
      expect((res._json as { message: string }).message).toContain('name');
    });

    it('rejects metric with non-numeric value', () => {
      const req = mockReq({
        body: { siteId: 'test-site', metrics: [{ name: 'LCP', value: 'fast' }] },
      });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
      expect((res._json as { message: string }).message).toContain('numeric');
    });

    it('rejects metric with NaN value', () => {
      const req = mockReq({
        body: { siteId: 'test-site', metrics: [{ name: 'LCP', value: NaN }] },
      });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(res._status).toBe(400);
    });

    it('passes valid payload and sanitizes strings', () => {
      const req = mockReq({
        body: {
          siteId: 'test-site',
          metrics: [{ name: 'LCP', value: 2500 }],
          url: 'https://example.com/<script>',
          referrer: '',
        },
      });
      const res = mockRes();

      validateMetricPayload(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      // XSS chars should be stripped
      expect(req.body.url).not.toContain('<');
      expect(req.body.url).not.toContain('>');
    });
  });

  // -----------------------------------------------------------------------
  // errorHandler
  // -----------------------------------------------------------------------
  describe('errorHandler', () => {
    it('returns 500 with error message', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      const err = new Error('Test error');

      // Suppress console.error in test
      vi.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler(err, req, res, next);

      expect(res._status).toBe(500);
      expect((res._json as { error: string }).error).toBe('Internal Server Error');

      vi.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // notFoundHandler
  // -----------------------------------------------------------------------
  describe('notFoundHandler', () => {
    it('returns 404', () => {
      const req = mockReq();
      const res = mockRes();

      notFoundHandler(req, res);

      expect(res._status).toBe(404);
      expect((res._json as { error: string }).error).toBe('Not Found');
    });
  });
});
