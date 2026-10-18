import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

/**
 * The project filesystem against a live Electron process.
 *
 * The Vitest suite pins the adapter, the watcher, the session and the
 * validators in isolation; what only a real process can prove is that all four
 * are actually *reachable* through the preload allowlist — that a renderer can
 * open a folder, read and write a file with a conflict guard, watch for
 * external changes, and still be refused a path outside the project.
 */

const APP_ROOT = process.cwd();

let app: ElectronApplication;
let projectRoot: string;

test.beforeAll(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "astra-e2e-project-"));
  await writeFile(join(projectRoot, "index.html"), "<!doctype html><title>Fixture</title>\n");
  await writeFile(join(projectRoot, "style.css"), "body { color: #111; }\n");
  await writeFile(join(projectRoot, "secret.txt"), "top secret\n");
  // Must never appear in a listing.
  await writeFile(join(projectRoot, "node_modules-junk.js"), "// not vendor\n");

  app = await electron.launch({ args: [APP_ROOT] });
});

test.afterAll(async () => {
  await app?.close();
  await rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
});

test("opens a project and lists the root through the bridge", async () => {
  const page = await app.firstWindow();

  const opened = await page.evaluate(
    (root) => window.astra.projectOpen(root),
    projectRoot,
  );

  expect(opened.root).toBeTruthy();
  const names = opened.entries.map((entry) => entry.name).sort();
  expect(names).toEqual(["index.html", "node_modules-junk.js", "secret.txt", "style.css"]);

  const state = await page.evaluate(() => window.astra.getProjectState());
  expect(state.root).toBe(opened.root);
});

test("reads a file and writes it back with a live conflict guard", async () => {
  const page = await app.firstWindow();

  const file = await page.evaluate(() => window.astra.projectReadFile("index.html"));
  expect(file.text).toContain("<title>Fixture</title>");
  expect(file.hash).toMatch(/^[0-9a-f]{64}$/);

  // A write guarded by the hash we just read goes through.
  const edited = "<!doctype html><title>Edited in Astra</title>\n";
  const written = await page.evaluate(
    ({ text, hash }) => window.astra.projectWriteFile("index.html", text, hash),
    { text: edited, hash: file.hash },
  );
  expect(written.hash).toMatch(/^[0-9a-f]{64}$/);

  // The same stale guard must now refuse: someone else (our own fixture
  // process) changed the file since that read.
  await writeFile(join(projectRoot, "index.html"), "<!doctype html><title>External</title>\n");
  await expect(
    page.evaluate(
      ({ text, hash }) => window.astra.projectWriteFile("index.html", text, hash),
      { text: edited, hash: written.hash },
    ),
  ).rejects.toThrow(/changed on disk/);

  // The external write above is a real change the watcher will report. Let it
  // drain here, so a later test that arms a fresh listener does not inherit it.
  await new Promise((resolve) => setTimeout(resolve, 500));
});

test("refuses a path that tries to leave the project", async () => {
  const page = await app.firstWindow();

  await expect(
    page.evaluate(() => window.astra.projectReadFile("../escape.txt")),
  ).rejects.toThrow(/Unsafe|escape/i);
});

test("reports an external change and stays quiet about Astra's own", async () => {
  const page = await app.firstWindow();

  // Arm the listener inside the renderer before anything happens.
  await page.evaluate(() => {
    const events: unknown[] = [];
    (window as unknown as { __fsEvents: unknown[] }).__fsEvents = events;
    window.astra.onProjectFsEvent((changes) => events.push(...changes));
  });

  // Our own write must not echo back (FR-G06).
  await page.evaluate(() =>
    window.astra.projectWriteFile("style.css", "body { color: #222; }\n"),
  );

  // An external write must arrive as a verified change (FR-G02).
  await writeFile(join(projectRoot, "style.css"), "body { color: #333; }\n");

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            ((window as unknown as { __fsEvents: Array<{ relativePath: string; type: string }> })
              .__fsEvents ?? []).map((change) => `${change.type}:${change.relativePath}`),
        ),
      { timeout: 5000 },
    )
    .toContain("changed:style.css");

  const events = await page.evaluate(
    () => (window as unknown as { __fsEvents: Array<{ relativePath: string }> }).__fsEvents,
  );
  // Exactly the external change — no self-write echo, no `.lock` debris.
  expect(events).toEqual([{ type: "changed", relativePath: "style.css", kind: "file" }]);
});

test("closing the project clears the state", async () => {
  const page = await app.firstWindow();

  await page.evaluate(() => window.astra.projectClose());
  const state = await page.evaluate(() => window.astra.getProjectState());
  expect(state.root).toBeNull();

  await expect(
    page.evaluate(() => window.astra.projectReadFile("index.html")),
  ).rejects.toThrow(/No project is open/);
});
