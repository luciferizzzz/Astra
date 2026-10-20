/**
 * Definition-of-done probe for the canvas slice.
 *
 * `npm run dev` is the gate that matters — a green test suite is not the same
 * claim as "it renders". This script launches the *dev* entry point (Vite HMR,
 * unminified bundles, real DevTools console) with the E2E seam on, opens the
 * parity fixture through the same native-picker stub the specs use, and reports
 * what the canvas actually loaded and painted.
 *
 * It is a manual tool, not part of the suite: it prints facts for a human to
 * read rather than asserting.
 */
import { _electron as electron } from "playwright";
import { join } from "node:path";

const APP_ROOT = process.cwd();
const FIXTURE_ROOT = join(APP_ROOT, "fixtures", "parity");

const app = await electron.launch({
  args: [APP_ROOT],
  env: { ...process.env, ASTRA_E2E: "1", ELECTRON_RENDERER_URL: process.env["ELECTRON_RENDERER_URL"] },
});

// Collect every console message and page error from both renderers.
const problems = [];
app.process().stderr?.on("data", (chunk) => {
  const text = String(chunk);
  if (/error|warn|uncaught/i.test(text)) problems.push(text.trim());
});

await app.evaluate(({ dialog }, root) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
}, FIXTURE_ROOT);

const page = await app.firstWindow();
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    problems.push(`[ui:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => problems.push(`[ui:pageerror] ${error.message}`));

await page.getByRole("button", { name: "Open a project folder" }).click();
await page.waitForTimeout(3000);

const report = await app.evaluate(async ({ webContents }) => {
  const scope = globalThis;
  const facts = scope.__astraCanvas?.();
  if (!facts?.webContentsId) return { facts, probe: null };

  const contents = webContents.fromId(facts.webContentsId);
  const probe = await contents.executeJavaScript(`(function(){
    return {
      title: document.title,
      heading: (document.getElementById("title")||{}).textContent,
      status: (document.getElementById("status")||{}).textContent,
      accent: (document.getElementById("status")||{dataset:{}}).dataset.accent,
      scriptRan: !!(window.__parityFixture && window.__parityFixture.ran),
      titleColor: getComputedStyle(document.getElementById("title")).color,
      titleFontSize: getComputedStyle(document.getElementById("title")).fontSize,
      hasNode: typeof process,
      hasBridge: typeof window.astra
    };
  })()`);
  return { facts, probe };
});

console.log("\n=== CANVAS RENDER REPORT ===");
console.log(JSON.stringify(report, null, 2));
console.log("\n=== PROBLEMS (console errors/warnings) ===");
console.log(problems.length === 0 ? "(none)" : problems.join("\n"));

await app.close();
