import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("shows real local times, a fairness comparison and a complete ledger", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  await expect(page.getByTestId("worst-rotation")).toHaveText("50%");
  await expect(page.getByTestId("schedule").locator("tbody tr")).toHaveCount(4);
  await expect(page.getByTestId("day-ribbon")).toHaveCount(2);
});
test("language and example switching keep the calculator usable", async ({
  page,
}) => {
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "早起晚睡，也该轮着来。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "三城团队", exact: true }).click();
  await expect(page.getByTestId("ledger").locator(".ledger-row")).toHaveCount(
    3,
  );
});
test("invalid edits pause exports and preserve the last valid draft", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page.locator('[data-person="ny"] [data-field="name"]').fill("");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calendar .ics" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.locator('[data-person="ny"] [data-field="name"]'),
  ).toHaveValue("Alex");
});
test("can remove an invalid person before form validation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Three cities", exact: true }).click();
  await page.locator('[data-person="ldn"] [data-field="name"]').fill("");
  await page
    .locator('[data-person="ldn"]')
    .getByRole("button", { name: "Remove Sam" })
    .click();
  await expect(page.getByTestId("ledger").locator(".ledger-row")).toHaveCount(
    2,
  );
});
test("manual candidate selection does not rewrite the optimized series", async ({
  page,
}) => {
  await expect(page.getByTestId("schedule")).toBeVisible();
  const before = await page.getByTestId("schedule").innerText();
  await page.locator("[data-slot]").nth(1).click();
  await expect
    .poll(() => page.getByTestId("schedule").innerText())
    .toBe(before);
});
test("downloads an actual series calendar with four explicit events", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calendar .ics" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("meeting-pain-budget.ics");
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk;
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(content).toContain("DTSTART:");
  expect(content).not.toContain("RRULE:");
});
test("preserves a rejected draft until explicitly replaced", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "meeting-pain-budget:v1",
      '{"version":99,"keep":"me"}',
    ),
  );
  await page.reload();
  await expect(page.getByTestId("recovery")).toBeVisible();
  await page.getByRole("button", { name: "Three cities", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("meeting-pain-budget:v1")),
  ).toBe('{"version":99,"keep":"me"}');
  await page
    .getByRole("button", { name: "Replace saved draft", exact: true })
    .click();
  expect(
    JSON.parse(
      (await page.evaluate(() =>
        localStorage.getItem("meeting-pain-budget:v1"),
      ))!,
    ),
  ).toMatchObject({ version: 1 });
});
test("does not inject imported text into the DOM", async ({ page }) => {
  await page
    .locator('[data-person="ny"] [data-field="name"]')
    .fill("<img src=x onerror=alert(1)>");
  await expect(page.getByTestId("ledger")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("img")).toHaveCount(0);
});
test("has no serious accessibility issues or horizontal page overflow", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  const a = await new AxeBuilder({ page }).analyze();
  expect(
    a.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("exposes every feasible single-meeting time", async ({ page }) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page
    .getByRole("button", { name: "Show all 18 times", exact: true })
    .click();
  await expect(page.locator("[data-slot]")).toHaveCount(18);
});
test("rapid edits discard obsolete results and use the latest duration", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  const input = page.locator('[data-field="duration"]');
  await input.fill("180");
  await input.fill("15");
  await expect(page.getByTestId("ledger")).toBeVisible();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calendar .ics" }).click();
  const file = await d;
  const stream = await file.createReadStream();
  let s = "";
  for await (const chunk of stream!) s += chunk;
  const start = s.match(/DTSTART:(\d{8}T\d{6}Z)/)![1],
    end = s.match(/DTEND:(\d{8}T\d{6}Z)/)![1];
  const iso = (v: string) =>
    v.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      "$1-$2-$3T$4:$5:$6Z",
    );
  expect(Date.parse(iso(end)) - Date.parse(iso(start))).toBe(15 * 60000);
});
test("a protected weekend explains infeasibility and disables series exports", async ({
  page,
}) => {
  await page.locator('[data-field="date"]').fill("2026-10-24");
  await expect(
    page.getByRole("heading", {
      name: "No complete series fits these rules.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calendar .ics" }),
  ).toBeDisabled();
});
test("reimports a real downloaded setup", async ({ page }) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page.locator('[data-field="title"]').fill("My team");
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save setup .json" }).click();
  const file = await d;
  await page.getByRole("button", { name: "Three cities", exact: true }).click();
  await page
    .getByRole("button", { name: "Replace setup", exact: true })
    .click();
  await page.locator("#import-file").setInputFiles((await file.path())!);
  await expect(page.locator('[data-field="title"]')).toHaveValue("My team");
  await expect(page.getByTestId("ledger").locator(".ledger-row")).toHaveCount(
    2,
  );
});
test("renders normalized time zones with surrounding whitespace", async ({
  page,
}) => {
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page
    .locator('[data-person="ny"] [data-field="zone"]')
    .fill(" America/New_York ");
  await expect(page.getByTestId("ledger")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calendar .ics" }),
  ).toBeEnabled();
});
test("confirms replacing edited settings and preserves edits when canceled", async ({
  page,
}) => {
  await page.locator('[data-field="title"]').fill("My custom meeting");
  await page.getByRole("button", { name: "Three cities", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toHaveValue(
    "My custom meeting",
  );
  await page.getByRole("button", { name: "Three cities", exact: true }).click();
  await page
    .getByRole("button", { name: "Replace setup", exact: true })
    .click();
  await expect(page.getByTestId("ledger").locator(".ledger-row")).toHaveCount(
    3,
  );
});
test("import waits for confirmation before replacing edited settings", async ({
  page,
}) => {
  await page.locator('[data-field="title"]').fill("Keep this title");
  await page.locator("#import-file").setInputFiles("examples/night-shift.json");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toHaveValue(
    "Keep this title",
  );
});
test("switches to an accurately labeled rotation if a fixed wall time becomes impossible", async ({
  page,
}) => {
  const person = (id: string) => ({
    id,
    name: id,
    zone: "America/New_York",
    workStart: "09:00",
    workEnd: "10:00",
    sleepStart: "10:00",
    sleepEnd: "09:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    carriedPain: 0,
    budget: 8,
  });
  const c = {
    version: 1,
    title: "DST boundary",
    date: "2026-10-19",
    referenceZone: "UTC",
    duration: 60,
    occurrences: 2,
    protectSleep: true,
    protectDays: true,
    people: [person("A"), person("B")],
  };
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "dst.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(c)),
    });
  await expect(page.getByTestId("ledger")).toBeVisible();
  await page.getByRole("button", { name: "Fixed", exact: true }).click();
  await page.locator('[data-field="occurrences"]').fill("4");
  await expect(page.getByTestId("schedule")).toContainText("Rotating schedule");
  await expect(
    page.getByRole("button", { name: "Rotate", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("schedule")).toContainText("14:00");
});
