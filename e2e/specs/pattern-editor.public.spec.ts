import { expect, test } from "../support/fixtures.ts";
import { alerts } from "../support/ui.ts";

const BACKSLASH = "\\";
const FA = "ف";

test.describe("pattern template editor (no changes saved)", () => {
  test("stored placeholders are displayed as the letters ف ع ل and the legend describes the fields", async ({
    adminPage,
    seed,
    db,
  }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    const stored = await db.scalar<string>("SELECT rules->>'masdar' FROM morph_pattern WHERE id = $1", [
      seed.patterns.editor ?? 0,
    ]);
    expect(stored).toBe("{1}\u064E{2}\u0652{3}");
    const masdar = adminPage.locator("#rules-masdar");
    await expect(masdar).toHaveValue("ف\u064Eع\u0652ل");
    await expect(masdar).toHaveAttribute("aria-describedby", "rules-template-help");
    await expect(adminPage.locator("#rules-template-help")).toContainText("put a backslash in front of it");
    await expect(adminPage.getByRole("textbox", { name: "Imperfect stem template" })).toHaveAttribute(
      "aria-describedby",
      "rules-template-help",
    );
  });

  test("a backslash before ف stays while typing and later letters become placeholders", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    const masdar = adminPage.locator("#rules-masdar");
    await masdar.fill("");
    await masdar.pressSequentially(BACKSLASH);
    await expect(masdar).toHaveValue(BACKSLASH);
    await masdar.pressSequentially(`${FA}َ`);
    await expect(masdar).toHaveValue(`${BACKSLASH}${FA}َ`);
    await masdar.pressSequentially("عْل");
    await expect(masdar).toHaveValue(`${BACKSLASH}${FA}َعْل`);
  });

  test("an unknown placeholder is explained and not saved", async ({ adminPage, seed, db }) => {
    const readStored = () =>
      db.scalar<string>("SELECT rules->>'masdar' FROM morph_pattern WHERE id = $1", [seed.patterns.editor ?? 0]);
    const before = await readStored();
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    await adminPage.locator("#rules-masdar").fill("{4}");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(alerts(adminPage).filter({ hasText: 'Unknown placeholder "{4}"' })).toBeVisible();
    await expect(adminPage).toHaveURL(/\/edit$/);
    expect(await readStored()).toBe(before);
  });

  test("a stray brace is explained", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    await adminPage.locator("#rules-masdar").fill("{ف");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(alerts(adminPage).filter({ hasText: "Unmatched brace in the template" })).toBeVisible();
  });
});

test.describe("pattern preview", () => {
  test("the preview renders a paradigm whose Arabic cells carry lang=ar", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.inUse}`);
    await expect(adminPage.getByLabel("Sample root")).toHaveValue("كتب");
    await adminPage.getByRole("button", { name: "Generate preview" }).click();

    const table = adminPage.getByRole("table", { name: "Conjugation preview for the sample root" });
    await expect(table).toBeVisible();
    const region = adminPage.getByRole("region", { name: "Conjugation preview for the sample root" });
    await expect(region).toHaveAttribute("tabindex", "0");
    await expect(region.getByRole("table")).toBeVisible();
    await expect(adminPage.getByText("Masdar:")).toBeVisible();
    await expect(adminPage.locator('[lang="ar"]', { hasText: "كَتْب" }).first()).toBeVisible();

    const cells = table.locator("tbody td");
    const filled = await cells.evaluateAll((nodes) =>
      nodes
        .filter((node) => (node.textContent ?? "").trim() !== "")
        .map((node) => node.querySelector('[lang="ar"]') !== null),
    );
    expect(filled.length).toBeGreaterThan(30);
    expect(filled.every(Boolean)).toBe(true);
    await expect(table.locator("tbody td").filter({ hasText: "كَتَبَ" }).first()).toBeVisible();
    await expect(table.locator("tbody td").filter({ hasText: "يَكْتُبُ" }).first()).toBeVisible();
  });

  test("the preview uses the edited, unsaved template", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.editor}/edit`);
    await adminPage.locator("#rules-masdar").fill("مَفْعَلَة");
    await adminPage.getByRole("button", { name: "Generate preview" }).click();
    await expect(adminPage.getByText("Masdar:")).toContainText("مَكْتَبَة");
  });

  test("an invalid sample root is explained", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.inUse}`);
    await adminPage.getByLabel("Sample root").fill("ك");
    await adminPage.getByRole("button", { name: "Generate preview" }).click();
    await expect(alerts(adminPage).filter({ hasText: "Root must have exactly 3 letters" })).toBeVisible();
    await expect(adminPage.getByText("Masdar:")).toHaveCount(0);
  });

  test("a spaced sample root is accepted", async ({ adminPage, seed }) => {
    await adminPage.goto(`/admin/morph-patterns/${seed.patterns.inUse}`);
    await adminPage.getByLabel("Sample root").fill("ك ت ب");
    await adminPage.getByRole("button", { name: "Generate preview" }).click();
    await expect(adminPage.getByText("Masdar:")).toBeVisible();
  });
});

test.describe("pattern radical kinds (no changes saved)", () => {
  test("Radical 4 can be weak only for four radicals and offers sound, waw and ya", async ({ adminPage }) => {
    await adminPage.goto("/admin/morph-patterns/new");
    const fourth = adminPage.locator("#radical4Kind");
    await expect(fourth).toBeDisabled();
    await expect(fourth).toHaveValue("sound");

    await adminPage.locator("#radicalCount").selectOption("4");
    await expect(fourth).toBeEnabled();
    await expect(fourth.locator("option")).toHaveText(["Sound", "Weak — و", "Weak — ي"]);
    await fourth.selectOption("ya");
    await expect(fourth).toHaveValue("ya");

    await adminPage.locator("#radicalCount").selectOption("3");
    await expect(fourth).toBeDisabled();
    await expect(fourth).toHaveValue("sound");
  });

  test("switching a triliteral pattern to four radicals and back keeps its radical kinds", async ({
    adminPage,
    db,
  }) => {
    const id = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f1-a-a-final-weak-hamzated-middle'");
    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    const radicalCount = adminPage.locator("#radicalCount");
    const second = adminPage.locator("#radical2Kind");
    const third = adminPage.locator("#radical3Kind");
    await expect(second).toHaveValue("hamza");
    await expect(third).toHaveValue("ya");

    await radicalCount.selectOption("4");
    for (const radical of [adminPage.locator("#radical1Kind"), second, third]) {
      await expect(radical).toBeDisabled();
      await expect(radical).toHaveValue("sound");
    }

    await radicalCount.selectOption("3");
    await expect(second).toBeEnabled();
    await expect(second).toHaveValue("hamza");
    await expect(third).toHaveValue("ya");
    await expect(adminPage.locator("#formNumber")).toHaveValue("1");
    await expect(adminPage.locator("#perfectVowel")).toHaveValue("a");
    await expect(adminPage.locator("#imperfectVowel")).toHaveValue("a");
  });

  test("switching a geminate pattern to four radicals and back keeps it geminate", async ({ adminPage, db }) => {
    const id = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f1-a-i-geminate'");
    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    const geminate = adminPage.getByLabel("Geminate (doubled root)");
    await expect(geminate).toBeChecked();

    await adminPage.locator("#radicalCount").selectOption("4");
    await expect(geminate).not.toBeChecked();

    await adminPage.locator("#radicalCount").selectOption("3");
    await expect(geminate).toBeChecked();
  });

  test("switching a form V pattern to four radicals and back keeps its form", async ({ adminPage, db }) => {
    const id = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f5'");
    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    const form = adminPage.locator("#formNumber");
    await expect(form).toHaveValue("5");

    await adminPage.locator("#radicalCount").selectOption("4");
    await expect(form).toHaveValue("1");
    await expect(adminPage.locator("#perfectVowel")).toHaveValue("a");

    await adminPage.locator("#radicalCount").selectOption("3");
    await expect(form).toHaveValue("5");
    await expect(adminPage.locator("#perfectVowel")).toHaveValue("");
    await expect(adminPage.locator("#imperfectVowel")).toHaveValue("");
  });

  test("switching a final-weak quadriliteral pattern to three radicals and back keeps its last radical", async ({
    adminPage,
    db,
  }) => {
    const id = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f3-quadriliteral-final-weak'");
    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    const fourth = adminPage.locator("#radical4Kind");
    await expect(fourth).toHaveValue("ya");

    await adminPage.locator("#radicalCount").selectOption("3");
    await expect(fourth).toBeDisabled();
    await expect(fourth).toHaveValue("sound");

    await adminPage.locator("#radicalCount").selectOption("4");
    await expect(fourth).toBeEnabled();
    await expect(fourth).toHaveValue("ya");
  });

  test("the final-weak quadriliteral pattern shows its last radical in the editor and on its page", async ({
    adminPage,
    db,
  }) => {
    const id = await db.scalar<number>("SELECT id FROM morph_pattern WHERE code = 'f3-quadriliteral-final-weak'");
    await adminPage.goto(`/admin/morph-patterns/${id}`);
    await expect(adminPage.getByText("four radicals, last radical ya")).toBeVisible();

    await adminPage.goto(`/admin/morph-patterns/${id}/edit`);
    await expect(adminPage.locator("#radicalCount")).toHaveValue("4");
    await expect(adminPage.locator("#radical4Kind")).toHaveValue("ya");
    await expect(adminPage.locator("#radical4Kind")).toBeEnabled();
    await expect(adminPage.locator("#radical1Kind")).toBeDisabled();
  });
});
