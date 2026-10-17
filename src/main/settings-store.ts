/**
 * The persisted user settings file.
 *
 * Astra keeps preferences in a single JSON document next to its other per-user
 * data (Electron's `userData` directory) — no database, because no requirement
 * justifies one (PRD §11.4). The store is deliberately small and, more
 * importantly, deliberately forgiving on read and strict on write:
 *
 *   - **Reading** never throws. A file an older build wrote, or one a user
 *     edited by hand, is normalised field by field and anything unreadable
 *     falls back to the default. A settings file must not be able to stop the
 *     app from starting.
 *   - **Writing** goes through the Phase 0 atomic-write primitive, so a crash
 *     mid-save leaves either the old file or the new one — never a truncated
 *     one. Settings are not worth a `*.bak` trail, so backups are off.
 *
 * Pure Node (no `electron`), so it is unit-testable against a temporary
 * directory. See PRD FR-A05, §11.4.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "../core/sync/atomic-write";
import { DEFAULT_SETTINGS, normalizeSettings, type AstraSettings } from "../shared/settings";

export interface SettingsStore {
  /** The current settings, normalised. Never throws. */
  read(): Promise<AstraSettings>;
  /** Applies `patch`, persists it, and returns the whole settings object. */
  update(patch: Partial<AstraSettings>): Promise<AstraSettings>;
  /** Absolute path of the backing file, for diagnostics. */
  readonly path: string;
}

export const SETTINGS_FILE_NAME = "settings.json";

export function createSettingsStore(directory: string): SettingsStore {
  const path = join(directory, SETTINGS_FILE_NAME);

  async function read(): Promise<AstraSettings> {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      // Missing, unreadable, or a directory where a file was expected: all mean
      // "no preferences yet", which is exactly the defaults.
      return DEFAULT_SETTINGS;
    }

    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      // Not valid JSON. Keep the bytes on disk (the next write backs them over)
      // and run on the defaults rather than refusing to open the app.
      return DEFAULT_SETTINGS;
    }
  }

  async function update(patch: Partial<AstraSettings>): Promise<AstraSettings> {
    // Re-normalise the merge so a caller cannot persist an invalid value even if
    // it somehow reached this far: the file on disk is normalised on the way in.
    const current = await read();
    const next = normalizeSettings({ ...current, ...patch });
    await atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`, { backup: false });
    return next;
  }

  return { read, update, path };
}
