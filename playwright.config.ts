import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build with the local demo backend:
 *   pnpm build:demo && pnpm test:e2e
 * (the web server below starts `scripts/serve-demo.sh` on port 3100 unless one is running).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["iPhone 13"],
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    serviceWorkers: "allow",
    trace: "off",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "bash scripts/serve-demo.sh", url: "http://localhost:3100/app", reuseExistingServer: true, timeout: 120_000 },
});
