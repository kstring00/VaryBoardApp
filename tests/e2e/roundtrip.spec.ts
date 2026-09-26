import { expect, test } from "@playwright/test";
import { createProgramFromTemplate, enterCodeAndCommit, eventCounts } from "./helpers";

test("code -> habit anchor -> commitment -> session -> events -> adherence", async ({ page, browser }) => {
  const code = await createProgramFromTemplate(page, "Round trip plan");

  // The patient is on another phone: a fresh context with no clinician cookie.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await enterCodeAndCommit(p, code);

  await expect(p.getByText("Assigned by Test Clinician")).toBeVisible();
  await expect(p.getByText("Your therapist will see your progress at your next visit.")).toBeVisible();
  await expect(p.getByText(/0 of 3 — your plan\./)).toBeVisible();

  await p.getByRole("link", { name: /Start session/ }).click();
  await expect(p.getByRole("heading", { level: 1, name: "Set up your board." })).toBeVisible();
  await expect(p.getByText("Your saved anchor.")).toBeVisible();

  // 1: Make it easier swaps in the easier alternative (logs made_easier), then done.
  await p.getByRole("button", { name: /Continue to exercise/ }).click();
  await p.getByRole("button", { name: "Make it easier" }).click();
  await expect(p.getByRole("heading", { level: 1, name: /low wall walk/ })).toBeVisible();
  await p.getByRole("button", { name: /Done, next exercise/ }).click();
  // 2: the seated swap also logs made_easier.
  await p.getByRole("button", { name: /Continue to exercise/ }).click();
  await p.getByRole("button", { name: "Use the seated version" }).click();
  await expect(p.getByRole("heading", { level: 1, name: /seated wall walk/ })).toBeVisible();
  await p.getByRole("button", { name: /Done, next exercise/ }).click();
  // 3: skipped (not marked complete).
  await p.getByRole("button", { name: "Skip today" }).click();
  // 4: done.
  await p.getByRole("button", { name: /Continue to exercise/ }).click();
  await p.getByRole("button", { name: /Done, finish session/ }).click();
  await p.getByText("Easier", { exact: true }).click();
  await expect(p.getByRole("heading", { name: "Session saved." })).toBeVisible();

  await expect.poll(() => eventCounts(page, code)).toEqual({ done: 3, skipped: 1, made_easier: 2 });

  // Adherence (clinician) shows the session, the feel rating and the per-exercise counts.
  await page.goto(`/app/clinician/${code}`);
  await expect(page.getByText(/1\s*of 3/).first()).toBeVisible();
  await expect(page.getByText(/Easier 1 · Same 0 · Harder 0/)).toBeVisible();
  await expect(page.getByText(/done 1 · skipped 0 · made easier 1/)).toHaveCount(2);
  await expect(page.getByText(/done 0 · skipped 1 · made easier 0/)).toHaveCount(1);
  await expect(page.getByText("Active days, last 30 days")).toBeVisible();
  await phone.close();
});

test("therapist note: the field stops at 120 characters and the note shows under the session card", async ({ page, browser }) => {
  const code = await createProgramFromTemplate(page, "Note plan");
  const note = page.getByRole("textbox", { name: "Note" });
  await note.fill("x".repeat(121));
  await expect(note).toHaveValue("x".repeat(120)); // the field stops at 120
  await note.fill("Keep the band light this week.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText(/Saved\./)).toBeVisible();
  // (The database refuses 121 characters too: tests/db, "therapist note: 120 characters max".)

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await phone.newPage();
  await enterCodeAndCommit(p, code);
  await expect(p.getByText("“Keep the band light this week.”")).toBeVisible();
  await phone.close();
});
