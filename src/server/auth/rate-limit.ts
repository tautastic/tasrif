const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;
const TRIM_TO_KEYS = MAX_TRACKED_KEYS / 2;

interface AttemptRecord {
  count: number;
  windowStartedAt: number;
  blockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();
let lastSweepAt = 0;

export interface RateLimitStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

const isExpired = (record: AttemptRecord, now: number): boolean =>
  record.blockedUntil === undefined ? now - record.windowStartedAt > WINDOW_MS : record.blockedUntil <= now;

const evictionOrder = (): string[] => {
  const unblocked: [string, AttemptRecord][] = [];
  const blocked: [string, AttemptRecord][] = [];

  for (const entry of attempts) {
    (entry[1].blockedUntil === undefined ? unblocked : blocked).push(entry);
  }

  unblocked.sort(([, a], [, b]) => a.windowStartedAt - b.windowStartedAt);
  blocked.sort(([, a], [, b]) => (a.blockedUntil ?? 0) - (b.blockedUntil ?? 0));

  return [...unblocked, ...blocked].map(([key]) => key);
};

const sweep = (now: number): void => {
  lastSweepAt = now;

  for (const [key, record] of attempts) {
    if (isExpired(record, now)) {
      attempts.delete(key);
    }
  }

  if (attempts.size <= MAX_TRACKED_KEYS) {
    return;
  }

  for (const key of evictionOrder()) {
    if (attempts.size <= TRIM_TO_KEYS) {
      break;
    }
    attempts.delete(key);
  }
};

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

  if (now - lastSweepAt >= SWEEP_INTERVAL_MS || attempts.size > MAX_TRACKED_KEYS) {
    sweep(now);
  }

  const record = attempts.get(key);

  if (!record || isExpired(record, now)) {
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

export const trackedKeyCount = (): number => attempts.size;
