import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openProjectFileSystem, type ProjectFileSystem } from "../src/main/project-fs";
import {
  createProjectWatcher,
  diffSnapshots,
  type FsChange,
  type ProjectWatcher,
} from "../src/main/project-watcher";

/**
 * The watcher is the sensor half of the sync engine (FR-G02, FR-G06): it must
 * be timely about external changes and silent about Astra's own writes.
 *
 * Two layers of tests: `diffSnapshots` pinned as a pure function, and the
 * live watcher driven against a real temporary directory in polling mode —
 * polling is the fallback path *and* the deterministic one, so the assertions
 * do not race the operating system's event delivery.
 */

/** Polls `predicate` until it holds or the deadline passes. */
async function waitFor(predicate: () => boolean, label: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Waits out a few full debounce+poll cycles, then reports what arrived. */
async function settle(cycles = 6, intervalMs = 40): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, cycles * intervalMs));
}

describe("diffSnapshots", () => {
  const entry = (kind: "file" | "directory", size: number, mtimeMs: number) => ({
    kind,
    size,
    mtimeMs,
  });

  it("reports a file that appeared", () => {
    const next = new Map([["a.txt", entry("file", 1, 1)]]);
    expect(diffSnapshots(new Map(), next)).toEqual([
      { type: "created", relativePath: "a.txt", kind: "file" },
    ]);
  });

  it("reports a file that went away", () => {
    const previous = new Map([["a.txt", entry("file", 1, 1)]]);
    expect(diffSnapshots(previous, new Map())).toEqual([
      { type: "deleted", relativePath: "a.txt", kind: "file" },
    ]);
  });

  it("reports a file whose size or mtime moved", () => {
    const previous = new Map([["a.txt", entry("file", 1, 1)]]);
    expect(diffSnapshots(previous, new Map([["a.txt", entry("file", 2, 1)]]))).toEqual([
      { type: "changed", relativePath: "a.txt", kind: "file" },
    ]);
    expect(diffSnapshots(previous, new Map([["a.txt", entry("file", 1, 2)]]))).toEqual([
      { type: "changed", relativePath: "a.txt", kind: "file" },
    ]);
  });

  it("stays quiet when nothing moved", () => {
    const snapshot = new Map([
      ["a.txt", entry("file", 1, 1)],
      ["src", entry("directory", 0, 1)],
    ]);
    expect(diffSnapshots(snapshot, new Map(snapshot))).toEqual([]);
    // A directory's own size/mtime are noise — only files are compared.
    const touched = new Map([
      ["a.txt", entry("file", 1, 1)],
      ["src", entry("directory", 0, 999)],
    ]);
    expect(diffSnapshots(snapshot, touched)).toEqual([]);
  });

  it("splits a shape change into a deletion and a creation", () => {
    const previous = new Map([["thing", entry("file", 5, 1)]]);
    const next = new Map([["thing", entry("directory", 0, 2)]]);
    expect(diffSnapshots(previous, next)).toEqual([
      { type: "deleted", relativePath: "thing", kind: "file" },
      { type: "created", relativePath: "thing", kind: "directory" },
    ]);
  });

  it("emits changes sorted by path, so batches have a stable order", () => {
    const previous = new Map([["z.txt", entry("file", 1, 1)]]);
    const next = new Map([
      ["a.txt", entry("file", 1, 1)],
      ["m.txt", entry("file", 1, 1)],
      ["z.txt", entry("file", 9, 9)],
    ]);
    expect(diffSnapshots(previous, next).map((change) => change.relativePath)).toEqual([
      "a.txt",
      "m.txt",
      "z.txt",
    ]);
  });
});

describe("createProjectWatcher — live, polling mode", () => {
  let root: string;
  let project: ProjectFileSystem;
  let watcher: ProjectWatcher;
  let changes: FsChange[];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "astra-watch-"));
    await writeFile(join(root, "index.html"), "<p>one</p>\n");
    project = await openProjectFileSystem(root);
    changes = [];

    watcher = createProjectWatcher(project, {
      forcePolling: true,
      pollIntervalMs: 40,
      debounceMs: 20,
      onChanges: (batch) => changes.push(...batch),
    });
    await watcher.start();
    expect(watcher.mode).toBe("poll");
  });

  afterEach(async () => {
    await watcher.stop();
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  });

  it("reports a file created outside Astra", async () => {
    await writeFile(join(root, "new.html"), "<p>new</p>\n");
    await waitFor(
      () => changes.some((change) => change.type === "created" && change.relativePath === "new.html"),
      "created event for new.html",
    );
  });

  it("reports a file changed outside Astra", async () => {
    await writeFile(join(root, "index.html"), "<p>two</p>\n");
    await waitFor(
      () => changes.some((change) => change.type === "changed" && change.relativePath === "index.html"),
      "changed event for index.html",
    );
  });

  it("reports a file deleted outside Astra", async () => {
    await rm(join(root, "index.html"));
    await waitFor(
      () => changes.some((change) => change.type === "deleted" && change.relativePath === "index.html"),
      "deleted event for index.html",
    );
  });

  it("reports a new directory and its contents", async () => {
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets", "logo.svg"), "<svg/>");
    await waitFor(
      () =>
        changes.some((change) => change.relativePath === "assets" && change.type === "created") &&
        changes.some((change) => change.relativePath === "assets/logo.svg"),
      "created events for assets/",
    );
  });

  it("stays silent about ignored directories (FR-K02)", async () => {
    await mkdir(join(root, "node_modules"), { recursive: true });
    await writeFile(join(root, "node_modules", "x.js"), "// vendor\n");
    await mkdir(join(root, ".git"));
    await writeFile(join(root, ".git", "HEAD"), "ref\n");
    await settle();
    expect(changes).toEqual([]);
  });

  it("swallows a write Astra announced as its own (FR-G06)", async () => {
    const text = "<p>mine</p>\n";
    // The session's wiring, spoken by the test: announce the in-flight write,
    // register the bytes once they land, close the window.
    watcher.beginWrite("index.html");
    const result = await project.writeTextFile("index.html", text);
    watcher.noteOwnWrite(result.relativePath, result.hash);
    watcher.endWrite("index.html");

    await settle();
    expect(changes).toEqual([]);
  });

  it("hides the .lock sibling of a write that is in flight", async () => {
    // A rescan landing mid-write would otherwise report Astra's own
    // coordination artifact as an external create-and-delete pair.
    watcher.beginWrite("index.html");
    await writeFile(join(root, "index.html.lock"), JSON.stringify({ pid: 1 }));
    await settle();
    await rm(join(root, "index.html.lock"));
    await settle();
    expect(changes).toEqual([]);
  });

  it("still reports a .lock file Astra is not writing", async () => {
    // Not every `*.lock` is ours — a project's own lock files are content.
    await writeFile(join(root, "Cargo.lock"), "version = 3\n");
    await waitFor(
      () => changes.some((change) => change.type === "created" && change.relativePath === "Cargo.lock"),
      "created event for Cargo.lock",
    );
  });

  it("reports an external overwrite that follows our own write", async () => {
    const text = "<p>mine</p>\n";
    watcher.beginWrite("index.html");
    const result = await project.writeTextFile("index.html", text);
    watcher.noteOwnWrite(result.relativePath, result.hash);
    watcher.endWrite("index.html");
    // Let the echo be swallowed first…
    await settle();
    expect(changes).toEqual([]);

    // …then someone else edits the same file. That is a real change and must
    // not be suppressed by a registration we already spent.
    await writeFile(join(root, "index.html"), "<p>theirs</p>\n");
    await waitFor(
      () => changes.some((change) => change.type === "changed" && change.relativePath === "index.html"),
      "changed event after the self-write was spent",
    );
  });

  it("goes quiet after stop()", async () => {
    await watcher.stop();
    await writeFile(join(root, "after.html"), "<p>after</p>\n");
    await settle();
    expect(changes).toEqual([]);
  });
});
