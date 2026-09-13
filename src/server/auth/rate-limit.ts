const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  windowStartedAt: number;
  blockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

export interface RateLimitStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

export const getRateLimitStatus = (key: string): RateLimitStatus => {
  const record = attempts.get(key);
  if (!record) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const now = Date.now();

  if (record.blockedUntil) {
    if (record.blockedUntil > now) {
      return { limited: true, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    attempts.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (now - record.windowStartedAt > WINDOW_MS) {
    attempts.delete(key);
  }

  return { limited: false, retryAfterSeconds: 0 };
};

export const registerFailedAttempt = (key: string): void => {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.windowStartedAt > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS;
  }
};

export const registerSuccessfulAttempt = (key: string): void => {
  attempts.delete(key);
};
