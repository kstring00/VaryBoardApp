import { expect, test } from "@playwright/test";

test("clinician builds a 4-exercise program from a template in under 2 minutes", async ({ page }) => {
  await page.goto("/app/clinician/login");
  const demo = page.getByRole("button", { name: "Continue as the test clinician" });
  if (await demo.isVisible()) await demo.click();
  await page.waitForURL("**/app/clinician");

  const started = Date.now();
  await page.getByRole("link", { name: "New program" }).click();
  await page.getByRole("button", { name: /Template: \[DRAFT\] Shoulder mobility/ }).click();
  await page.waitForURL("**from=START1");
  await page.getByLabel("Program name (the patient sees this)").fill("Home program B");
  await expect(page.getByTestId("session-minutes")).toContainText("4 of 6 exercises");
  // Reorder by one tap (drag also works with a mouse).
  await page.getByRole("button", { name: /Move .*side wall walk up/ }).click();
  await page.getByRole("button", { name: /Create program and get code/ }).click();
  await page.waitForURL(/\/app\/clinician\/[A-Z0-9]{6}\?created=1/);
  const seconds = (Date.now() - started) / 1000;
  console.log(`Built a 4-exercise program from the template in ${seconds.toFixed(1)} s (automated clicks).`);
  expect(seconds).toBeLessThan(120);
  await expect(page.getByRole("link", { name: "Print handout (PDF)" })).toBeVisible();
  const pdf = await page.request.get(page.url().replace(/\?.*$/, "") + "/handout");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("builder warns at 5 exercises and blocks a 7th", async ({ page }) => {
  await page.goto("/app/clinician/login");
  const demo = page.getByRole("button", { name: "Continue as the test clinician" });
  if (await demo.isVisible()) await demo.click();
  await page.waitForURL("**/app/clinician");
  await page.goto("/app/clinician/new");
  await page.getByRole("button", { name: "Add exercise" }).click();
  const addButtons = page.getByRole("button", { name: /^Add \[DRAFT\]/ });
  for (let i = 0; i < 5; i++) await addButtons.nth(i).click();
  await expect(page.getByText(/Five or more exercises/)).toBeVisible();
  await addButtons.nth(5).click();
  await expect(page.getByTestId("session-minutes")).toContainText("6 of 6 exercises");
  await expect(page.getByText("A session holds up to 6 exercises. Add another session for more.")).toBeVisible();
  // Every Add button is now disabled: a 7th cannot be added.
  const n = await addButtons.count();
  for (let i = 0; i < n; i++) await expect(addButtons.nth(i)).toBeDisabled();
});
