import rateLimit from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

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
