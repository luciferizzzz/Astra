import { test, expect } from "@playwright/test";

/**
 * Browser-harness smoke test (Vite dev server, Tauri IPC not exercised).
 * Desktop-webview E2E is limited; see the project PRD §15 Testing Strategy.
 */
test("app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Astra" })).toBeVisible();
});
