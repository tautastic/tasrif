import type { Page } from "@playwright/test";
import { goBackExpectingPrompt, recordDialogs } from "../support/dialogs.ts";
import { expect, test } from "../support/fixtures.ts";

const UNSAVED_MESSAGE = "You have unsaved changes. Leave this page and discard them?";

const openEditFormFromList = async (page: Page, text: string): Promise<void> => {
  await page.goto("/admin/entries");
  await page
    .getByRole("row", { name: new RegExp(text) })
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit Entry" })).toBeVisible();
  await expect(page.getByLabel("Text", { exact: true })).toBeVisible();
};

const makeDirty = async (page: Page): Promise<void> => {
  const field = page.getByLabel("Text", { exact: true });
  await field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
};

test.describe("unsaved changes guard on the entry form", () => {
  test("a clean form leaves without a prompt on a link click and on Back", async ({ adminPage }) => {
    const dialogs = recordDialogs(adminPage);
    await openEditFormFromList(adminPage, "book");
    await adminPage.goBack();
    await expect(adminPage).toHaveURL(/\/admin\/entries$/);

    await openEditFormFromList(adminPage, "book");
    await adminPage.getByRole("link", { name: "Tasrif" }).click();
    await expect(adminPage).toHaveURL(/\/$/);
    expect(dialogs.messages()).toEqual([]);
  });

  test("a dirty form asks before a link click leaves and stays when declined", async ({ adminPage }) => {
    const dialogs = recordDialogs(adminPage, "dismiss");
    await openEditFormFromList(adminPage, "book");
    await makeDirty(adminPage);
    const editUrl = adminPage.url();

    await adminPage.getByRole("link", { name: "Tasrif" }).click();
    await expect.poll(() => dialogs.messages()).toEqual([UNSAVED_MESSAGE]);
    expect(dialogs.types()).toEqual(["confirm"]);
    expect(adminPage.url()).toBe(editUrl);
    await expect(adminPage.getByLabel("Text", { exact: true })).toHaveValue("book!");
  });

  test("accepting the prompt after a link click leaves the form", async ({ adminPage }) => {
    const dialogs = recordDialogs(adminPage, "accept");
    await openEditFormFromList(adminPage, "book");
    await makeDirty(adminPage);
    await adminPage.getByRole("link", { name: "Tasrif" }).click();
    await expect(adminPage).toHaveURL(/\/$/);
    expect(dialogs.messages()).toEqual([UNSAVED_MESSAGE]);
  });

  test("browser Back on a dirty form asks first, stays when declined and leaves when accepted", async ({
    adminPage,
  }) => {
    await openEditFormFromList(adminPage, "book");
    await makeDirty(adminPage);
    const editUrl = adminPage.url();

    const declined = await goBackExpectingPrompt(adminPage, "dismiss");
    expect(declined.message()).toBe(UNSAVED_MESSAGE);
    expect(adminPage.url()).toBe(editUrl);
    await expect(adminPage.getByLabel("Text", { exact: true })).toHaveValue("book!");

    await adminPage.getByLabel("Text", { exact: true }).click();
    const accepted = await goBackExpectingPrompt(adminPage, "accept");
    expect(accepted.message()).toBe(UNSAVED_MESSAGE);
    await expect(adminPage).toHaveURL(/\/admin\/entries$/);
    await expect(adminPage.getByRole("heading", { level: 1, name: "Entries" })).toBeVisible();
  });

  test("the router stays consistent after a declined Back followed by a link click", async ({ adminPage }) => {
    await openEditFormFromList(adminPage, "book");
    await makeDirty(adminPage);
    await goBackExpectingPrompt(adminPage, "dismiss");
    const dialogs = recordDialogs(adminPage, "accept");
    await adminPage.getByRole("link", { name: "Tasrif" }).click();
    await expect(adminPage).toHaveURL(/\/$/);
    await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    expect(dialogs.messages()).toEqual([UNSAVED_MESSAGE]);
  });

  test("Cancel on a dirty form asks exactly once, stays when declined and leaves when accepted", async ({
    adminPage,
  }) => {
    const dialogs = recordDialogs(adminPage, "dismiss");
    await openEditFormFromList(adminPage, "book");
    await makeDirty(adminPage);
    const editUrl = adminPage.url();

    await adminPage.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(() => dialogs.messages()).toEqual([UNSAVED_MESSAGE]);
    expect(adminPage.url()).toBe(editUrl);

    dialogs.answerWith("accept");
    await adminPage.getByRole("button", { name: "Cancel" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries$/);
    expect(dialogs.messages()).toEqual([UNSAVED_MESSAGE, UNSAVED_MESSAGE]);
  });

  test("Cancel on a clean form leaves without a prompt", async ({ adminPage }) => {
    const dialogs = recordDialogs(adminPage);
    await openEditFormFromList(adminPage, "book");
    await adminPage.getByRole("button", { name: "Cancel" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries$/);
    expect(dialogs.messages()).toEqual([]);
  });

  test("the new entry form is guarded as well", async ({ adminPage }) => {
    const dialogs = recordDialogs(adminPage, "dismiss");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("draft text");
    await adminPage.getByRole("link", { name: "Tasrif" }).click();
    await expect.poll(() => dialogs.messages()).toEqual([UNSAVED_MESSAGE]);
    await expect(adminPage).toHaveURL(/\/admin\/new-entry$/);
  });

  test("a dirty form is flagged to the browser for reloads and tab closes", async ({ adminPage }) => {
    await openEditFormFromList(adminPage, "book");
    const beforeUnload = async () =>
      adminPage.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(await beforeUnload()).toBe(false);
    await makeDirty(adminPage);
    expect(await beforeUnload()).toBe(true);
  });
});
