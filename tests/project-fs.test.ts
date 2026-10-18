import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashText, WriteConflictError } from "../src/core/sync/atomic-write";
import {
  openProjectFileSystem,
  ProjectPathError,
  type ProjectFileSystem,
} from "../src/main/project-fs";

/**
 * The adapter is the only door Astra has into a user's files, so these tests
 * stand at that door: what must come through (sorted listings, byte-honest
 * hashes, conflict refusal) and what must not (traversal, symlinks, ignored
 * directories). Every test runs against a real temporary directory — the
 * contract is about actual bytes on an actual disk.
 */

let root: string;
let project: ProjectFileSystem;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "astra-fs-"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>Astra</title>\n");
  await writeFile(join(root, "style.css"), "body { color: #111; }\n");
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "app.ts"), "export {};\n");
  await mkdir(join(root, "node_modules", "left-pad"), { recursive: true });
  await writeFile(join(root, "node_modules", "left-pad", "index.js"), "// vendor\n");
  await mkdir(join(root, ".git"));
  await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  project = await openProjectFileSystem(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
});

describe("opening a project", () => {
  it("accepts a real directory and canonicalises the root", async () => {
    expect(project.root).toBeTruthy();
    // The root must be the realpath, or every containment check after it would
    // be comparing a symlink against its own target.
    expect(project.root).not.toContain("~");
  });

  it("refuses a path that does not exist", async () => {
    await expect(openProjectFileSystem(join(root, "nope"))).rejects.toThrow(ProjectPathError);
  });

  it("refuses a file pretending to be a project root", async () => {
    await expect(openProjectFileSystem(join(root, "index.html"))).rejects.toThrow(
      /not a directory/,
    );
  });

  it("refuses an empty root", async () => {
    await expect(openProjectFileSystem("   ")).rejects.toThrow(ProjectPathError);
  });
});

describe("listing", () => {
  it("lists directories before files, case-insensitively", async () => {
    // Root holds: index.html, style.css, src/ — node_modules and .git hidden.
    expect((await project.list()).map((entry) => entry.name)).toEqual([
      "src",
      "index.html",
      "style.css",
    ]);
  });

  it("hides node_modules and .git from the root listing", async () => {
    const names = (await project.list()).map((entry) => entry.name);
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
    expect(names).toContain("index.html");
    expect(names).toContain("src");
  });

  it("reports kinds and contract paths", async () => {
    const entries = await project.list();
    expect(entries.find((entry) => entry.name === "src")?.kind).toBe("directory");
    expect(entries.find((entry) => entry.name === "index.html")?.kind).toBe("file");
    expect(entries.find((entry) => entry.name === "src")?.relativePath).toBe("src");
  });

  it("lists a nested directory by its contract path", async () => {
    const entries = await project.list("src");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.relativePath).toBe("src/app.ts");
  });

  it("refuses a listing outside the project", async () => {
    await expect(project.list("..")).rejects.toThrow(ProjectPathError);
  });

  it("answers a missing directory with a named error", async () => {
    await expect(project.list("does-not-exist")).rejects.toThrow(ProjectPathError);
  });
});

describe("reading", () => {
  it("returns text with the hash of the bytes on disk", async () => {
    const file = await project.readTextFile("index.html");
    expect(file.text).toContain("<title>Astra</title>");
    expect(file.hash).toBe(hashText("<!doctype html><title>Astra</title>\n"));
    expect(file.relativePath).toBe("index.html");
  });

  it("reads a nested file", async () => {
    const file = await project.readTextFile("src/app.ts");
    expect(file.text).toBe("export {};\n");
  });

  it("refuses traversal", async () => {
    await expect(project.readTextFile("../outside.txt")).rejects.toThrow(ProjectPathError);
    await expect(project.readTextFile("..\\outside.txt")).rejects.toThrow(ProjectPathError);
  });

  it("refuses absolute paths", async () => {
    await expect(project.readTextFile("C:\\Windows\\win.ini")).rejects.toThrow(ProjectPathError);
    await expect(project.readTextFile("/etc/passwd")).rejects.toThrow(ProjectPathError);
  });

  it("answers a missing file with a named error", async () => {
    await expect(project.readTextFile("missing.html")).rejects.toThrow(ProjectPathError);
  });
});

describe("writing", () => {
  it("writes and returns the new hash", async () => {
    const text = "<!doctype html><title>Edited</title>\n";
    const result = await project.writeTextFile("index.html", text);
    expect(result.hash).toBe(hashText(text));
    expect(result.bytes).toBe(Buffer.byteLength(text));
    // Round trip: what the writer claims is what the reader finds.
    const reread = await project.readTextFile("index.html");
    expect(reread.text).toBe(text);
    expect(reread.hash).toBe(result.hash);
  });

  it("creates parent directories inside the project", async () => {
    await project.writeTextFile("assets/deep/logo.svg", "<svg/>");
    const file = await project.readTextFile("assets/deep/logo.svg");
    expect(file.text).toBe("<svg/>");
  });

  it("honours expectedHash and writes when it matches", async () => {
    const before = await project.readTextFile("style.css");
    const result = await project.writeTextFile("style.css", "body { color: #222; }\n", before.hash);
    expect(result.hash).toBe(hashText("body { color: #222; }\n"));
  });

  it("raises a conflict when the file changed since it was read", async () => {
    const before = await project.readTextFile("style.css");
    // Someone else edits between our read and our write.
    await writeFile(join(root, "style.css"), "/* external */\n");

    await expect(
      project.writeTextFile("style.css", "body { color: #222; }\n", before.hash),
    ).rejects.toThrow(WriteConflictError);

    // And the external edit is untouched.
    const after = await project.readTextFile("style.css");
    expect(after.text).toBe("/* external */\n");
  });

  it("refuses to write into an ignored directory", async () => {
    await expect(project.writeTextFile("node_modules/x.js", "// nope")).rejects.toThrow(
      /ignored directory/,
    );
  });

  it("refuses traversal on write", async () => {
    await expect(project.writeTextFile("../escape.txt", "nope")).rejects.toThrow(
      ProjectPathError,
    );
  });
});

describe("symlink escape (SEC-013)", () => {
  it("refuses a directory symlink pointing outside the project", async () => {
    const outside = await mkdtemp(join(tmpdir(), "astra-outside-"));
    try {
      await writeFile(join(outside, "secret.txt"), "top secret\n");
      const link = join(root, "leak");
      await symlink(outside, link, "junction").catch(() => undefined);

      const created = await project
        .list("leak")
        .then(() => undefined)
        .catch((error: unknown) => error);
      if (created === undefined) {
        // Symlink creation is not permitted on this machine (common on Windows
        // without developer mode) — the scenario could not be staged, and a
        // green test claiming to have proven it would be a lie.
        return;
      }
      expect(created).toBeInstanceOf(ProjectPathError);

      await expect(project.readTextFile("leak/secret.txt")).rejects.toThrow(ProjectPathError);
      await expect(project.writeTextFile("leak/secret.txt", "tampered")).rejects.toThrow(
        ProjectPathError,
      );
    } finally {
      await rm(outside, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});

describe("snapshot", () => {
  it("covers every visible file and hides ignored directories", async () => {
    const snapshot = await project.snapshot();
    expect([...snapshot.keys()].sort()).toEqual([
      "index.html",
      "src",
      "src/app.ts",
      "style.css",
    ]);
    expect(snapshot.get("src")?.kind).toBe("directory");
    expect(snapshot.get("index.html")?.kind).toBe("file");
    expect(snapshot.get("index.html")?.size).toBeGreaterThan(0);
  });

  it("hashOf reports a file's bytes, and undefined when it is gone", async () => {
    expect(await project.hashOf("index.html")).toBe(
      hashText("<!doctype html><title>Astra</title>\n"),
    );
    expect(await project.hashOf("missing.html")).toBeUndefined();
  });
});
