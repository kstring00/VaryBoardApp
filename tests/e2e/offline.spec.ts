import { expect, test } from "@playwright/test";
import { createProgramFromTemplate, enterCodeAndCommit, eventCounts } from "./helpers";

test("offline: 2 exercises in airplane mode, app closed, reopened, back online -> exactly 2 done events", async ({ page, browser }) => {
  const code = await createProgramFromTemplate(page, "Offline plan");
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: "allow" });
  let p = await phone.newPage();
  await enterCodeAndCommit(p, code);

  // Let the service worker install and cache the session page while online.
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await p.goto("/app/session");
  await expect(p.getByRole("heading", { level: 1, name: "Set up your board." })).toBeVisible();
  await p.reload();
  await expect(p.getByRole("heading", { level: 1, name: "Set up your board." })).toBeVisible();

  await phone.setOffline(true);
  for (let i = 0; i < 2; i++) {
    await p.getByRole("button", { name: /Continue to exercise/ }).click();
    await p.getByRole("button", { name: /Done, next exercise/ }).click();
  }
  await expect(p.getByText("Exercise 3 of 4")).toBeVisible();
  expect((await eventCounts(page, code)).done).toBe(0); // nothing reached the server yet

  // "Lock the screen / switch apps": the page goes away; reopen it while still offline.
  await p.close();
  p = await phone.newPage();
  await p.goto("/app/session");
  await expect(p.getByText("Exercise 3 of 4")).toBeVisible(); // resumed from the device, served by the service worker

  await phone.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => eventCounts(page, code), { timeout: 15_000 }).toMatchObject({ done: 2 });

  // Flushing again (another open, another online event) never duplicates.
  await p.reload();
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  await p.waitForTimeout(1500);
  expect(await eventCounts(page, code)).toEqual({ done: 2, skipped: 0, made_easier: 0 });
  await phone.close();
});
