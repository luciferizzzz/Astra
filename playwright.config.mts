import { defineConfig } from "@playwright/test";

/**
 * Playwright drives the real Electron binary rather than a browser pointed at a
 * dev server, so there is no `webServer` and no `baseURL`: each spec launches
 * the built app and talks to it over CDP.
 *
 * `@playwright/test` does not re-export Electron support, which is why the
 * specs import `_electron` from `playwright` — a direct dependency pinned to
 * the same version, so the two cannot drift.
 *
 * See PRD §15 and TEST-027..TEST-033.
 */
export default defineConfig({
  testDir: "./e2e",
  // One Electron instance at a time. Two concurrent windows would contend for
  // the same session data and turn a real failure into an unreadable one.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    trace: "on-first-retry",
  },
});
