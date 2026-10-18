import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashText } from "../src/core/sync/atomic-write";
import type { ProjectFsChange } from "../src/shared/ipc";
import {
  createProjectSession,
  ProjectNotOpenError,
  type ProjectSession,
} from "../src/main/project-session";

/**
 * The session is where the adapter and the watcher stop being two modules and
 * become one behaviour: what a write means to the sensor, and what "no project"
 * means to the IPC surface. These tests pin exactly those two seams.
 */

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function settle(ms = 240): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

let root: string;
let otherRoot: string;
let session: ProjectSession;
let changes: ProjectFsChange[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "astra-session-"));
  otherRoot = await mkdtemp(join(tmpdir(), "astra-session2-"));
  await writeFile(join(root, "index.html"), "<p>one</p>\n");
  await writeFile(join(otherRoot, "other.html"), "<p>other</p>\n");

  changes = [];
  session = createProjectSession({
    onChanges: (batch) => changes.push(...batch),
    watcher: { forcePolling: true, pollIntervalMs: 40, debounceMs: 20 },
  });
});

afterEach(async () => {
  await session.close();
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
  await rm(otherRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe("open and close", () => {
  it("answers an open with the canonical root and its listing", async () => {
    const opened = await session.open(root);
    expect(opened.root).toBe(session.root);
    expect(opened.entries.map((entry) => entry.name)).toEqual(["index.html"]);
    expect((await session.list()).map((entry) => entry.name)).toEqual(["index.html"]);
  });

  it("reports no project while closed", async () => {
    expect(session.root).toBeNull();
    await expect(session.readTextFile("index.html")).rejects.toThrow(ProjectNotOpenError);
    await expect(session.list()).rejects.toThrow(ProjectNotOpenError);
  });

  it("refuses to open a path that is not a directory", async () => {
    await expect(session.open(join(root, "missing"))).rejects.toThrow();
    expect(session.root).toBeNull();
  });

  it("replaces the previous project instead of stacking watchers", async () => {
    await session.open(root);
    await session.open(otherRoot);
    expect(session.root).toBe(otherRoot);

    // The replaced root must be inert: edits there no longer reach the app.
    await writeFile(join(root, "ghost.html"), "<p>ghost</p>\n");
    await settle();
    expect(changes).toEqual([]);

    // And the current root is live.
    await writeFile(join(otherRoot, "live.html"), "<p>live</p>\n");
    await waitFor(
      () => changes.some((change) => change.relativePath === "live.html"),
      "event from the current project",
    );
  });

  it("closing silences the watcher and reopens cleanly", async () => {
    await session.open(root);
    await session.close();
    expect(session.root).toBeNull();

    await writeFile(join(root, "after-close.html"), "<p>after</p>\n");
    await settle();
    expect(changes).toEqual([]);

    // The file written while closed is a real file — reopening must see it.
    const reopened = await session.open(root);
    expect(reopened.entries.map((entry) => entry.name)).toEqual([
      "after-close.html",
      "index.html",
    ]);
  });
});

describe("reads and writes", () => {
  beforeEach(async () => {
    await session.open(root);
  });

  it("reads through the adapter", async () => {
    const file = await session.readTextFile("index.html");
    expect(file.text).toBe("<p>one</p>\n");
    expect(file.hash).toBe(hashText("<p>one</p>\n"));
  });

  it("writes, and does not report its own write back (FR-G06)", async () => {
    const before = await session.readTextFile("index.html");
    await session.writeTextFile("index.html", "<p>two</p>\n", before.hash);

    await settle();
    expect(changes).toEqual([]);

    // The bytes really did change — the sensor was quiet, not blind.
    const after = await session.readTextFile("index.html");
    expect(after.text).toBe("<p>two</p>\n");
  });

  it("reports an external edit to a file Astra also wrote", async () => {
    const before = await session.readTextFile("index.html");
    await session.writeTextFile("index.html", "<p>two</p>\n", before.hash);
    await settle();
    expect(changes).toEqual([]);

    await writeFile(join(root, "index.html"), "<p>external</p>\n");
    await waitFor(
      () => changes.some((change) => change.type === "changed" && change.relativePath === "index.html"),
      "external change after our write",
    );
  });

  it("carries a conflict out to the caller instead of clobbering", async () => {
    const before = await session.readTextFile("index.html");
    await writeFile(join(root, "index.html"), "<p>external</p>\n");
    await expect(
      session.writeTextFile("index.html", "<p>mine</p>\n", before.hash),
    ).rejects.toThrow(/changed on disk/);
  });
});
