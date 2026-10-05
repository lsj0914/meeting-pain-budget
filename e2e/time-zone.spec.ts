import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ledger")).toBeVisible();
});

test("replaces a filled participant time zone directly from the complete dropdown", async ({
  page,
}) => {
  const person = page.locator('[data-person="ny"]');
  const input = person.locator('[data-field="zone"]');
  await person
    .getByRole("button", { name: "Open time zones", exact: true })
    .click();
  await expect(input).toHaveValue("America/New_York");
  await expect(page.getByTestId("ledger")).toBeVisible();
  await expect(person.getByRole("option")).toHaveCount(
    await page.evaluate(() => Intl.supportedValuesOf("timeZone").length + 1),
  );
  await person.getByRole("option", { name: "Asia/Tokyo", exact: true }).click();
  await expect(input).toHaveValue("Asia/Tokyo");
  await expect(person.getByRole("listbox")).toBeHidden();
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-person="ny"] [data-field="zone"]'),
  ).toHaveValue("Asia/Tokyo");
});

test("replaces the filled reference time zone without clearing it first", async ({
  page,
}) => {
  const picker = page
    .locator(".zone-picker")
    .filter({ has: page.locator('[data-field="referenceZone"]') });
  await picker
    .getByRole("button", { name: "Open time zones", exact: true })
    .click();
  await picker.getByRole("option", { name: "UTC", exact: true }).click();
  await expect(page.locator('[data-field="referenceZone"]')).toHaveValue("UTC");
  await expect(page.getByTestId("schedule").locator("caption")).toContainText(
    "UTC",
  );
});

test("can search by typing immediately after opening a filled dropdown", async ({
  page,
}) => {
  const person = page.locator('[data-person="ny"]');
  await person
    .getByRole("button", { name: "Open time zones", exact: true })
    .click();
  await person.locator('[data-field="zone"]').pressSequentially("Tokyo");
  await expect(person.getByRole("option")).toHaveCount(1);
  await person.getByRole("option", { name: "Asia/Tokyo", exact: true }).click();
  await expect(person.locator('[data-field="zone"]')).toHaveValue("Asia/Tokyo");
  await expect(page.getByTestId("ledger")).toBeVisible();
});

test("supports keyboard selection and Escape preserves the previous value", async ({
  page,
}) => {
  const input = page.locator('[data-person="ny"] [data-field="zone"]');
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Escape");
  await expect(input).toHaveValue("America/New_York");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.fill("Tokyo");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("Asia/Tokyo");
  await expect(page.getByTestId("ledger")).toBeVisible();
});

test("the open dropdown has no serious accessibility issues or page overflow", async ({
  page,
}) => {
  await page
    .locator('[data-person="ny"]')
    .getByRole("button", { name: "Open time zones", exact: true })
    .click();
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
