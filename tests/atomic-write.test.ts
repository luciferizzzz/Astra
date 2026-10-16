import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  atomicWrite,
  hashFile,
  hashText,
  SourceLockedError,
  WriteConflictError,
} from "../src/core/sync/atomic-write";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "astra-atomic-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function waitFor(predicate: () => Promise<boolean>, attempts = 100): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("condition was never met");
}

describe("atomicWrite", () => {
  it("writes the file and reports its hash and size", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "file.txt");
      const result = await atomicWrite(path, "hello\n");

      expect(result.path).toBe(path);
      expect(result.bytes).toBe(6);
      expect(result.hash).toBe(hashText("hello\n"));
      expect(await readFile(path, "utf8")).toBe("hello\n");
    });
  });

  it("never leaves a temporary file behind after a successful write", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "clean.txt");
      await atomicWrite(path, "content");

      const leftovers = (await readdir(dir)).filter((name) => name.endsWith(".tmp"));
      expect(leftovers).toEqual([]);
    });
  });

  it("keeps the previous revision in a backup", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "style.css");
      await atomicWrite(path, "a { color: red; }\n");
      const result = await atomicWrite(path, "a { color: blue; }\n");

      expect(result.backupPath).toBe(`${path}.bak`);
      expect(await readFile(`${path}.bak`, "utf8")).toBe("a { color: red; }\n");
      expect(await readFile(path, "utf8")).toBe("a { color: blue; }\n");
    });
  });

  it("can skip the backup", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "nobak.css");
      await atomicWrite(path, "one");
      const result = await atomicWrite(path, "two", { backup: false });

      expect(result.backupPath).toBeUndefined();
      expect(await hashFile(`${path}.bak`)).toBeUndefined();
    });
  });

  it("refuses to clobber a file that changed since it was read", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "doc.html");
      await atomicWrite(path, "<p>v1</p>");
      const stale = (await hashFile(path))!;

      await atomicWrite(path, "<p>v2</p>");

      await expect(atomicWrite(path, "<p>v3</p>", { expectedHash: stale })).rejects.toThrow(
        WriteConflictError,
      );
      // The conflicting write must not have touched the file.
      expect(await readFile(path, "utf8")).toBe("<p>v2</p>");
    });
  });

  it("accepts a write whose expected hash still matches", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "match.txt");
      await atomicWrite(path, "before");
      const current = (await hashFile(path))!;

      await expect(atomicWrite(path, "after", { expectedHash: current })).resolves.toMatchObject({
        path,
      });
      expect(await readFile(path, "utf8")).toBe("after");
    });
  });

  it("excludes a second writer while the first holds the lock", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "locked.txt");
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      const first = atomicWrite(path, "first", {
        hooks: { afterTempWrite: () => held },
      });

      await waitFor(async () => (await hashFile(`${path}.lock`)) !== undefined);
      await expect(atomicWrite(path, "second", { lockStaleMs: 60_000 })).rejects.toThrow(
        SourceLockedError,
      );

      release();
      await expect(first).resolves.toMatchObject({ path });
      expect(await readFile(path, "utf8")).toBe("first");
    });
  });

  it("recovers from a lock left behind by a crashed process", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "stale.txt");
      await writeFile(`${path}.lock`, JSON.stringify({ pid: 999_999, at: Date.now() - 60_000 }));

      const result = await atomicWrite(path, "ok", { lockStaleMs: 1_000 });

      expect(result.path).toBe(path);
      expect(await readFile(path, "utf8")).toBe("ok");
      expect(await hashFile(`${path}.lock`)).toBeUndefined();
    });
  });

  it("removes the temp file when a write fails midway", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "crash.txt");

      await expect(
        atomicWrite(path, "doomed", {
          hooks: {
            beforeRename: () => {
              throw new Error("simulated crash");
            },
          },
        }),
      ).rejects.toThrow("simulated crash");

      const leftovers = (await readdir(dir)).filter((name) => name.endsWith(".tmp"));
      expect(leftovers).toEqual([]);
      expect(await hashFile(path)).toBeUndefined();
    });
  });
});
