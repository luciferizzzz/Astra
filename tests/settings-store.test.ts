import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSettingsStore, SETTINGS_FILE_NAME } from "../src/main/settings-store";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

/**
 * The settings store is the one place in Phase 1 that writes to disk on the
 * user's behalf, so the tests care as much about what it does when the file is
 * broken as when it is fine. A preferences file must never be able to stop the
 * app from starting.
 */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "astra-settings-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

describe("createSettingsStore", () => {
  it("reads the defaults when no file exists yet", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);
      expect(await store.read()).toEqual(DEFAULT_SETTINGS);
    });
  });

  it("persists an update and reads it back", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);

      const saved = await store.update({ theme: "light", fontSize: 16 });
      expect(saved).toEqual({ ...DEFAULT_SETTINGS, theme: "light", fontSize: 16 });

      const onDisk = JSON.parse(await readFile(store.path, "utf8"));
      expect(onDisk).toEqual(saved);
      expect(await createSettingsStore(dir).read()).toEqual(saved);
    });
  });

  it("merges a partial update over the current values", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);

      await store.update({ fontSize: 18 });
      const after = await store.update({ theme: "light" });

      expect(after.fontSize).toBe(18);
      expect(after.theme).toBe("light");
    });
  });

  it("falls back to defaults when the file is not valid JSON", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);
      await writeFile(store.path, "{ this is not json", "utf8");

      expect(await store.read()).toEqual(DEFAULT_SETTINGS);
    });
  });

  it("normalises a hand-edited file, dropping bad and unknown fields", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);
      await writeFile(
        store.path,
        JSON.stringify({ theme: "sepia", fontSize: 42, telemetry: false, mystery: 1 }),
        "utf8",
      );

      const settings = await store.read();
      expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
      expect(settings.telemetry).toBe(false);
      expect(settings).not.toHaveProperty("mystery");
    });
  });

  it("refuses to persist an out-of-range patch, even if one reaches it", async () => {
    await withTempDir(async (dir) => {
      const store = createSettingsStore(dir);

      const saved = await store.update({ fontSize: 999 });

      expect(saved.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
      expect(JSON.parse(await readFile(store.path, "utf8")).fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    });
  });

  it("creates the directory when it is missing", async () => {
    await withTempDir(async (dir) => {
      const nested = join(dir, "userData");
      const store = createSettingsStore(nested);

      await store.update({ theme: "dark" });

      expect(JSON.parse(await readFile(join(nested, SETTINGS_FILE_NAME), "utf8")).theme).toBe("dark");
    });
  });

  it("treats an unreadable path as 'no preferences yet' rather than failing", async () => {
    await withTempDir(async (dir) => {
      // A directory where the file is expected: reading it as a file throws.
      await mkdir(join(dir, SETTINGS_FILE_NAME), { recursive: true });
      const store = createSettingsStore(dir);

      expect(await store.read()).toEqual(DEFAULT_SETTINGS);
    });
  });
});
