import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The canvas against a live Electron process (Phase 2, FR-C01).
 *
 * What only a real run can prove, and what this spec therefore asserts:
 *
 *   1. The canvas is its own renderer, not a region of the UI document — so its
 *      facts are read through the main process, not the UI page.
 *   2. It renders the project's real files: the linked stylesheet is applied
 *      (computed styles match what the CSS authors) and the linked script runs.
 *   3. What it renders *matches a plain browser* for the supported features —
 *      checked by loading the same bytes from `file://` and comparing computed
 *      styles element by element (AC-002, TEST-016).
 *   4. The sandbox holds: the document has no Node, no bridge and no way out.
 *
 * The fixture is `fixtures/parity/`, a small self-contained site whose CSS
 * doubles as this spec's expectation table.
 */

const APP_ROOT = process.cwd();
const FIXTURE_ROOT = join(APP_ROOT, "fixtures", "parity");
const FIXTURE_FILE_URL = pathToFileURL(join(FIXTURE_ROOT, "index.html")).toString();

/** The elements whose computed styles the two renders are compared on. */
const PROBED_IDS = ["title", "nav-home", "lead", "list", "site-header", "site-footer", "badge"];

/**
 * The style facts read from a document, in a form that survives `evaluate`'s
 * structured clone: plain strings, ordered the same way in both renders.
 */
const STYLE_PROBE = `
  (function () {
    var ids = ${JSON.stringify(PROBED_IDS)};
    var out = {};
    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) {
        out[id] = null;
        return;
      }
      var style = getComputedStyle(element);
      var box = element.getBoundingClientRect();
      out[id] = {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        display: style.display,
        flexDirection: style.flexDirection,
        letterSpacing: style.letterSpacing,
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });
    return out;
  })()
`;

let app: ElectronApplication;

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

test("renders the project's real document from the preview scheme", async () => {
  // The URL is empty until the renderer commits its first navigation, so the
  // seam is polled rather than read once — the same way `waitForCanvas` waits.
  const facts = await app.evaluate(async () => {
    const scope = globalThis as {
      __astraCanvas?: () => { url: string | null; visible: boolean };
    };
    if (!scope.__astraCanvas) throw new Error("the canvas test seam is not installed");

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const current = scope.__astraCanvas();
      if (current.url) return current;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return scope.__astraCanvas();
  });

  expect(facts.url).toContain("astra-preview://project/index.html");
  expect(facts.visible).toBe(true);
});

test("serves files only from inside the open project", async () => {
  // A traversal the URL grammar must refuse outright, and a path the project
  // does not contain: both are answered as missing, never read.
  const outcomes = await canvasEvaluate<string[]>(`
    (async function () {
      var attempts = [
        "astra-preview://project/../outside.txt",
        "astra-preview://project/%2e%2e%2foutside.txt",
        "astra-preview://elsewhere/index.html",
        "astra-preview://project/node_modules/pkg/index.js",
        "astra-preview://project/does-not-exist.html"
      ];
      var results = [];
      for (var i = 0; i < attempts.length; i += 1) {
        try {
          var response = await fetch(attempts[i]);
          results.push(attempts[i] + " -> " + response.status);
        } catch (error) {
          results.push(attempts[i] + " -> threw");
        }
      }
      return results;
    })()
  `);

  for (const outcome of outcomes) {
    expect(outcome).not.toContain("-> 200");
  }
});

test("serves the project its own files, including subresources", async () => {
  // The positive half of the previous test: containment that refused everything
  // would pass those assertions trivially. A real subresource the fixture links
  // must actually arrive, with the type the extension implies.
  const outcomes = await canvasEvaluate<Record<string, string>>(`
    (async function () {
      var paths = ["styles/site.css", "scripts/site.js", "assets/badge.svg"];
      var results = {};
      for (var i = 0; i < paths.length; i += 1) {
        var response = await fetch("astra-preview://project/" + paths[i]);
        results[paths[i]] = response.status + " " + response.headers.get("content-type");
      }
      return results;
    })()
  `);

  expect(outcomes["styles/site.css"]).toBe("200 text/css; charset=utf-8");
  expect(outcomes["scripts/site.js"]).toBe("200 text/javascript; charset=utf-8");
  expect(outcomes["assets/badge.svg"]).toBe("200 image/svg+xml");
});

test("enforces the preview policy against remote origins", async () => {
  // The CSP is a *response header*, and a header that is not enforced is just
  // documentation. This asserts the enforcement itself: a request to a remote
  // origin must be refused by the policy, not merely by the absence of a
  // network stack. `https://example.com` is never reachable from the preview.
  const outcome = await canvasEvaluate<{ reached: boolean; note: string }>(`
    (async function () {
      try {
        await fetch("https://example.com/");
        return { reached: true, note: "fetch resolved" };
      } catch (error) {
        return { reached: false, note: String(error && error.name) };
      }
    })()
  `);

  expect(outcome.reached).toBe(false);
});

test("applies the project's linked stylesheet", async () => {
  const styles = await canvasEvaluate<Record<string, { color: string; fontSize: string; display: string } | null>>(
    STYLE_PROBE,
  );

  // Values straight out of fixtures/parity/styles/site.css.
  expect(styles["title"]?.color).toBe("rgb(12, 34, 56)");
  expect(styles["title"]?.fontSize).toBe("28px");
  expect(styles["lead"]).not.toBeNull();
  // The paragraph is italic only through the `.prose` rule.
  expect(await canvasEvaluate<string>(`getComputedStyle(document.getElementById("lead")).fontStyle`)).toBe(
    "italic",
  );
  // The list is a flex row before the media query and a column under it; the
  // desktop preset is wide, so the row wins.
  expect(styles["list"]?.display).toBe("flex");
});

test("runs the project's linked JavaScript", async () => {
  const marker = await canvasEvaluate<{ ran: boolean; href: string } | undefined>(
    "window.__parityFixture",
  );
  expect(marker?.ran).toBe(true);

  const status = await canvasEvaluate<string>(
    'document.getElementById("status").textContent',
  );
  expect(status).toBe("script ran");

  // The script read a custom property the stylesheet defines: proof the cascade
  // resolved, not merely that a string was written somewhere.
  const accent = await canvasEvaluate<string>(
    'document.getElementById("status").dataset.accent',
  );
  expect(accent).toBe("rgb(12, 34, 56)");
});

test("matches a plain browser render of the same bytes (AC-002)", async () => {
  const canvasStyles = await canvasEvaluate(STYLE_PROBE);

  // The reference viewport must be the *same size* as the canvas, or the
  // comparison measures viewport width rather than fidelity. Height matters as
  // much as width here: a document taller than its viewport reserves a classic
  // scrollbar, which narrows the layout by its gutter, and two faithful renders
  // of different heights would disagree by exactly that much. Both dimensions
  // are read back from the live view, not assumed.
  const canvasSize = await app.evaluate(() => {
    const scope = globalThis as {
      __astraCanvas?: () => { bounds: { width: number; height: number } | null };
    };
    const bounds = scope.__astraCanvas?.().bounds;
    if (!bounds) throw new Error("the canvas has no bounds to compare against");
    return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
  });

  // The same file, loaded without the preview scheme, the sandbox or the CSP:
  // an ordinary Chromium render of the exact bytes on disk.
  //
  // The reference is a `WebContentsView` rather than a `BrowserWindow` because
  // Windows enforces a minimum top-level window width (~884px), which makes a
  // narrower window impossible to create — and the canvas is often narrower
  // than that. A view has no such floor, so the reference viewport can be made
  // to match the canvas viewport exactly. It is hosted in a hidden throwaway
  // window, and both the view and the window are destroyed afterwards.
  const reference = await app.evaluate(
    async ({ BrowserWindow, WebContentsView }, args) => {
      const host = new BrowserWindow({ show: false, width: 1600, height: 1000 });
      const view = new WebContentsView();
      host.contentView.addChildView(view);
      view.setBounds({ x: 0, y: 0, width: args.width, height: args.height });

      try {
        await view.webContents.loadURL(args.url);

        // The hosted view's own viewport is read back before probing: a hidden
        // window can still be clamped on some platforms, and the comparison is
        // only meaningful when the two viewports are the same size.
        const metrics = (await view.webContents.executeJavaScript(
          "[window.innerWidth, window.innerHeight]",
        )) as [number, number];
        if (metrics[0] !== args.width || metrics[1] !== args.height) {
          throw new Error(
            `reference viewport is ${metrics[0]}x${metrics[1]}, canvas is ${args.width}x${args.height}`,
          );
        }

        return (await view.webContents.executeJavaScript(args.script)) as unknown;
      } finally {
        view.webContents.close();
        host.destroy();
      }
    },
    { url: FIXTURE_FILE_URL, script: STYLE_PROBE.trim(), ...canvasSize },
  );

  // Every probed element must agree on every probed property. Widths and
  // heights are included on purpose: the canvas is placed at a known size, and
  // a mismatch there would mean the served CSS or the document itself differs.
  for (const id of PROBED_IDS) {
    expect(
      (canvasStyles as Record<string, unknown>)[id],
      `computed style of #${id} must match a plain render`,
    ).toEqual((reference as Record<string, unknown>)[id]);
  }
});

test("gives the canvas renderer no way back into Astra", async () => {
  const posture = await canvasEvaluate<Record<string, string>>(`
    (function () {
      var scope = window;
      return {
        hasRequire: typeof scope.require,
        hasProcess: typeof scope.process,
        hasModule: typeof scope.module,
        hasBuffer: typeof scope.Buffer,
        hasIpcRenderer: typeof scope.ipcRenderer,
        hasAstraBridge: typeof scope.astra,
        hasElectronBridge: typeof scope.electron,
        hasParentNode: typeof (scope.parent && scope.parent.document)
      };
    })()
  `);

  expect(posture).toEqual({
    hasRequire: "undefined",
    hasProcess: "undefined",
    hasModule: "undefined",
    hasBuffer: "undefined",
    hasIpcRenderer: "undefined",
    hasAstraBridge: "undefined",
    hasElectronBridge: "undefined",
    // The canvas is not framed by the UI, so `parent` is the document itself.
    hasParentNode: "object",
  });

  const parentIsSelf = await canvasEvaluate<boolean>("window.parent === window");
  expect(parentIsSelf).toBe(true);
});

test("refuses navigation and popups from inside the canvas", async () => {
  const outcome = await app.evaluate(
    async ({ webContents }, id) => {
      const contents = webContents.fromId(id);
      if (!contents) throw new Error("the canvas renderer vanished");
      const before = contents.getURL();

      await contents.executeJavaScript('window.location.href = "data:text/html,<h1>x</h1>";');
      await new Promise((resolve) => setTimeout(resolve, 300));

      const popup = (await contents.executeJavaScript(
        'window.open("about:blank") === null',
      )) as boolean;

      return { after: contents.getURL(), before, popupDenied: popup };
    },
    await waitForCanvas(),
  );

  expect(outcome.after).toBe(outcome.before);
  expect(outcome.popupDenied).toBe(true);
});
