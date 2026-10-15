import { createHash } from "node:crypto";
import { type APIRequestContext, type BrowserContext, test as base, expect, type Page } from "@playwright/test";
import type { Db } from "../../tests/harness/client.ts";
import { ADMIN_PASSWORD } from "./constants.ts";
import { openDatabase } from "./database.ts";
import type { SeedIds } from "./seed.ts";
import { readState } from "./state.ts";

interface TestFixtures {
  clientIp: string;
  adminPage: Page;
}

interface WorkerFixtures {
  db: Db;
  seed: SeedIds;
}

const ipFor = (testId: string, retry: number): string => {
  const digest = createHash("sha1").update(testId).digest();
  return `10.${digest[0] ?? 0}.${digest[1] ?? 0}.${(retry % 250) + 1}`;
};

const CONNECTION_RESET_RETRIES = 2;

export const loginRequest = (request: APIRequestContext, password: string = ADMIN_PASSWORD) =>
  request.post("/api/auth/login", { data: { password } });

const signInRequest = (request: APIRequestContext) =>
  request.post("/api/auth/login", { data: { password: ADMIN_PASSWORD }, maxRetries: CONNECTION_RESET_RETRIES });

export const signInContext = async (context: BrowserContext): Promise<void> => {
  const response = await signInRequest(context.request);
  expect(response.ok(), `login responded ${response.status()}`).toBe(true);
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  baseURL: async ({}, use) => {
    const baseUrl = process.env.E2E_BASE_URL;
    if (!baseUrl) {
      throw new Error("E2E_BASE_URL is not set; the global setup did not run");
    }
    await use(baseUrl);
  },
  clientIp: async ({}, use, testInfo) => {
    await use(ipFor(testInfo.testId, testInfo.retry));
  },
  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-real-ip": clientIp });
  },
  adminPage: async ({ page, context }, use) => {
    await signInContext(context);
    await use(page);
  },
  db: [
    async ({}, use) => {
      const db = await openDatabase(readState().database);
      await use(db);
      await db.close();
    },
    { scope: "worker" },
  ],
  seed: [
    async ({}, use) => {
      await use(readState().seed);
    },
    { scope: "worker" },
  ],
});

export { expect };
