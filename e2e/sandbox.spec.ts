import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

/**
 * Phase 0 spike #4 — the preview sandbox, proven against a hostile document.
 *
 * `fixtures/hostile/escape-attempt.html` plays the part of markup from a
 * project the user cloned from anywhere. It loads inside the real preview
 * posture (`src/main/preview.ts`) and records what it can reach. The test reads
 * that record back through the window's own `webContents`, so it measures the
 * actual renderer process rather than a mock of it.
 *
 * The preview window is opened through the `ASTRA_E2E=1` seam in the main
 * entry point; without that variable the hook does not exist. See PRD §11.2,
 * §14.4 (SEC-016, SEC-018) and §13 (Phase 0, spike #4).
 */

const APP_ROOT = process.cwd();
const HOSTILE_URL = pathToFileURL(
  join(APP_ROOT, "fixtures", "hostile", "escape-attempt.html"),
).toString();

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, ASTRA_E2E: "1" },
  });
  // The seam exists from module load, but opening a window needs a ready app.
  await app.firstWindow();
});

test.afterAll(async () => {
  await app.close();
});

test("a preview of hostile markup cannot reach the desktop", async () => {
  const probe = await app.evaluate(async ({ BrowserWindow }, url) => {
    const scope = globalThis as { __astraOpenPreview?: (target: string) => number };
    if (!scope.__astraOpenPreview) {
      throw new Error("the preview test seam is not installed");
    }

    const id = scope.__astraOpenPreview(url);
    const window = BrowserWindow.getAllWindows().find((candidate) => candidate.id === id);
    if (!window) {
      throw new Error("the preview window was not created");
    }

    const contents = window.webContents;
    for (let attempt = 0; attempt < 100 && contents.isLoading(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return contents.executeJavaScript("window.__astraProbe");
  }, HOSTILE_URL);

  expect(probe).toEqual({
    hasRequire: false,
    hasProcess: false,
    hasModule: false,
    hasBuffer: false,
    hasIpcRenderer: false,
    hasAstraBridge: false,
    hasElectronBridge: false,
    openDenied: true,
    webviewApiAbsent: true,
  });
});

test("a preview refuses to navigate away from the document it was given", async () => {
  const outcome = await app.evaluate(async ({ BrowserWindow }, url) => {
    const preview = BrowserWindow.getAllWindows().find(
      (candidate) => candidate.webContents.getURL() === url,
    );
    if (!preview) {
      throw new Error("the preview window is not open");
    }

    await preview.webContents.executeJavaScript(
      'window.location.href = "data:text/html,<h1>escaped</h1>";',
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    return preview.webContents.getURL();
  }, HOSTILE_URL);

  expect(outcome).toBe(HOSTILE_URL);
});
