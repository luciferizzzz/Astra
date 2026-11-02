import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { join } from "node:path";

/**
 * Selection, end to end (Phase 2, FR-C05, FR-C06).
 *
 * The canvas is a separate renderer composited *above* the UI document, so a
 * selection involves four parties that no unit test can join:
 *
 *   1. a click lands inside the project page, where the minimal preview preload
 *      forwards its coordinates over `astra:canvas:click`;
 *   2. the main process hit-tests at those coordinates and decides the element;
 *   3. the outline is painted back *inside* the preview — a UI overlay would be
 *      hidden behind the native view, which is exactly the defect this spec
 *      exists to prevent from returning;
 *   4. the selection is announced to the UI, where the chrome label, the
 *      inspector and the layer tree read it.
 *
 * Both directions are covered: canvas → tree/inspector, and tree → canvas.
 * The fixture is `fixtures/parity/`, whose ids are load-bearing.
 */

const APP_ROOT = process.cwd();
const FIXTURE_ROOT = join(APP_ROOT, "fixtures", "parity");

/** The element `canvas-view.ts` injects to mark the selection. */
const OUTLINE_ID = "__astra_selection_outline";

let app: ElectronApplication;
let page: Page;
/** The inspector aside; `getByLabel` also matches its inner tab nav. */
const inspector = () => page.getByRole("complementary", { name: "Inspector" });

test.beforeAll(async () => {
  app = await electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, ASTRA_E2E: "1" },
  });

  // The native picker is the one seam; everything above it is real.
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
  }, FIXTURE_ROOT);

  page = await app.firstWindow();
  await page.getByRole("button", { name: "Open a project folder" }).click();
  await expect(page.getByTestId("entry-point")).toHaveText("Entry: index.html");
});

test.afterAll(async () => {
  await app?.close();
});

/** Waits until the canvas renderer exists, then returns its webContents id. */
async function waitForCanvas(): Promise<number> {
  return app.evaluate(async () => {
    const scope = globalThis as {
      __astraCanvas?: () => { webContentsId: number | null; url: string | null };
    };
    if (!scope.__astraCanvas) throw new Error("the canvas test seam is not installed");

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const facts = scope.__astraCanvas();
      if (facts.webContentsId !== null) return facts.webContentsId;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("the canvas never created a renderer");
  });
}

/** Runs `script` inside the canvas renderer, once its document has loaded. */
async function canvasEvaluate<T>(script: string): Promise<T> {
  const id = await waitForCanvas();

  return app.evaluate(
    async ({ webContents }, args) => {
      const contents = webContents.fromId(args.id);
      if (!contents) throw new Error("the canvas renderer vanished");

      for (let attempt = 0; attempt < 200 && contents.isLoading(); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      // The load event can fire a tick before the script's own work lands.
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const ready = await contents.executeJavaScript("document.readyState");
        if (ready === "complete") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return contents.executeJavaScript(args.script) as Promise<never>;
    },
    { id, script: script.trim() },
  ) as Promise<T>;
}

/** The center of `#id`, in the CSS pixels a click event reports. */
async function centerOf(id: string): Promise<{ x: number; y: number }> {
  return canvasEvaluate<{ x: number; y: number }>(`
    (function () {
      var element = document.getElementById(${JSON.stringify(id)});
      if (!element) throw new Error("no element #" + ${JSON.stringify(id)} + " in the preview");
      var box = element.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    })()
  `);
}

/**
 * Clicks the canvas at real coordinates.
 *
 * `sendInputEvent` goes through Chromium's input pipeline, so the page receives
 * a genuine click — not a synthesized `element.click()` that would skip the
 * hit-test this feature is about.
 */
async function clickCanvas(target: { x: number; y: number }): Promise<void> {
  const id = await waitForCanvas();
  await app.evaluate(
    async ({ webContents }, args) => {
      const contents = webContents.fromId(args.id);
      if (!contents) throw new Error("the canvas renderer vanished");
      contents.focus();
      contents.sendInputEvent({
        type: "mouseDown",
        x: args.x,
        y: args.y,
        button: "left",
        clickCount: 1,
      });
      contents.sendInputEvent({
        type: "mouseUp",
        x: args.x,
        y: args.y,
        button: "left",
        clickCount: 1,
      });
    },
    { id, ...target },
  );
}

/** What the in-preview outline currently marks, as the preview sees it. */
async function readOutline(): Promise<{
  count: number;
  label: string | null;
  pointerEvents: string | null;
  box: { x: number; y: number; width: number; height: number } | null;
} | null> {
  return canvasEvaluate(`
    (function () {
      var marks = document.querySelectorAll('[data-astra-overlay="selection"]');
      var box = document.getElementById(${JSON.stringify(OUTLINE_ID)});
      if (!box) return { count: marks.length, label: null, pointerEvents: null, box: null };
      var style = getComputedStyle(box);
      var rect = box.getBoundingClientRect();
      return {
        count: marks.length,
        label: box.textContent,
        pointerEvents: style.pointerEvents,
        box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      };
    })()
  `);
}

/** The box the preview reports for a project element, for comparing to the outline. */
async function boxOf(id: string): Promise<{ x: number; y: number; width: number; height: number }> {
  return canvasEvaluate<{ x: number; y: number; width: number; height: number }>(`
    (function () {
      var element = document.getElementById(${JSON.stringify(id)});
      if (!element) throw new Error("no element #" + ${JSON.stringify(id)} + " in the preview");
      var rect = element.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    })()
  `);
}

function expectSameBox(
  actual: { x: number; y: number; width: number; height: number } | null,
  expected: { x: number; y: number; width: number; height: number },
  rounding = 1,
): void {
  expect(actual).not.toBeNull();
  if (actual === null) return;
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(rounding);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(rounding);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(rounding);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(rounding);
}

test("a click on the canvas selects the clicked element and marks it in place", async () => {
  // Nothing is selected until the user acts: the inspector shows its empty state.
  await expect(page.getByTestId("canvas-selected")).toHaveCount(0);
  await expect(inspector()).toContainText("Select an element on the canvas to edit it.");

  await clickCanvas(await centerOf("title"));

  // The chrome label is outside the measured box — the only place a UI element
  // can be seen while the native view covers the surface.
  await expect(page.getByTestId("canvas-selected")).toHaveText("h1#title");

  // The path is the element's ancestry, and the selector its exact address —
  // both are what a later edit/property panel will address the element by.
  await expect(inspector()).toContainText("h1#title");
  await expect(inspector()).toContainText("body > header#site-header > h1#title");
  await expect(inspector()).toContainText("Box");
  await expect(inspector()).toContainText("Read-only (origin)");

  // The outline lives in the preview document, not the UI document, and sits
  // exactly over the selected element.
  const outline = await readOutline();
  expect(outline).not.toBeNull();
  expect(outline?.count).toBe(1);
  expect(outline?.label).toBe("h1#title");
  // It must never intercept the next click: clicking through the outline is
  // how a second selection is made.
  expect(outline?.pointerEvents).toBe("none");
  expectSameBox(outline?.box ?? null, await boxOf("title"));

  // Selecting again replaces the mark rather than stacking another one.
  await clickCanvas(await centerOf("lead"));
  await expect(page.getByTestId("canvas-selected")).toHaveText("p#lead");
  const moved = await readOutline();
  expect(moved?.count).toBe(1);
  expect(moved?.label).toBe("p#lead");
  expectSameBox(moved?.box ?? null, await boxOf("lead"));
});

test("clicking a layer-tree node selects the element in the canvas (FR-C06)", async () => {
  // The tree lives under the Components tab and is refreshed when that tab is
  // opened, so the previous test's selection is irrelevant here.
  await page.getByRole("tab", { name: "Components" }).click();
  await expect(page.getByText("Layer tree")).toBeVisible();

  // `title` is the tree node's selector, exact and unique.
  await page.getByTitle("a#nav-home", { exact: true }).click();

  await expect(page.getByTestId("canvas-selected")).toHaveText("a#nav-home");
  await expect(inspector()).toContainText("a#nav-home");

  const outline = await readOutline();
  expect(outline?.count).toBe(1);
  expect(outline?.label).toBe("a#nav-home");
  // The tree path measures *after* scrolling the element into view, so the
  // outline must match where the element ended up, not where it started.
  expectSameBox(outline?.box ?? null, await boxOf("nav-home"));
});
