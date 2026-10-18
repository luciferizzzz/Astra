import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

/**
 * The explorer against a live Electron process.
 *
 * `project.spec.ts` proves the filesystem adapter is reachable; what only a real
 * window can prove is the *UI* path: a click on "Open Project" reaches the
 * native folder picker, the chosen root appears in the toolbar and the window
 * title, the tree renders directories lazily, and selecting a file puts its text
 * in the code editor.
 *
 * The picker itself is a native dialog, which no test can drive; it is stubbed
 * at the `electron.dialog` surface — one seam, everything above it is real.
 */

const APP_ROOT = process.cwd();

let app: ElectronApplication;
let tempRoot: string;
let projectRoot: string;

test.beforeAll(async () => {
  // Nested under a folder literally named "sample-project": the folder name is
  // the project title, so the assertions below can name it.
  tempRoot = await mkdtemp(join(tmpdir(), "astra-e2e-explorer-"));
  projectRoot = join(tempRoot, "sample-project");
  await mkdir(projectRoot);
  await mkdir(join(projectRoot, "assets"));
  await writeFile(join(projectRoot, "index.html"), "<!doctype html><title>Explorer</title>\n");
  await writeFile(join(projectRoot, "style.css"), "body { margin: 0; }\n");
  await writeFile(join(projectRoot, "assets", "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>\n");

  app = await electron.launch({ args: [APP_ROOT] });

  // The one seam: the native picker answers with the fixture folder.
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
  }, projectRoot);
});

test.afterAll(async () => {
  await app?.close();
  await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
});

test("opens a project from the toolbar and renders its file tree", async () => {
  const page = await app.firstWindow();
  await expect(page.getByTestId("bridge-status")).toHaveText("connected");

  await expect(page.getByTestId("project-name")).toHaveCount(0);
  await page.getByRole("button", { name: "Open a project folder" }).click();

  // The folder name becomes the project title (FR-A03).
  await expect(page.getByTestId("project-name")).toHaveText("sample-project");
  expect(await page.title()).toBe("sample-project — Astra");

  // Root entries are listed with a badge per type (FR-B02, FR-B03).
  await expect(page.getByTestId("tree-file-index.html")).toBeVisible();
  await expect(page.getByTestId("tree-file-style.css")).toBeVisible();
  await expect(page.getByTestId("tree-dir-assets")).toBeVisible();
  await expect(page.getByTestId("tree-file-assets/logo.svg")).toHaveCount(0);

  // Selecting a file opens it in the code editor (FR-B04).
  await page.getByTestId("tree-file-index.html").click();
  await expect(page.getByText(/<title>Explorer<\/title>/)).toBeVisible();
});

test("expands a directory lazily and closes back to the welcome state", async () => {
  const page = await app.firstWindow();

  await page.getByTestId("tree-dir-assets").click();
  await expect(page.getByTestId("tree-file-assets/logo.svg")).toBeVisible();

  await page.getByRole("button", { name: "Close the open project" }).click();

  await expect(page.getByTestId("project-name")).toHaveCount(0);
  await expect(page.getByText(/No project open/)).toBeVisible();
  await expect(page.getByRole("tree", { name: "Project files" })).toHaveCount(0);
  await expect(page.getByText(/Open a project folder to see its files here/)).toBeVisible();
  expect(await page.title()).toBe("Astra");
});
