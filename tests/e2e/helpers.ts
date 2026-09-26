import { expect, type Page } from "@playwright/test";

/** Clinician (demo backend) builds a program from Dr. Eric's template; returns the new code. */
export async function createProgramFromTemplate(page: Page, name: string): Promise<string> {
  await page.goto("/app/clinician/login");
  const demo = page.getByRole("button", { name: "Continue as the test clinician" });
  if (await demo.isVisible()) await demo.click();
  await page.waitForURL("**/app/clinician");
  await page.goto("/app/clinician/new?from=START1");
  await page.getByLabel("Program name (the patient sees this)").fill(name);
  await page.getByRole("button", { name: /Create program and get code/ }).click();
  await page.waitForURL(/\/app\/clinician\/[A-Z0-9]{6}\?created=1/);
  return page.url().match(/clinician\/([A-Z0-9]{6})/)![1];
}

/** Patient enters a code and goes through habit + commitment + reminder offer. */
export async function enterCodeAndCommit(page: Page, code: string) {
  await page.goto(`/app/code?c=${code}`);
  await page.getByRole("button", { name: "Use this plan" }).click();
  await page.waitForURL("**/app/start");
  await expect(page.getByRole("heading", { level: 1, name: "When will you move?" })).toBeVisible();
  await page.getByText("After coffee").click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/My plan: \d days a week, after coffee\./)).toBeVisible();
  await page.getByRole("button", { name: "I'm in" }).click();
  // iPhone in a browser tab gets the one-time Add to Home Screen guide; others get the reminder offer.
  const notNow = page.getByRole("button", { name: "Not now" });
  const gotIt = page.getByRole("button", { name: "Got it" });
  await expect(notNow.or(gotIt)).toBeVisible();
  await ((await gotIt.isVisible()) ? gotIt : notNow).click();
  await page.waitForURL(/\/app$/);
}

export async function eventCounts(page: Page, code: string): Promise<{ done: number; skipped: number; made_easier: number }> {
  const r = await page.request.get(`/app/api/demo/events?code=${code}`);
  return r.json();
}
