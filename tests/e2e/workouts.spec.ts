import { expect, test } from "@playwright/test";
import { createProgramFromTemplate, enterCodeAndCommit, eventCounts } from "./helpers";

/** Play every exercise of the open player to the end and answer the feel question. */
async function finishAll(p: import("@playwright/test").Page) {
  for (let i = 0; i < 8; i++) {
    const cont = p.getByRole("button", { name: /Continue to exercise/ });
    if (!(await cont.isVisible())) break;
    await cont.click();
    await p.getByRole("button", { name: /Done, (next exercise|finish session)/ }).click();
  }
  await expect(p.getByRole("heading", { level: 1, name: "How did movement feel?" })).toBeVisible();
  await p.getByText("Same", { exact: true }).click();
}

test("no code: Today -> find your starting point (3 taps) -> follow-along workout -> counted on the device", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Two ways to start" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick workouts" })).toBeVisible();
  await page.getByRole("link", { name: /Find your starting point/ }).click();

  await expect(page.getByRole("heading", { level: 2, name: "What would you like to work on?" })).toBeVisible();
  await page.getByRole("button", { name: /Balance/ }).click();
  await page.getByRole("button", { name: /Standing at the board/ }).click();
  await page.getByRole("button", { name: /About 5 minutes/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your starting point" })).toBeVisible();
  await expect(page.getByText("Then keep going with a plan")).toBeVisible();

  await page.getByRole("link", { name: /Start this workout/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Set up your board." })).toBeVisible();
  await expect(page.getByText("Suggested anchor.")).toBeVisible();
  await finishAll(page);
  await expect(page.getByRole("heading", { name: "Workout saved." })).toBeVisible();

  await page.getByRole("button", { name: "Back to Today" }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.getByText("1 session")).toBeVisible();

  await page.goto("/app/progress");
  await expect(page.getByText("Minutes moved")).toBeVisible();
});

test("library filters: seated shows only seated workouts, clear filters restores all", async ({ page }) => {
  await page.goto("/app/workouts");
  const all = Number((await page.getByRole("status").textContent())?.match(/\d+/)?.[0]);
  expect(all).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Seated", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/^1 workout/);
  await expect(page.getByRole("link", { name: /Seated reach and row/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toContainText(`${all} workouts`);
  await page.getByRole("button", { name: "Under 5 min" }).click();
  await expect(page.getByRole("link", { name: /Band basics/ })).toHaveCount(0);
});

test("a workout never replaces the therapist session in progress and sends nothing to the clinic", async ({ page, browser }) => {
  const code = await createProgramFromTemplate(page, "Workout side by side");
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await enterCodeAndCommit(p, code);

  // One plan exercise done, then leave mid-session.
  await p.getByRole("link", { name: /Start session/ }).click();
  await p.getByRole("button", { name: /Continue to exercise/ }).click();
  await p.getByRole("button", { name: /Done, next exercise/ }).click();
  await expect.poll(() => eventCounts(page, code)).toEqual({ done: 1, skipped: 0, made_easier: 0 });

  // A whole workout in between.
  await p.goto("/app/play/steady-at-the-rails");
  await finishAll(p);
  await expect(p.getByRole("heading", { name: "Workout saved." })).toBeVisible();
  await p.getByRole("button", { name: "Back to Today" }).click();
  await p.waitForURL(/\/app$/);

  // The plan session is still waiting, the plan count is untouched, the workout shows beside it.
  await expect(p.getByRole("link", { name: /Resume session/ })).toBeVisible();
  await expect(p.getByText(/0 of 3 — your plan\./)).toBeVisible();
  await expect(p.getByText("Plus 1 workout on your own this week.")).toBeVisible();
  // Nothing from the workout reached the clinic.
  await expect.poll(() => eventCounts(page, code)).toEqual({ done: 1, skipped: 0, made_easier: 0 });
  await phone.close();
});
