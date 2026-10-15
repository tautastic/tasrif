import type { Locator, Page } from "@playwright/test";

export const alerts = (page: Page): Locator => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const redirectTarget = (response: { headersArray: () => { name: string; value: string }[] }): string => {
  const values = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "location")
    .map((header) => header.value);
  const distinct = [...new Set(values)];
  if (distinct.length !== 1) {
    throw new Error(`Expected one distinct Location value, received ${JSON.stringify(values)}`);
  }
  return distinct[0] ?? "";
};

export const linkedSenses = (page: Page, senseId: number, title: "Translations" | "Related"): Locator =>
  page.locator(`#sense-${senseId}`).locator(`xpath=.//span[normalize-space()="${title}:"]/following-sibling::ul[1]/li`);
