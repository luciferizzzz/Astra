import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

/**
 * Smoke test against the real Electron shell.
 *
 * `npm run test:e2e` builds first, so this runs against `out/` — the same
 * bundles a packaged build ships. It covers the four things that can only be
 * proven with a live process behind them:
 *
 *   1. the main process boots and loads the hardened window,
 *   2. the renderer has no Node.js at all,
 *   3. the sandboxed renderer reaches the preload allowlist,
 *   4. an IPC round trip survives `sandbox: true`.
 *
 * NOTE: the handle is deliberately named `page`, not `window` — a local named
 * `window` shadows the DOM global that the in-page `evaluate` callbacks read.
 */

/**
 * Launched by app directory, not by entry file.
 *
 * Passing `out/main/index.js` makes Electron treat `out/main` as the app root.
 * The `main` field still resolves, but the repository's `package.json` is never
 * found — so `app.getVersion()` silently falls back to the Electron version.
 * Launching by directory exercises the same `main` resolution a packaged build
 * depends on, which is the behaviour worth pinning.
 */
const APP_ROOT = process.cwd();

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({ args: [APP_ROOT] });
});

test.afterAll(async () => {
  await app.close();
});

test("boots into the hardened renderer window", async () => {
  const page = await app.firstWindow();

  await expect(page.getByRole("heading", { name: "Astra" })).toBeVisible();
  await expect(page.getByText(/sandbox on/i)).toBeVisible();
});

test("gives the renderer no Node.js surface at all", async () => {
  const page = await app.firstWindow();

  const posture = await page.evaluate(() => {
    const scope = window as unknown as Record<string, unknown>;
    return {
      require: typeof scope["require"],
      module: typeof scope["module"],
      process: typeof scope["process"],
      ipcRenderer: typeof scope["ipcRenderer"],
    };
  });

  expect(posture).toEqual({
    require: "undefined",
    module: "undefined",
    process: "undefined",
    ipcRenderer: "undefined",
  });
});

test("reaches the preload allowlist across the sandbox boundary", async () => {
  const page = await app.firstWindow();

  await expect(page.getByTestId("bridge-status")).toHaveText("connected");

  const pong = await page.evaluate(() => window.astra.ping("e2e-nonce"));
  expect(pong).toEqual({ pong: true, nonce: "e2e-nonce" });
});

test("reports the application version from the main process", async () => {
  const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion());
  expect(version).toBe("0.1.0");

  const page = await app.firstWindow();
  await expect(page.getByTestId("app-version")).toHaveText("0.1.0");
});
