import rateLimit from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

/**
 * Basic per-IP rate limiting for public-facing write endpoints (e.g.
 * POST /orders). This is intentionally simple - an in-memory counter is
 * fine for a single-instance demo. A multi-instance production deployment
 * would back this with a shared store (Redis) so limits apply across all
 * instances rather than per-process.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? 60_000,
    limit: options.max ?? 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests - please slow down' },
    },
  });
}
