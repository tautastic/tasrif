import { type APIRequestContext, expect, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { ADMIN_PASSWORD } from "./constants.ts";

export const newAnonymousClient = (
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  headers: Record<string, string> = {},
): Promise<APIRequestContext> => playwright.request.newContext({ baseURL, extraHTTPHeaders: headers });

export const signInThroughForm = async (page: Page, next?: string): Promise<void> => {
  await page.goto(next ? `/auth/login?${new URLSearchParams({ next }).toString()}` : "/auth/login");
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
};

export const captureRouterStateTree = async (page: Page): Promise<string> => {
  await page.goto("/admin");
  const pending = page.waitForRequest(
    (request) => request.url().includes("_rsc") && "next-router-state-tree" in request.headers(),
  );
  await page
    .getByRole("link", { name: /^Entries/ })
    .first()
    .click();
  const headers = await (await pending).allHeaders();
  const tree = headers["next-router-state-tree"];
  if (!tree) {
    throw new Error("The router did not send a state tree header");
  }
  return tree;
};
