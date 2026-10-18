import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

/**
 * The shell's two Phase 1 promises, against a live Electron process.
 *
 * The Vitest suite pins the menu template and the settings form in isolation;
 * what can only be proven here is that the template becomes a real application
 * menu, that a click on one of its items travels through the preload allowlist
 * and opens the renderer's dialog, and that a settings change survives a real
 * IPC round trip and is reflected back onto the document.
 */

const APP_ROOT = process.cwd();

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({ args: [APP_ROOT] });
});

test.afterAll(async () => {
  await app.close();
});

test("installs a real application menu with File, Edit, View and Help", async () => {
  const labels = await app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()?.items.map((item) => item.label) ?? [],
  );

  expect(labels).toEqual(["File", "Edit", "View", "Help"]);
});

test("disables what is not built and leaves Settings live", async () => {
  const fileMenu = await app.evaluate(({ Menu }) => {
    const file = Menu.getApplicationMenu()?.items.find((item) => item.label === "File");
    return (
      file?.submenu?.items.map((item) => ({ label: item.label, enabled: item.enabled })) ?? []
    );
  });

  const byLabel = new Map(fileMenu.map((item) => [item.label, item.enabled]));
  expect(byLabel.get("Open Project…")).toBe(true);
  expect(byLabel.get("Save")).toBe(false);
  expect(byLabel.get("Settings…")).toBe(true);
});

test("opens the settings dialog when the menu item is invoked", async () => {
  const page = await app.firstWindow();
  await expect(page.getByTestId("bridge-status")).toHaveText("connected");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();

  await app.evaluate(({ Menu }) => {
    const file = Menu.getApplicationMenu()?.items.find((item) => item.label === "File");
    const settings = file?.submenu?.items.find((item) => item.label === "Settings…");
    settings?.click();
  });

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
});

test("applies and stores a theme change made in the dialog", async () => {
  const page = await app.firstWindow();

  await page.getByRole("button", { name: /open application settings/i }).click();
  await page.getByLabel("Theme").selectOption("light");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const readBack = await page.evaluate(() => window.astra.getSettings());
  expect(readBack.theme).toBe("light");
  expect(readBack.telemetry).toBe(false);

  // Leave the machine as it was found.
  await page.getByLabel("Theme").selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
});
