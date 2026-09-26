import { expect, test } from "@playwright/test";

const PATIENT = ["/app", "/app/plan", "/app/progress", "/app/care", "/app/settings", "/app/code", "/app/starter", "/app/library", "/app/library/climb", "/app/movement/draft-climb-standing-wall-climb", "/app/privacy", "/app/start", "/app/session"];

test("390px: no horizontal overflow, one H1, alt text, 48px targets, unique titles, noindex except /app", async ({ page }) => {
  // A plan on the device so every screen renders its full state.
  await page.goto("/app/code?c=VBTEST");
  await page.getByRole("button", { name: "Use this plan" }).click();
  await page.waitForURL("**/app/start");

  const titles = new Map<string, string>();
  for (const path of PATIENT) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await page.waitForLoadState("networkidle");
    const r = await page.evaluate(() => {
      const small: string[] = [];
      document.querySelectorAll<HTMLElement>("button, .btn, [role=tab], [role=radio], nav a, input:not([type=hidden]):not(.sr-only), select").forEach((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (b.width === 0 || cs.visibility === "hidden" || cs.opacity === "0" || el.closest("[hidden]")) return;
        if (el.matches("input[type=radio], input[type=checkbox]")) return; // the whole label is the target
        if (b.height < 47.5) small.push(`${el.tagName}.${el.className.toString().slice(0, 30)} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(b.height)}px`);
      });
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll("h1").length,
        imgsWithoutAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
        title: document.title,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
        small,
      };
    });
    expect(r.overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(0);
    expect(r.h1, `${path} H1 count`).toBe(1);
    expect(r.imgsWithoutAlt, `${path} images without alt`).toBe(0);
    expect(r.small, `${path} tap targets under 48px`).toEqual([]);
    if (path === "/app") expect(r.robots).toContain("index");
    else expect(r.robots, `${path} robots`).toContain("noindex");
    titles.set(path, r.title);
  }
  const all = [...titles.values()];
  expect(new Set(all).size, "unique titles").toBe(all.length);
});

test("in-app 404", async ({ page }) => {
  const res = await page.goto("/app/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: /can.t find that page/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

test("reduced motion: no running animations", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/app");
  const long = await page.evaluate(() => document.getAnimations().filter((a) => ((a.effect?.getTiming().duration as number) ?? 0) > 1).length);
  expect(long).toBe(0);
  await ctx.close();
});
