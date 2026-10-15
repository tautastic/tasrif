import type { Page } from "@playwright/test";
import { removeEntries } from "../support/entries.ts";
import { expect, test } from "../support/fixtures.ts";

const QUAD_TEXT = "e2e دَحْرَجَ";
const GEMINATE_TEXT = "e2e مَدَّ";
const FINAL_WEAK_TEXT = "e2e اِسْلَنْقَى";
const FOUR_RADICAL_GEMINATE_TEXT = "e2e اِقْشَعَرَّ";
const REDUPLICATED_TEXT = "e2e زَلْزَلَ";

const nfc = (value: string): string => value.normalize("NFC");

const startVerb = async (page: Page, text: string, root: string, verbForm: string): Promise<void> => {
  await page.goto("/admin/new-entry");
  await page.getByLabel("Language").selectOption("ar");
  await page.getByLabel("Text", { exact: true }).fill(text);
  await page.getByLabel("Root (Arabic)").fill(root);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByLabel("Part of Speech").selectOption("verb");
  await page.getByLabel("Definitions (one per line)").fill(`definition of ${text}`);
  await page.getByLabel("Verb form").selectOption(verbForm);
  await page.getByRole("checkbox", { name: /Verified/ }).check();
};

test.describe("four-radical verbs and alternative forms", () => {
  test("a four-letter root is accepted with a quadriliteral form and shows its own form page", async ({
    adminPage,
    db,
  }) => {
    await removeEntries(db, QUAD_TEXT);
    await startVerb(adminPage, QUAD_TEXT, "دحرج", "form-1q");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    const active = adminPage.getByRole("region", { name: /^Active voice conjugation of/ });
    await expect(active).toBeVisible();
    expect(nfc(await active.innerText())).toContain(nfc("دَحْرَجَ"));
    expect(nfc(await active.innerText())).toContain(nfc("يُدَحْرِجُ"));
    const passive = adminPage.getByRole("region", { name: /^Passive voice conjugation of/ });
    await expect(passive).toBeVisible();
    expect(nfc(await passive.innerText())).toContain(nfc("دُحْرِجَ"));
    expect(nfc(await passive.innerText())).toContain(nfc("يُدَحْرَجُ"));

    await adminPage.goto("/arabic-verb-form/1q");
    await expect(adminPage.getByText(QUAD_TEXT)).toBeVisible();

    await removeEntries(db, QUAD_TEXT);
  });

  test("a final-weak four-letter root takes the final-weak pattern of form IIIq and shows its forms", async ({
    adminPage,
    db,
  }) => {
    await removeEntries(db, FINAL_WEAK_TEXT);
    await startVerb(adminPage, FINAL_WEAK_TEXT, "سلقي", "form-3q");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    const active = adminPage.getByRole("region", { name: /^Active voice conjugation of/ });
    await expect(active).toBeVisible();
    const text = nfc(await active.innerText());
    expect(text).toContain(nfc("اِسْلَنْقَيْتُ"));
    expect(text).toContain(nfc("يَسْلَنْقِي"));
    expect(text).toContain(nfc("تَسْلَنْقُونَ"));

    await adminPage.goto("/arabic-verb-form/3q");
    await expect(adminPage.getByText(FINAL_WEAK_TEXT)).toBeVisible();

    await removeEntries(db, FINAL_WEAK_TEXT);
  });

  test("a final-weak root is refused for a quadriliteral form without a pattern", async ({ adminPage }) => {
    await startVerb(adminPage, "e2e no final-weak pattern", "سلقي", "form-2q");
    await expect(adminPage.getByText(/pattern found/)).toHaveCount(0);
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/new-entry/);
    await expect(adminPage.getByText(/No morphological pattern is available/).first()).toBeVisible();
  });

  test("a root of the wrong length is refused for a quadriliteral form", async ({ adminPage }) => {
    await startVerb(adminPage, "e2e wrong length", "كتب", "form-1q");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/new-entry/);
    await expect(adminPage.getByText(/exactly 4 letters|exactly 4 radicals/i).first()).toBeVisible();
  });

  test("a geminate verb lists the alternative forms under the form of its cell", async ({ adminPage, db }) => {
    await removeEntries(db, GEMINATE_TEXT);
    await startVerb(adminPage, GEMINATE_TEXT, "مدد", "form-1-a-u");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    const active = adminPage.getByRole("region", { name: /^Active voice conjugation of/ });
    const lists = active.getByRole("list", { name: "Alternative forms" });
    expect(await lists.count()).toBeGreaterThan(0);
    const text = nfc((await lists.allInnerTexts()).join(" "));
    expect(text).toContain(nfc("يَمُدِّ"));
    expect(text).not.toContain(nfc("يُمَدِّ"));

    const passive = adminPage.getByRole("region", { name: /^Passive voice conjugation of/ });
    const passiveLists = passive.getByRole("list", { name: "Alternative forms" });
    expect(await passiveLists.count()).toBeGreaterThan(0);
    const passiveText = nfc((await passiveLists.allInnerTexts()).join(" "));
    expect(passiveText).toContain(nfc("يُمَدِّ"));
    expect(passiveText).toContain(nfc("يُمْدَدْ"));
    expect(passiveText).not.toContain(nfc("يَمُدِّ"));

    await removeEntries(db, GEMINATE_TEXT);
  });

  test("a four-radical geminate verb lists the other spellings of its jussive", async ({ adminPage, db }) => {
    await removeEntries(db, FOUR_RADICAL_GEMINATE_TEXT);
    await startVerb(adminPage, FOUR_RADICAL_GEMINATE_TEXT, "قشعر", "form-4q");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    const active = adminPage.getByRole("region", { name: /^Active voice conjugation of/ });
    const lists = active.getByRole("list", { name: "Alternative forms" });
    expect(await lists.count()).toBeGreaterThan(0);
    const text = nfc((await lists.allInnerTexts()).join(" "));
    expect(text).toContain(nfc("يَقْشَعِرِّ"));
    expect(text).toContain(nfc("يَقْشَعْرِرْ"));

    await removeEntries(db, FOUR_RADICAL_GEMINATE_TEXT);
  });

  test("a reduplicated four-radical verb lists its second verbal noun under the first", async ({ adminPage, db }) => {
    await removeEntries(db, REDUPLICATED_TEXT);
    await startVerb(adminPage, REDUPLICATED_TEXT, "زلزل", "form-1q");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    const caption = adminPage.getByRole("row", { name: /verbal noun/ });
    await expect(caption).toBeVisible();
    const text = nfc(await caption.innerText());
    expect(text).toContain(nfc("زَلْزَلَة"));
    expect(text).toContain(nfc("زِلْزَال"));
    await expect(caption.getByRole("list", { name: "Alternative forms" })).toHaveCount(1);
    await expect(adminPage.getByRole("row", { name: /participle/ }).getByRole("list")).toHaveCount(0);

    await removeEntries(db, REDUPLICATED_TEXT);
  });

  test("a verb without alternatives shows no alternative lists", async ({ adminPage, db }) => {
    const text = "e2e كَتَبَ plain";
    await removeEntries(db, text);
    await startVerb(adminPage, text, "كتب", "form-1-a-u");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    await expect(adminPage.getByRole("region", { name: /^Active voice conjugation of/ })).toBeVisible();
    await expect(adminPage.getByRole("list", { name: "Alternative forms" })).toHaveCount(0);
    await removeEntries(db, text);
  });
});
