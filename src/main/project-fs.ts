/**
 * The project filesystem — Astra's only door to a user's files.
 *
 * This is module 3 of the architecture (PRD §11.1, "Filesystem Adapter"): a
 * scope-checked window onto one project root, used by every higher layer. Its
 * contract is deliberately narrow — list, read, write, snapshot, hash — and
 * every operation is answered relative to the root, never to an absolute path
 * the renderer chose.
 *
 * Invariants:
 *
 *   - **Scoped.** Paths are normalised by `project-paths` and containment is
 *     verified against `realpath`, so neither `..` nor a symlink can reach a
 *     byte outside the root (SEC-003, SEC-013).
 *   - **Honest about writes.** Every write goes through the Phase 0
 *     atomic-write primitive, so a crash mid-save leaves the old file or the
 *     new one, never a half-written one. A write whose `expectedHash` no
 *     longer matches the disk raises `WriteConflictError` instead of
 *     clobbering someone else's edit (SEC-008).
 *   - **Pure Node.** No `electron` import, so the whole module is unit-testable
 *     against a temporary directory.
 */

import { createHash } from "node:crypto";
import { promises as fs, type Dirent, type Stats } from "node:fs";
import { realpath } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWrite, hashFile, WriteConflictError } from "../core/sync/atomic-write";
import type { ProjectFileContents, ProjectListEntry } from "../shared/ipc";
import {
  isIgnoredName,
  isIgnoredPath,
  isWithinRoot,
  joinUnderRoot,
  normalizeRelativePath,
  toPosixPath,
  UnsafePathError,
} from "./project-paths";

// The wire contract in `shared/ipc` is the source of truth; these aliases keep
// the adapter's surface readable without restating the shapes.
export type { ProjectFileContents, ProjectListEntry };

export interface ProjectWriteResult {
  readonly relativePath: string;
  /** SHA-256 of the bytes written. */
  readonly hash: string;
  readonly bytes: number;
}

/** Cheap per-entry facts, taken in one walk. The watcher diffs these. */
export interface ProjectSnapshotEntry {
  readonly kind: "file" | "directory";
  readonly size: number;
  readonly mtimeMs: number;
}

/** relativePath → facts, covering the whole project except ignored directories. */
export type ProjectSnapshot = ReadonlyMap<string, ProjectSnapshotEntry>;

/** Raised for any path the adapter refuses or cannot find. */
export class ProjectPathError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProjectPathError";
  }
}

export interface ProjectFileSystem {
  /** The canonical (realpath) project root. */
  readonly root: string;
  /** Sorted listing of one directory. `relativePath` defaults to the root. */
  list(relativePath?: string): Promise<ProjectListEntry[]>;
  /** Reads a file as UTF-8 with the hash of the bytes actually on disk. */
  readTextFile(relativePath: string): Promise<ProjectFileContents>;
  /**
   * Writes a file atomically. With `expectedHash`, a file that changed on disk
   * since it was read raises `WriteConflictError` rather than being replaced.
   */
  writeTextFile(
    relativePath: string,
    text: string,
    expectedHash?: string,
  ): Promise<ProjectWriteResult>;
  /** One walk over the project, excluding ignored directories. */
  snapshot(): Promise<ProjectSnapshot>;
  /** SHA-256 of a file, or `undefined` when it does not exist. */
  hashOf(relativePath: string): Promise<string | undefined>;
}

/**
 * Opens the project rooted at `rootPath`, refusing anything that is not a
 * real directory. The root is canonicalised once, here, so every later check
 * compares against the same resolved path the operating system will use.
 */
export async function openProjectFileSystem(rootPath: string): Promise<ProjectFileSystem> {
  if (typeof rootPath !== "string" || rootPath.trim() === "") {
    throw new ProjectPathError("project root must be a non-empty path");
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(rootPath);
  } catch {
    throw new ProjectPathError(`project root does not exist: "${rootPath}"`);
  }

  const stats = await fs.stat(canonicalRoot).catch(() => undefined);
  if (stats === undefined || !stats.isDirectory()) {
    throw new ProjectPathError(`project root is not a directory: "${rootPath}"`);
  }

  return createFileSystem(canonicalRoot);
}

function createFileSystem(root: string): ProjectFileSystem {
  /**
   * The adapter's single verdict on caller-supplied paths: the normaliser's
   * refusal, restated in the error type every caller of this module catches.
   */
  function normalizeOrRefuse(input: unknown): string {
    try {
      return normalizeRelativePath(input);
    } catch (error) {
      if (error instanceof UnsafePathError) throw new ProjectPathError(error.message);
      throw error;
    }
  }

  /**
   * Resolves a caller-supplied path to an absolute one, verifying that its
   * nearest *existing* canonical ancestor is still inside the root.
   *
   * Checking the existing ancestor (rather than the path itself) is what makes
   * both reads and creates safe: a file that does not exist yet has no
   * `realpath`, but the directory that will hold it does — and if that
   * directory is a symlink out of the project, the check fails before
   * anything is touched.
   */
  async function resolveScoped(relativePath: string): Promise<string> {
    const normalized = normalizeOrRefuse(relativePath);
    const candidate = joinUnderRoot(root, normalized);

    let existing = candidate;
    const missing: string[] = [];
    // Walk up until an ancestor actually exists. The loop is bounded by the
    // depth of the path, which `normalizeRelativePath` has already capped.
    for (;;) {
      try {
        const canonical = await realpath(existing);
        if (!isWithinRoot(root, canonical)) {
          throw new UnsafePathError(`path escapes the project via a symlink ("${relativePath}")`);
        }
        // Re-attach the not-yet-existing tail; none of its segments can be
        // `..`, because the normaliser already rejected them.
        return missing.length === 0 ? canonical : joinUnderRoot(canonical, missing.join("/"));
      } catch (error) {
        if (error instanceof UnsafePathError) throw new ProjectPathError(error.message);
        const parent = dirname(existing);
        if (parent === existing) {
          throw new ProjectPathError(`path is not inside the project: "${relativePath}"`);
        }
        missing.unshift(existing.slice(parent.length + 1));
        existing = parent;
      }
    }
  }

  async function list(relativePath: string = "."): Promise<ProjectListEntry[]> {
    const directory = relativePath === "." ? root : await resolveScoped(relativePath);

    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      throw new ProjectPathError(`cannot read directory "${relativePath}": ${describeFsError(error)}`);
    }

    const base = relativePath === "." ? "" : `${normalizeOrRefuse(relativePath)}/`;
    return entries
      .filter((entry) => !isIgnoredName(entry.name))
      .map((entry) => ({
        name: entry.name,
        relativePath: `${base}${toPosixPath(entry.name)}`,
        kind: entry.isDirectory() ? ("directory" as const) : ("file" as const),
      }))
      .sort(
        (a, b) =>
          // Directories first, then case-insensitive name order: what an
          // explorer tree presents, decided here so every surface agrees.
          Number(a.kind === "file") - Number(b.kind === "file") ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
  }

  async function readTextFile(relativePath: string): Promise<ProjectFileContents> {
    const absolute = await resolveScoped(relativePath);
    // Hash the *bytes*, not the decoded text: `atomicWrite` compares against
    // `hashFile`, and a text hash would silently disagree for any file that is
    // not valid UTF-8 — turning a truthful conflict into a mystery.
    const bytes = await fs.readFile(absolute).catch((error: unknown) => {
      throw new ProjectPathError(`cannot read "${relativePath}": ${describeFsError(error)}`);
    });
    return {
      relativePath: normalizeOrRefuse(relativePath),
      text: bytes.toString("utf8"),
      hash: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  async function writeTextFile(
    relativePath: string,
    text: string,
    expectedHash?: string,
  ): Promise<ProjectWriteResult> {
    const normalized = normalizeOrRefuse(relativePath);
    if (isIgnoredPath(normalized)) {
      throw new ProjectPathError(`refusing to write into an ignored directory: "${normalized}"`);
    }
    const absolute = await resolveScoped(normalized);

    // The parent directory may not exist yet — but only inside the project:
    // `resolveScoped` has already proven the location is contained.
    await fs.mkdir(dirname(absolute), { recursive: true });

    // Backups stay off for project files: a sibling `index.html.bak` would be
    // listed by the explorer, reported by the watcher and swept into the
    // user's version control. The Phase 0 primitive still guarantees the two
    // properties that matter — atomic replace and conflict refusal. A durable
    // backup trail returns later, in its designed home under `.astra/backups`
    // (Synchronization Engine §backup), which is ignored by construction.
    const result = await atomicWrite(absolute, text, { expectedHash, backup: false });
    return {
      relativePath: normalized,
      hash: result.hash,
      bytes: result.bytes,
    };
  }

  /** One `lstat`-free walk: symlinks are reported as plain files and never followed. */
  async function snapshot(): Promise<ProjectSnapshot> {
    const snapshot = new Map<string, ProjectSnapshotEntry>();

    async function walk(directory: string, prefix: string): Promise<void> {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        // A directory removed mid-walk simply is not part of the snapshot; the
        // diff against the previous snapshot will report its contents as gone.
        return;
      }

      for (const entry of entries) {
        if (isIgnoredName(entry.name)) continue;
        const relativePath = `${prefix}${toPosixPath(entry.name)}`;
        let stats: Stats;
        try {
          stats = await fs.stat(`${directory}/${entry.name}`);
        } catch {
          continue; // vanished between readdir and stat; the diff will see it.
        }
        snapshot.set(relativePath, {
          kind: entry.isDirectory() ? "directory" : "file",
          size: stats.size,
          mtimeMs: stats.mtimeMs,
        });
        if (entry.isDirectory()) {
          await walk(`${directory}/${entry.name}`, `${relativePath}/`);
        }
      }
    }

    await walk(root, "");
    return snapshot;
  }

  async function hashOf(relativePath: string): Promise<string | undefined> {
    const absolute = await resolveScoped(relativePath);
    return hashFile(absolute);
  }

  return { root, list, readTextFile, writeTextFile, snapshot, hashOf };
}

function describeFsError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return "unavailable";
}

export { WriteConflictError };
