/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests by IP with sliding window.
 */

const ipRequestMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipRequestMap) {
    if (val.resetAt < now) ipRequestMap.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs?: number;   // Window in milliseconds (default 60s)
  maxRequests?: number; // Max requests per window (default 30)
}

export function checkRateLimit(
  ip: string,
  opts: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const windowMs = opts.windowMs || 60_000;
  const maxRequests = opts.maxRequests || 30;
  const now = Date.now();

  const existing = ipRequestMap.get(ip);

  if (!existing || existing.resetAt < now) {
    ipRequestMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  existing.count++;

  if (existing.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt };
}
