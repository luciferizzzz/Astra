import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import { join } from "node:path";

/**
 * The canvas must yield to a modal (FR-A05, bug 2026-11-13).
 *
 * The canvas is a `WebContentsView` — a native layer composited above the UI
 * document — so a DOM dialog drawn over its rectangle ends up *behind* the site
 * and cannot be clicked. `z-index` does not cross that boundary, and no DOM
 * assertion can see the occlusion: Playwright would still call the dialog
 * "visible" while a screenshot shows the site on top of it.
 *
 * So this spec asserts the only fact that decides the bug: while Settings is
 * open, the surface is hidden; when it closes, the surface comes back and the
 * document was not reloaded. The view is read through the main-process seam,
 * because the preview renderer is not a page Playwright can reach.
 */

const APP_ROOT = process.cwd();
const FIXTURE_ROOT = join(APP_ROOT, "fixtures", "parity");

let app: ElectronApplication;

interface CanvasFacts {
  url: string | null;
  visible: boolean;
}

/** The live canvas facts, as published by `installPreviewTestSeam`. */
async function canvasFacts(): Promise<CanvasFacts> {
  return app.evaluate(() => {
    const scope = globalThis as { __astraCanvas?: () => CanvasFacts };
    if (!scope.__astraCanvas) throw new Error("the canvas test seam is not installed");
    const facts = scope.__astraCanvas();
    return { url: facts.url, visible: facts.visible };
  });
}

test.beforeAll(async () => {
  app = await electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, ASTRA_E2E: "1" },
  });

  // The native picker is the one seam; everything above it is real.
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
  }, FIXTURE_ROOT);

  const page = await app.firstWindow();
  await page.getByRole("button", { name: "Open a project folder" }).click();
  await expect(page.getByTestId("entry-point")).toHaveText("Entry: index.html");
});

test.afterAll(async () => {
  await app.close();
});

test("hides the canvas surface while Settings is open, then shows it again", async () => {
  const page = await app.firstWindow();

  // The project is rendered before anything else is asserted: a surface that
  // was never shown would make the "hidden" half of this test pass for free.
  // The URL is empty until the renderer commits its first navigation, so the
  // seam is polled for both facts rather than read once.
  await expect
    .poll(
      async () => {
        const facts = await canvasFacts();
        return facts.visible && facts.url !== "";
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  const loadedUrl = (await canvasFacts()).url;
  expect(loadedUrl).toContain("astra-preview://project/index.html");

  await page.getByRole("button", { name: /open application settings/i }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  // The fix: the native view is gone, so the modal is what the user sees.
  await expect.poll(async () => (await canvasFacts()).visible, { timeout: 10_000 }).toBe(false);

  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();

  await expect.poll(async () => (await canvasFacts()).visible, { timeout: 10_000 }).toBe(true);

  // Hiding is not reloading: closing the dialog must return to the same
  // document, not to a fresh navigation that would lose scroll and selection.
  expect((await canvasFacts()).url).toBe(loadedUrl);
});
