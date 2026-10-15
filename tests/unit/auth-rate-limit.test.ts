import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import {
  getRateLimitStatus,
  registerFailedAttempt,
  registerSuccessfulAttempt,
  trackedKeyCount,
} from "~/server/auth/rate-limit";

const MINUTE_MS = 60 * 1000;

beforeEach(() => {
  mock.timers.enable({ apis: ["Date"], now: 10_000_000 });
});

afterEach(() => {
  mock.timers.reset();
});

const failTimes = (key: string, times: number) => {
  for (let index = 0; index < times; index += 1) {
    registerFailedAttempt(key);
  }
};

test("blocks a key after five failed attempts", () => {
  failTimes("block-key", 4);
  assert.equal(getRateLimitStatus("block-key").limited, false);

  registerFailedAttempt("block-key");
  const status = getRateLimitStatus("block-key");
  assert.equal(status.limited, true);
  assert.equal(status.retryAfterSeconds, 15 * 60);
});

test("keys are limited independently", () => {
  failTimes("independent-a", 5);
  assert.equal(getRateLimitStatus("independent-a").limited, true);
  assert.equal(getRateLimitStatus("independent-b").limited, false);
});

test("a block lifts after the block period", () => {
  failTimes("lift-key", 5);
  mock.timers.tick(15 * MINUTE_MS - 1000);
  assert.equal(getRateLimitStatus("lift-key").limited, true);

  mock.timers.tick(2000);
  assert.equal(getRateLimitStatus("lift-key").limited, false);
});

test("a successful attempt clears earlier failures", () => {
  failTimes("success-key", 4);
  registerSuccessfulAttempt("success-key");
  failTimes("success-key", 4);
  assert.equal(getRateLimitStatus("success-key").limited, false);
});

test("failures older than the window do not accumulate", () => {
  failTimes("window-key", 4);
  mock.timers.tick(16 * MINUTE_MS);
  failTimes("window-key", 4);
  assert.equal(getRateLimitStatus("window-key").limited, false);
});

test("expired records of other keys are swept so memory does not grow without bound", () => {
  mock.timers.tick(60 * MINUTE_MS);
  registerFailedAttempt("reset-sweep");
  const baseline = trackedKeyCount();

  for (let index = 0; index < 500; index += 1) {
    registerFailedAttempt(`rotating-${index}`);
  }
  assert.equal(trackedKeyCount(), baseline + 500);

  mock.timers.tick(20 * MINUTE_MS);
  registerFailedAttempt("trigger-sweep");

  assert.equal(trackedKeyCount(), 1);
});

test("the number of tracked keys is capped under a flood of fresh keys", () => {
  mock.timers.tick(60 * MINUTE_MS);
  for (let index = 0; index < 25_000; index += 1) {
    registerFailedAttempt(`flood-${index}`);
    mock.timers.tick(10);
  }
  assert.ok(trackedKeyCount() <= 10_001, `tracked ${trackedKeyCount()} keys`);
});

test("a flood of fresh keys does not evict a key that is currently blocked", () => {
  mock.timers.tick(120 * MINUTE_MS);
  failTimes("held-block", 5);
  assert.equal(getRateLimitStatus("held-block").limited, true);

  for (let index = 0; index < 12_000; index += 1) {
    registerFailedAttempt(`after-block-${index}`);
    mock.timers.tick(1);
  }

  assert.ok(trackedKeyCount() <= 10_001, `tracked ${trackedKeyCount()} keys`);
  assert.equal(getRateLimitStatus("held-block").limited, true);
});

test("a flood of blocked keys stays capped and drops the blocks that end first", () => {
  mock.timers.tick(120 * MINUTE_MS);

  for (let index = 0; index < 10_050; index += 1) {
    failTimes(`blocked-${index}`, 5);
    mock.timers.tick(1);
  }

  assert.ok(trackedKeyCount() <= 10_001, `tracked ${trackedKeyCount()} keys`);
  assert.equal(getRateLimitStatus("blocked-0").limited, false);
  assert.equal(getRateLimitStatus("blocked-10040").limited, true);
});
