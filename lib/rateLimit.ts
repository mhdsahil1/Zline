/**
 * In-memory rate limiter for OTP requests.
 *
 * Tracks per-email and per-IP request counts within sliding windows.
 * Suitable for single-instance deployments. For multi-instance,
 * replace with Redis-backed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

const emailLimits = new Map<string, RateLimitEntry>();
const ipLimits = new Map<string, RateLimitEntry>();
const resendCooldowns = new Map<string, number>(); // email -> earliest next send timestamp

// Configuration
const EMAIL_MAX_REQUESTS = 3; // max OTP requests per email per window
const IP_MAX_REQUESTS = 10; // max OTP requests per IP per window
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends for same email

// Cleanup stale entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of emailLimits) {
    if (now > entry.resetAt) emailLimits.delete(key);
  }
  for (const [key, entry] of ipLimits) {
    if (now > entry.resetAt) ipLimits.delete(key);
  }
  for (const [key, ts] of resendCooldowns) {
    if (now > ts) resendCooldowns.delete(key);
  }
}

function checkLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxRequests: number
): { allowed: boolean; retryAfterMs?: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Window expired or first request — start new window
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

export function checkEmailRateLimit(email: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  return checkLimit(emailLimits, email, EMAIL_MAX_REQUESTS);
}

export function checkIpRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  return checkLimit(ipLimits, ip, IP_MAX_REQUESTS);
}

export function checkResendCooldown(email: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  cleanup();
  const now = Date.now();
  const cooldownUntil = resendCooldowns.get(email);

  if (cooldownUntil && now < cooldownUntil) {
    return { allowed: false, retryAfterMs: cooldownUntil - now };
  }

  return { allowed: true };
}

export function setResendCooldown(email: string): void {
  resendCooldowns.set(email, Date.now() + RESEND_COOLDOWN_MS);
}
