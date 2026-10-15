import type { Page } from "@playwright/test";
import { WORDS } from "../support/data.ts";
import { createArabicVerb, createEnglishEntry, entryExists, removeEntries } from "../support/entries.ts";
import { expect, test } from "../support/fixtures.ts";
import { alerts } from "../support/ui.ts";
import { entryUrl } from "../support/urls.ts";

const MINIFIED_REACT_ERROR = /Minified React error/;
const ACTIVE_ROWS = 57;
const PASSIVE_ROWS = 52;

const addSense = async (page: Page, pos: string, definitions: string): Promise<void> => {
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByLabel("Part of Speech").selectOption(pos);
  await page.getByLabel("Definitions (one per line)").fill(definitions);
};

const pickTranslationTarget = async (page: Page, index: number, query: string, label: string): Promise<void> => {
  const picker = page.locator(`#translation-target-0-${index}`);
  await picker.fill(query);
  await page.getByRole("option", { name: label }).first().click();
  await expect(page.locator(`#translation-target-0-${index}-selected`)).toContainText("Selected:");
};

test.describe("creating entries", () => {
  test("an English entry with a translation is created and linked on the public pages", async ({
    adminPage,
    db,
    seed,
  }) => {
    await removeEntries(db, "e2e chair");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e chair");
    await addSense(adminPage, "noun", "a seat for one person");
    await adminPage.getByRole("button", { name: "+ Add Translation" }).click();
    await pickTranslationTarget(adminPage, 0, "كتاب", `${WORDS.kitab.text} (Noun)`);
    await adminPage.getByLabel("Domain (optional)").fill("furniture");
    await adminPage.getByLabel("Verified").check();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();

    await expect(adminPage).toHaveURL(/\/entry\/e2e-chair$/);
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText("e2e chair");
    const link = adminPage.getByRole("link", { name: WORDS.kitab.text });
    await expect(link).toHaveAttribute("href", `${entryUrl(seed.slugs.kitab ?? "")}#sense-${seed.senses.kitab}`);
    await expect(adminPage.getByText("(furniture)")).toBeVisible();

    const stored = await db.rows<{ ar_sense_id: number; domain: string | null }>(
      `SELECT tl.ar_sense_id, tl.domain
       FROM translation_link tl JOIN sense s ON s.id = tl.en_sense_id JOIN lexical_entry e ON e.id = s.lexical_entry_id
       WHERE e.text = 'e2e chair'`,
    );
    expect(stored).toEqual([{ ar_sense_id: seed.senses.kitab, domain: "furniture" }]);

    await adminPage.goto(entryUrl(seed.slugs.kitab ?? ""));
    await expect(adminPage.getByRole("link", { name: "e2e chair" })).toBeVisible();
  });

  test("an unverified entry is created without a public page and opens in the admin preview", async ({
    adminPage,
    db,
    request,
  }) => {
    await removeEntries(db, "e2e private note");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e private note");
    await addSense(adminPage, "noun", "kept out of the public site");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries\/\d+$/);
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText("e2e private note");
    await expect(adminPage.getByText("Unverified", { exact: true })).toBeVisible();
    expect((await request.get("/entry/e2e-private-note")).status()).toBe(404);
  });

  test("a duplicate entry shows a readable message and not a minified React error", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("book");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(alerts(adminPage)).toHaveText("An entry with this language and text already exists");
    await expect(alerts(adminPage)).toBeFocused();
    await expect(adminPage.locator("body")).not.toContainText(MINIFIED_REACT_ERROR);
    await expect(adminPage).toHaveURL(/\/admin\/new-entry$/);
  });

  test("an empty translation target shows an inline error and focuses the field", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e incomplete");
    await addSense(adminPage, "noun", "never saved");
    await adminPage.getByRole("button", { name: "+ Add Translation" }).click();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();

    const picker = adminPage.locator("#translation-target-0-0");
    await expect(adminPage.locator("#translation-target-0-0-error")).toHaveText("Choose a target sense.");
    await expect(picker).toBeFocused();
    await expect(picker).toHaveAttribute("aria-invalid", "true");
    await expect(picker).toHaveAttribute("aria-describedby", /translation-target-0-0-error/);
    await expect(adminPage).toHaveURL(/\/admin\/new-entry$/);
  });

  test("an empty relation target shows an inline error and focuses the field", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e incomplete relation");
    await addSense(adminPage, "noun", "never saved");
    await adminPage.getByRole("button", { name: "+ Add Relation" }).click();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage.locator("#relation-target-0-0-error")).toHaveText("Choose a target sense.");
    await expect(adminPage.locator("#relation-target-0-0")).toBeFocused();
  });

  test("a required field left empty is explained and focused", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage.locator("#text-error")).toHaveText("Text is required");
    await expect(adminPage.getByLabel("Text", { exact: true })).toBeFocused();
  });

  test("choosing a translation target does not trigger a new search for its own label", async ({ adminPage }) => {
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Text", { exact: true }).fill("e2e picker");
    await addSense(adminPage, "noun", "picker behaviour");
    await adminPage.getByRole("button", { name: "+ Add Translation" }).click();
    const queries: string[] = [];
    adminPage.on("request", (request) => {
      if (request.url().includes("/api/senses/search")) {
        queries.push(new URL(request.url()).searchParams.get("query") ?? "");
      }
    });
    await pickTranslationTarget(adminPage, 0, "كتاب", `${WORDS.kitab.text} (Noun)`);
    await expect(adminPage.locator("#translation-target-0-0")).toHaveValue("");

    const marker = adminPage.waitForResponse((response) => response.url().includes("query=zzzzmarker"));
    await adminPage.locator("#translation-target-0-0").fill("zzzzmarker");
    await marker;
    await expect(adminPage.getByText("No matching senses found.")).toBeVisible();
    expect(queries).toEqual(["كتاب", "zzzzmarker"]);
  });
});

test.describe("saving existing entries", () => {
  test("a no-op save keeps both translation links with their ranks and notes", async ({ adminPage, db, seed }) => {
    const readLinks = () =>
      db.rows<{ id: number; ar_sense_id: number; frequency_rank: number; domain: string | null; note: string | null }>(
        `SELECT id, ar_sense_id, frequency_rank, domain, note FROM translation_link WHERE en_sense_id = $1 ORDER BY id`,
        [seed.senses.book ?? 0],
      );
    const before = await readLinks();
    expect(before).toHaveLength(2);
    expect(before.map((link) => link.frequency_rank).sort()).toEqual([2, 5]);

    await adminPage.goto(`/admin/edit-entry/${seed.entries.book}`);
    await expect(adminPage.getByText("Translation 1")).toBeVisible();
    await expect(adminPage.getByText("Translation 2")).toBeVisible();
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\/book$/);

    expect(await readLinks()).toEqual(before);
    await expect(adminPage.getByRole("link", { name: WORDS.kitab.text })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: WORDS.kuttab.text })).toBeVisible();
  });

  test("removing one translation row in the form deletes only that link", async ({ adminPage, db }) => {
    const entry = await createEnglishEntry(db, { text: "e2e two links" });
    const kitab = await db.scalar<number>(
      "SELECT s.id FROM sense s JOIN lexical_entry e ON e.id = s.lexical_entry_id WHERE e.text = $1",
      [WORDS.kitab.text],
    );
    const kuttab = await db.scalar<number>(
      "SELECT s.id FROM sense s JOIN lexical_entry e ON e.id = s.lexical_entry_id WHERE e.text = $1",
      [WORDS.kuttab.text],
    );
    await db.exec(
      "INSERT INTO translation_link (en_sense_id, ar_sense_id, frequency_rank) VALUES ($1, $2, 3), ($1, $3, 7)",
      [entry.senseId, kitab, kuttab],
    );

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await expect(adminPage.getByText("Translation 2")).toBeVisible();
    await adminPage
      .getByRole("group", { name: /Translation 1/ })
      .getByRole("button", { name: "Remove" })
      .click();
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\/e2e-two-links$/);

    const left = await db.rows<{ ar_sense_id: number; frequency_rank: number }>(
      "SELECT ar_sense_id, frequency_rank FROM translation_link WHERE en_sense_id = $1",
      [entry.senseId],
    );
    expect(left).toEqual([{ ar_sense_id: kuttab, frequency_rank: 7 }]);
  });
});

test.describe("Arabic verb entries", () => {
  test("participle overrides change the stored participles and clearing them restores the generated ones", async ({
    adminPage,
    db,
  }) => {
    const entry = await createArabicVerb(db, {
      text: "فَتَحَ",
      root: "فتح",
      perfectVowel: "a",
      imperfectVowel: "a",
    });
    const participles = () =>
      db.one<{ active: string; passive: string }>(
        "SELECT active_participle AS active, passive_participle AS passive FROM lexical_entry WHERE id = $1",
        [entry.id],
      );
    const generated = await participles();
    expect(generated.active.normalize("NFC")).toBe("فَاتِح".normalize("NFC"));
    expect(generated.passive.normalize("NFC")).toBe("مَفْتُوح".normalize("NFC"));

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    const active = adminPage.locator("#active_participle_override");
    const passive = adminPage.locator("#passive_participle_override");
    await expect(active).toHaveAttribute("aria-describedby", "active_participle_override-hint");
    await active.fill("  فَاتِحٌ ");
    await passive.fill("مَفْتُوحٌ");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await participles()).toEqual({ active: "فَاتِحٌ", passive: "مَفْتُوحٌ" });

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await expect(active).toHaveValue("فَاتِحٌ");
    await active.fill("");
    await passive.fill("");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await participles()).toEqual(generated);
  });

  test("No passive voice drops the passive rows and the passive participle, and clearing it brings them back", async ({
    adminPage,
    db,
    request,
  }) => {
    const entry = await createArabicVerb(db, { text: "فَتَحَ", root: "فتح", perfectVowel: "a", imperfectVowel: "a" });
    const stored = () =>
      db.one<{ passive_rows: number; active_rows: number; passive_participle: string | null }>(
        `SELECT (SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = $1 AND voice = 'passive') AS passive_rows,
                (SELECT count(*)::int FROM conjugation WHERE lexical_entry_id = $1 AND voice = 'active') AS active_rows,
                passive_participle
         FROM lexical_entry WHERE id = $1`,
        [entry.id],
      );
    const publicPage = async () => (await request.get(entryUrl(entry.slug))).text();

    const generated = await stored();
    expect(generated.passive_rows).toBe(PASSIVE_ROWS);
    expect(generated.active_rows).toBe(ACTIVE_ROWS);
    expect(generated.passive_participle?.normalize("NFC")).toBe("مَفْتُوح".normalize("NFC"));
    expect(await publicPage()).toContain("Passive voice conjugation of");

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    const box = adminPage.getByLabel("No passive voice");
    await expect(box).not.toBeChecked();
    await expect(box).toHaveAccessibleDescription(/no passive conjugation and no passive participle/);
    await box.check();
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await stored()).toEqual({ passive_rows: 0, active_rows: ACTIVE_ROWS, passive_participle: null });
    const without = await publicPage();
    expect(without).not.toContain("Passive voice conjugation of");
    expect(without).toContain("Active voice conjugation of");

    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await expect(box).toBeChecked();
    await box.uncheck();
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\//);
    expect(await stored()).toEqual(generated);
    expect(await publicPage()).toContain("Passive voice conjugation of");
  });

  test("a Latin participle override is rejected inline and the field is focused", async ({ adminPage, db }) => {
    const entry = await createArabicVerb(db, { text: "فَتَحَ", root: "فتح", perfectVowel: "a", imperfectVowel: "a" });
    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await adminPage.locator("#active_participle_override").fill("opener");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage.locator("#active_participle_override-error")).toContainText("Arabic script");
    await expect(adminPage.locator("#active_participle_override")).toBeFocused();
  });

  test("a root with spaces is stored clean and resolves a pattern", async ({ adminPage, db }) => {
    await removeEntries(db, "نَصَرَ");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Language").selectOption("ar");
    await adminPage.getByLabel("Text", { exact: true }).fill("نَصَرَ");
    await adminPage.getByLabel("Root (Arabic)").fill(" ن ص ر ");
    await addSense(adminPage, "verb", "to help");
    await adminPage.getByLabel("Verb form").selectOption("form-1-a-u");
    await expect(adminPage.getByText(/pattern found/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries\/\d+$/);

    const stored = await db.one<{ root: string; has_pattern: boolean; masdar: string | null }>(
      "SELECT root, morph_pattern_id IS NOT NULL AS has_pattern, masdar FROM lexical_entry WHERE text = 'نَصَرَ'",
    );
    expect(stored.root).toBe("نصر");
    expect(stored.has_pattern).toBe(true);
    expect(stored.masdar?.normalize("NFC")).toBe("نَصْر".normalize("NFC"));
    await expect(adminPage.getByRole("region", { name: /Active voice conjugation of/ })).toBeVisible();
  });

  test("a four letter verb root is rejected by the form and nothing is saved", async ({ adminPage, db }) => {
    await removeEntries(db, "تَرْجَمَ");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Language").selectOption("ar");
    await adminPage.getByLabel("Text", { exact: true }).fill("تَرْجَمَ");
    await adminPage.getByLabel("Root (Arabic)").fill("ترجم");
    await addSense(adminPage, "verb", "to translate");
    await adminPage.getByLabel("Verb form").selectOption("form-1-a-u");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(adminPage.locator("#root-error")).toHaveText("A verb root must have exactly 3 letters");
    await expect(adminPage.locator("#root")).toBeFocused();
    expect(await db.scalar<number>("SELECT count(*)::int FROM lexical_entry WHERE text = 'تَرْجَمَ'")).toBe(0);
  });

  test("a verb root with no pattern for the chosen form explains why it cannot be saved", async ({ adminPage, db }) => {
    await removeEntries(db, "أَكَلَ");
    await adminPage.goto("/admin/new-entry");
    await adminPage.getByLabel("Language").selectOption("ar");
    await adminPage.getByLabel("Text", { exact: true }).fill("أَكَلَ");
    await adminPage.getByLabel("Root (Arabic)").fill("أكل");
    await addSense(adminPage, "verb", "to eat");
    await adminPage.getByLabel("Verb form").selectOption("form-9");
    await adminPage.getByRole("button", { name: "Create Entry" }).click();
    await expect(alerts(adminPage)).toHaveText(/^No morphological pattern is available yet for root/);
    await expect(adminPage.locator("body")).not.toContainText(MINIFIED_REACT_ERROR);
  });
});

test.describe("context tags", () => {
  test("tags are added and removed from the keyboard and shown on the public page", async ({ adminPage, db }) => {
    const entry = await createEnglishEntry(db, { text: "e2e tagged entry" });
    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    const input = adminPage.locator("#sense-0-tags");
    const chips = adminPage.getByRole("list", { name: "Context tags added" }).getByRole("listitem");

    await input.pressSequentially("legal,");
    await input.pressSequentially("Formal");
    await adminPage.keyboard.press("Enter");
    await input.pressSequentially("LEGAL");
    await adminPage.keyboard.press("Enter");
    await input.pressSequentially("قانوني، رسمي");
    await input.blur();
    await expect(chips).toHaveText(["legal×", "Formal×", "قانوني×", "رسمي×"].map((value) => value));
    await expect(adminPage).toHaveURL(/\/edit-entry\/\d+$/);

    const removeButtons = adminPage.getByRole("button", { name: /^Remove tag/ });
    await expect(removeButtons).toHaveCount(4);
    await adminPage.getByRole("button", { name: "Remove tag رسمي" }).focus();
    await adminPage.keyboard.press("Enter");
    await expect(removeButtons).toHaveCount(3);
    await expect(input).toBeFocused();
    await expect(adminPage.getByRole("status").filter({ hasText: "Removed رسمي" })).toBeAttached();

    await input.pressSequentially("x".repeat(45));
    await adminPage.keyboard.press("Enter");
    await expect(adminPage.locator("#sense-0-tags-error")).toContainText("at most 40");
    await input.fill("");

    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\/e2e-tagged-entry$/);

    expect(
      await db.scalar<string>("SELECT array_to_string(context_tags, ',') FROM sense WHERE id = $1", [entry.senseId]),
    ).toBe("legal,Formal,قانوني");
    const shown = adminPage.getByRole("list", { name: "Context" }).getByRole("listitem");
    await expect(shown).toHaveText(["legal", "Formal", "قانوني"]);
    await expect(adminPage.getByRole("list", { name: "Context" }).locator('li[lang="ar"]')).toHaveCount(1);
    await expect(adminPage.getByRole("list", { name: "Context" }).locator('li[lang="en"]')).toHaveCount(2);
  });

  test("saving other fields keeps the tags", async ({ adminPage, db }) => {
    const entry = await createEnglishEntry(db, { text: "e2e keeps tags" });
    await db.exec("UPDATE sense SET context_tags = ARRAY['legal', 'formal'] WHERE id = $1", [entry.senseId]);
    await adminPage.goto(`/admin/edit-entry/${entry.id}`);
    await adminPage.getByLabel("Definitions (one per line)").fill("changed definition");
    await adminPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(adminPage).toHaveURL(/\/entry\/e2e-keeps-tags$/);
    expect(
      await db.scalar<string>("SELECT array_to_string(context_tags, ',') FROM sense WHERE id = $1", [entry.senseId]),
    ).toBe("legal,formal");
  });
});

test.describe("deleting entries", () => {
  test("the delete page removes the entry after confirmation and its public page disappears at once", async ({
    adminPage,
    db,
    request,
  }) => {
    const entry = await createEnglishEntry(db, { text: "e2e delete me" });
    expect((await request.get("/entry/e2e-delete-me")).status()).toBe(200);
    await adminPage.goto(`/admin/delete-entry/${entry.id}`);
    await expect(adminPage.getByRole("heading", { level: 1, name: "Delete Entry" })).toBeVisible();
    await expect(adminPage.getByText("e2e delete me")).toBeVisible();
    await adminPage.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(adminPage).toHaveURL(/\/$/);
    expect(await entryExists(db, entry.id)).toBe(false);
    expect((await request.get("/entry/e2e-delete-me")).status()).toBe(404);
  });

  test("Cancel on the delete page keeps the entry", async ({ adminPage, db }) => {
    const entry = await createEnglishEntry(db, { text: "e2e keep me" });
    await adminPage.goto("/admin/entries");
    await adminPage.goto(`/admin/delete-entry/${entry.id}`);
    await adminPage.getByRole("button", { name: "Cancel" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/entries$/);
    expect(await entryExists(db, entry.id)).toBe(true);
  });

  test("a failed delete shows a message instead of crashing", async ({ adminPage, db }) => {
    const entry = await createEnglishEntry(db, { text: "e2e vanished" });
    await adminPage.goto(`/admin/delete-entry/${entry.id}`);
    await removeEntries(db, "e2e vanished");
    await adminPage.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(alerts(adminPage)).toHaveText(`Failed to delete lexical entry with id '${entry.id}'`);
    await expect(adminPage.locator("body")).not.toContainText(MINIFIED_REACT_ERROR);
    await expect(adminPage.getByRole("heading", { level: 1, name: "Delete Entry" })).toBeVisible();
  });
});

test.describe("bulk delete dialog", () => {
  test("the dialog focuses Cancel, traps focus, closes on Escape and returns focus to its trigger", async ({
    adminPage,
    db,
  }) => {
    await createEnglishEntry(db, { text: "e2e bulk focus" });
    await adminPage.goto("/admin/entries");
    await adminPage.getByRole("checkbox", { name: "Select e2e bulk focus" }).check();
    const trigger = adminPage.getByRole("button", { name: /Delete Selected/ });
    await expect(trigger).toHaveText("Delete Selected (1)");
    await trigger.focus();
    await trigger.click();

    const dialog = adminPage.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName("Delete Entry?");
    await expect(dialog).toHaveAccessibleDescription(/Are you sure you want to delete 1 Entry\?/);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    const insideDialog = () => adminPage.evaluate(() => document.activeElement?.closest("[role=alertdialog]") !== null);
    for (let press = 0; press < 5; press += 1) {
      await adminPage.keyboard.press("Tab");
      expect(await insideDialog()).toBe(true);
    }
    for (let press = 0; press < 3; press += 1) {
      await adminPage.keyboard.press("Shift+Tab");
      expect(await insideDialog()).toBe(true);
    }

    await adminPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(adminPage.getByRole("checkbox", { name: "Select e2e bulk focus" })).toBeChecked();
  });

  test("confirming removes the selected entries and nothing else", async ({ adminPage, db }) => {
    const gone = await createEnglishEntry(db, { text: "e2e bulk gone" });
    const stays = await createEnglishEntry(db, { text: "e2e bulk stays" });
    await adminPage.goto("/admin/entries");
    await adminPage.getByRole("checkbox", { name: "Select e2e bulk gone" }).check();
    await adminPage.getByRole("button", { name: /Delete Selected/ }).click();
    await adminPage.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(adminPage.getByRole("alertdialog")).toBeHidden();
    await expect(adminPage.getByRole("row", { name: /e2e bulk gone/ })).toHaveCount(0);
    await expect(adminPage.getByRole("row", { name: /e2e bulk stays/ })).toHaveCount(1);
    expect(await entryExists(db, gone.id)).toBe(false);
    expect(await entryExists(db, stays.id)).toBe(true);
  });

  test("a failed bulk delete shows the reason inside the dialog", async ({ adminPage, db }) => {
    await createEnglishEntry(db, { text: "e2e bulk vanished" });
    await adminPage.goto("/admin/entries");
    await adminPage.getByRole("checkbox", { name: "Select e2e bulk vanished" }).check();
    await removeEntries(db, "e2e bulk vanished");
    await adminPage.getByRole("button", { name: /Delete Selected/ }).click();
    const dialog = adminPage.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Failed to delete 1 lexical entry");
    await expect(dialog).toBeVisible();
  });

  test("deleting a pattern that is in use shows why in the dialog and keeps the pattern", async ({
    adminPage,
    db,
    seed,
  }) => {
    await adminPage.goto("/admin/morph-patterns");
    await adminPage.getByRole("checkbox", { name: "Select I a ~ u", exact: true }).check();
    await adminPage.getByRole("button", { name: /Delete Selected/ }).click();
    const dialog = adminPage.getByRole("alertdialog");
    await expect(dialog).toHaveAccessibleName("Delete Pattern?");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      `Cannot delete: pattern(s) ${seed.patterns.inUse} still referenced by entries or overrides`,
    );
    await expect(dialog).toBeVisible();
    expect(
      await db.scalar<number>("SELECT count(*)::int FROM morph_pattern WHERE id = $1", [seed.patterns.inUse ?? 0]),
    ).toBe(1);
  });
});
