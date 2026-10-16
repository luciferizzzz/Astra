/**
 * Crash-safe writes.
 *
 * Saving in Astra has to survive the two failures that actually happen on a
 * developer machine: the app being killed mid-save, and another process having
 * changed the file since we read it. The primitive here handles both:
 *
 *   1. The new text is written to a temporary file **in the same directory**,
 *      flushed with `fsync`, and only then renamed over the target. A rename
 *      within one directory is atomic, so a reader sees either the old file or
 *      the new one — never a half-written one.
 *   2. Before writing, the current file's SHA-256 is compared with the hash the
 *      caller captured when it read the document. A mismatch raises
 *      `WriteConflictError` instead of clobbering someone else's edit.
 *
 * A sibling `*.lock` file serialises concurrent saves, and a lock older than
 * `lockStaleMs` is treated as debris from a crashed process and replaced. The
 * lock is always released, including on failure.
 *
 * Windows note: `fs.rename` maps to `MoveFileEx` with replace semantics, so it
 * does overwrite an existing target. Directory `fsync` is not available there
 * and is skipped. See PRD §13.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

/** Injection points used by tests to simulate a crash mid-save. */
export interface AtomicWriteHooks {
  /** Runs after the temp file is written and flushed. */
  afterTempWrite?: (tempPath: string) => void | Promise<void>;
  /** Runs after the backup exists, immediately before the rename. */
  beforeRename?: (tempPath: string) => void | Promise<void>;
  /** Runs after the rename succeeded. */
  afterRename?: () => void | Promise<void>;
}

export interface AtomicWriteOptions {
  /** SHA-256 the caller read earlier; a mismatch raises `WriteConflictError`. */
  expectedHash?: string;
  /** Copy the previous file to `<path>.bak` before replacing it. Default `true`. */
  backup?: boolean;
  /** Test-only crash injection. */
  hooks?: AtomicWriteHooks;
  /** Age after which a leftover lock is considered stale. Default 30s. */
  lockStaleMs?: number;
}

export interface AtomicWriteResult {
  path: string;
  /** SHA-256 of the bytes written. */
  hash: string;
  bytes: number;
  /** Present when a backup was written. */
  backupPath?: string;
}

/** Thrown when the file on disk no longer matches what the caller read. */
export class WriteConflictError extends Error {
  /** The caller's expectation, when it supplied one. */
  readonly expected?: string;
  /** The hash actually found on disk. */
  readonly actual: string;

  constructor(path: string, actual: string, expected?: string) {
    super(
      expected === undefined
        ? `"${path}" changed on disk since it was read.`
        : `"${path}" changed on disk: expected ${expected}, found ${actual}.`,
    );
    this.name = "WriteConflictError";
    this.expected = expected;
    this.actual = actual;
  }
}

/** Thrown when another process holds the write lock for a file. */
export class SourceLockedError extends Error {
  constructor(path: string) {
    super(`"${path}" is locked by another Astra save.`);
    this.name = "SourceLockedError";
  }
}

const DEFAULT_LOCK_STALE_MS = 30_000;

/** SHA-256 of a string, hex encoded. */
export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** SHA-256 of a file, hex encoded. Returns `undefined` when it does not exist. */
export async function hashFile(path: string): Promise<string | undefined> {
  try {
    const contents = await fs.readFile(path);
    return createHash("sha256").update(contents).digest("hex");
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Writes `contents` over `path` atomically, refusing to clobber a file that
 * changed since the caller read it.
 */
export async function atomicWrite(
  path: string,
  contents: string,
  options: AtomicWriteOptions = {},
): Promise<AtomicWriteResult> {
  return withFileLock(
    path,
    async () => {
      if (options.expectedHash !== undefined) {
        const actual = await hashFile(path);
        if (actual !== options.expectedHash) {
          throw new WriteConflictError(path, actual ?? "<missing>", options.expectedHash);
        }
      }

      const directory = dirname(path);
      const tempPath = temporaryPath(path);
      let backupPath: string | undefined;

      try {
        await writeAndFlush(tempPath, contents);
        await options.hooks?.afterTempWrite?.(tempPath);

        if (options.backup !== false) {
          const existing = await hashFile(path);
          if (existing !== undefined) {
            backupPath = `${path}.bak`;
            await fs.copyFile(path, backupPath);
          }
        }

        await options.hooks?.beforeRename?.(tempPath);
        await fs.rename(tempPath, path);
        await syncDirectory(directory);
        await options.hooks?.afterRename?.();
      } catch (error) {
        await removeIfPresent(tempPath);
        throw error;
      }

      const result: AtomicWriteResult = {
        path,
        hash: hashText(contents),
        bytes: Buffer.byteLength(contents, "utf8"),
      };
      if (backupPath !== undefined) {
        result.backupPath = backupPath;
      }
      return result;
    },
    options.lockStaleMs,
  );
}

/**
 * Runs `fn` while holding an exclusive lock for `path`.
 *
 * The lock is a sibling `*.lock` file created with the exclusive flag, so a
 * second writer fails immediately rather than interleaving writes. A lock older
 * than `staleMs` is assumed to belong to a process that died and is replaced.
 */
export async function withFileLock<T>(
  path: string,
  fn: () => Promise<T>,
  staleMs: number = DEFAULT_LOCK_STALE_MS,
): Promise<T> {
  const lockPath = `${path}.lock`;
  await fs.mkdir(dirname(path), { recursive: true });

  await acquireLock(lockPath, path, staleMs);
  try {
    return await fn();
  } finally {
    await removeIfPresent(lockPath);
  }
}

async function acquireLock(lockPath: string, target: string, staleMs: number): Promise<void> {
  try {
    await createLock(lockPath);
    return;
  } catch (error) {
    if (!isAlreadyExists(error) || !(await isStale(lockPath, staleMs))) {
      throw new SourceLockedError(target);
    }
  }

  // The previous holder is gone. Clear the debris and take the lock.
  await removeIfPresent(lockPath);
  await createLock(lockPath);
}

function createLock(lockPath: string): Promise<void> {
  return fs.writeFile(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), {
    flag: "wx",
  });
}

async function writeAndFlush(path: string, contents: string): Promise<void> {
  const handle = await fs.open(path, "w");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function isStale(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === "number" ? Date.now() - parsed.at > staleMs : true;
  } catch {
    // An unreadable or malformed lock cannot be trusted; treat it as stale so a
    // crashed save does not lock the file forever.
    return true;
  }
}

function temporaryPath(path: string): string {
  const suffix = Math.random().toString(36).slice(2);
  return join(dirname(path), `.${process.pid}.${suffix}.tmp`);
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === "win32") {
    // Node cannot fsync a directory on Windows. The rename itself is still
    // ordered by the filesystem, so this is a durability nicety, not a
    // correctness requirement.
    return;
  }
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch {
    // Best effort only: failing to flush the directory must not fail a save
    // whose rename already succeeded.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "EEXIST";
}
