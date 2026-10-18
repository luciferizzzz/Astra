/**
 * External-change detection for the open project.
 *
 * The watcher is the sensor half of the synchronization engine (FR-G02,
 * FR-G06): it reports that *something* changed on disk so the sync layer can
 * decide what it means — quiet reload, or a conflict prompt. It never decides
 * that on its own, and it never writes anything.
 *
 * Two deliberate distrusts shape the design:
 *
 *   1. **The OS events are not trusted as verdicts.** `fs.watch` renames,
 *      duplicates and drops events — on Windows it often reports only
 *      directories, and a "rename" may mean create *or* delete. So the events
 *      are used only as a *wakeup*, and the truth is taken from a rescan: a
 *      snapshot walk diffed against the previous one. A polling loop uses the
 *      exact same rescan, which also serves as the fallback when `fs.watch`
 *      cannot be established at all (PRD §10.5 — "fs.watch + poll fallback").
 *   2. **A write Astra made itself is not a change by someone else.** Every
 *      self-write registers the hash it put on disk; a rescan that finds those
 *      exact bytes swallows the event and clears the registration. That is
 *      FR-G06 (no echo, no loop) at the sensor level — the sync layer stays
 *      free of "did I do this?" bookkeeping.
 *
 * Change detection compares size and mtime, which is cheap and can in theory
 * miss a same-size, same-mtime edit. That is acceptable *here* because the
 * sync layer verifies content by hash before acting on any report. The
 * watcher's job is to be timely; verification is someone else's job.
 */

import { watch, type FSWatcher } from "node:fs";
import type { ProjectFileSystem, ProjectSnapshot, ProjectSnapshotEntry } from "./project-fs";
import { baseOfLockSibling, isLockSibling } from "./project-paths";

export type FsChangeType = "created" | "changed" | "deleted";

export interface FsChange {
  readonly type: FsChangeType;
  /** Forward-slash path relative to the project root. */
  readonly relativePath: string;
  readonly kind: "file" | "directory";
}

export type WatcherMode = "native" | "poll";

export interface ProjectWatcherOptions {
  /** Coalescing window for bursts of wakeups. Default 120ms. */
  debounceMs?: number;
  /** Rescan period when running in poll mode. Default 2000ms. */
  pollIntervalMs?: number;
  /** Force the polling loop instead of `fs.watch` (also used by tests). */
  forcePolling?: boolean;
  /** Called once per batch of verified changes, in snapshot order. */
  onChanges: (changes: readonly FsChange[]) => void;
  /** Called once if `fs.watch` fails and the watcher fell back to polling. */
  onFallback?: (reason: string) => void;
}

export interface ProjectWatcher {
  /** Takes the baseline snapshot and starts watching. */
  start(): Promise<void>;
  /** Stops watching and forgets pending work. Idempotent. */
  stop(): Promise<void>;
  /** Announces a write Astra is about to make, so its `.lock` sibling is ignored. */
  beginWrite(relativePath: string): void;
  /** Ends the in-flight window opened by `beginWrite`. */
  endWrite(relativePath: string): void;
  /** Registers bytes Astra itself just wrote, so the next rescan ignores them. */
  noteOwnWrite(relativePath: string, hash: string): void;
  /** `"native"` once `fs.watch` is established, `"poll"` otherwise. */
  readonly mode: WatcherMode | "stopped";
}

export function createProjectWatcher(
  project: ProjectFileSystem,
  options: ProjectWatcherOptions,
): ProjectWatcher {
  const debounceMs = options.debounceMs ?? 120;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;

  /** Baseline the next rescan is diffed against. */
  let baseline: ProjectSnapshot = new Map();
  /** relativePath → hash Astra wrote; matching bytes at rescan are swallowed. */
  const ownWrites = new Map<string, string>();
  /** Files Astra is writing *right now*; their `.lock` siblings are invisible. */
  const pendingWrites = new Set<string>();

  let watcher: FSWatcher | undefined;
  let pollTimer: NodeJS.Timeout | undefined;
  let debounceTimer: NodeJS.Timeout | undefined;
  let rescanning = false;
  /** Set when a wakeup arrives mid-rescan, so the change is not lost. */
  let rescanQueued = false;
  let mode: ProjectWatcher["mode"] = "stopped";

  function scheduleRescan(): void {
    if (mode === "stopped") return;
    // A single timer for the whole watcher: a save storm (editor + formatter +
    // git) must produce one rescan, not one per event.
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void rescan();
    }, debounceMs);
  }

  async function rescan(): Promise<void> {
    if (rescanning) {
      rescanQueued = true;
      return;
    }
    rescanning = true;
    try {
      const next = await project.snapshot();
      const changes = await verifiedChanges(next);
      baseline = next;
      if (changes.length > 0) options.onChanges(changes);
    } finally {
      rescanning = false;
      if (rescanQueued) {
        rescanQueued = false;
        scheduleRescan();
      }
    }
  }

  /**
   * Diffs and then *verifies*: a reported change whose bytes match a
   * registered self-write is our own echo and is dropped.
   */
  async function verifiedChanges(next: ProjectSnapshot): Promise<FsChange[]> {
    const changes = diffSnapshots(baseline, next);
    if (ownWrites.size === 0 && pendingWrites.size === 0) return changes;

    // The suppression bases are taken once for the whole batch: a single
    // rescan can swallow a self-write *and* observe its vanished `.lock`
    // sibling, and the lock's verdict must see the registration as it was at
    // the start of the batch — not as the loop happens to leave it.
    const selfManaged = new Set<string>([...ownWrites.keys(), ...pendingWrites]);

    const verified: FsChange[] = [];
    for (const change of changes) {
      // While a write to this exact file is in flight, Astra is the only
      // possible author of whatever just happened to it — a rescan landing
      // between the rename and the write's resolution must not report our own
      // half-announced work as an external change.
      if (pendingWrites.has(change.relativePath)) {
        continue;
      }

      // The `<file>.lock` sibling is Astra's coordination artifact, created
      // and removed inside one write — never project content. It is suppressed
      // only while its base file belongs to a write in flight or not yet
      // swallowed; a `Cargo.lock` Astra never wrote stays fully visible.
      if (
        isLockSibling(change.relativePath) &&
        selfManaged.has(baseOfLockSibling(change.relativePath))
      ) {
        continue;
      }

      const ownHash = ownWrites.get(change.relativePath);
      if (ownHash === undefined || change.type === "deleted") {
        verified.push(change);
        continue;
      }
      const actual = await project.hashOf(change.relativePath).catch(() => undefined);
      if (actual === ownHash) {
        // Exactly the bytes we wrote. The echo ends here.
        ownWrites.delete(change.relativePath);
        continue;
      }
      // Someone wrote over our write between the write and the rescan — a real
      // external change, and the registration must not swallow the next one.
      ownWrites.delete(change.relativePath);
      verified.push(change);
    }
    return verified;
  }

  return {
    get mode() {
      return mode;
    },

    async start(): Promise<void> {
      if (mode !== "stopped") return;
      baseline = await project.snapshot();

      if (!options.forcePolling) {
        try {
          watcher = watch(project.root, { recursive: true }, () => scheduleRescan());
          mode = "native";
        } catch (error) {
          options.onFallback?.(describeWatchError(error));
        }
      }

      if (mode !== "native") {
        mode = "poll";
        pollTimer = setInterval(scheduleRescan, pollIntervalMs);
        // Not unref'd: the watcher is part of the app's lifetime while a
        // project is open, and quitting goes through `stop()`.
      }
    },

    async stop(): Promise<void> {
      mode = "stopped";
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
      const current = watcher;
      watcher = undefined;
      rescanQueued = false;
      ownWrites.clear();
      pendingWrites.clear();
      // `FSWatcher.close()` is synchronous in Node's typings: it stops
      // delivering events before it returns, so there is nothing to await.
      current?.close();
    },

    beginWrite(relativePath: string): void {
      pendingWrites.add(relativePath);
    },

    endWrite(relativePath: string): void {
      pendingWrites.delete(relativePath);
    },

    noteOwnWrite(relativePath: string, hash: string): void {
      ownWrites.set(relativePath, hash);
    },
  };
}

/**
 * Diffs two snapshots into the changes a human would name: a file that
 * appeared, grew or shrank, or went away. A directory that changed identity
 * (file ↔ directory) is reported as a deletion of the old kind followed by a
 * creation of the new one, so consumers never see a shape change smuggled in
 * as an edit.
 */
export function diffSnapshots(
  previous: ReadonlyMap<string, ProjectSnapshotEntry>,
  next: ReadonlyMap<string, ProjectSnapshotEntry>,
): FsChange[] {
  const changes: FsChange[] = [];

  for (const [relativePath, was] of previous) {
    const now = next.get(relativePath);
    if (now === undefined) {
      changes.push({ type: "deleted", relativePath, kind: was.kind });
      continue;
    }
    if (now.kind !== was.kind) {
      changes.push({ type: "deleted", relativePath, kind: was.kind });
      changes.push({ type: "created", relativePath, kind: now.kind });
      continue;
    }
    if (was.kind === "file" && (now.size !== was.size || now.mtimeMs !== was.mtimeMs)) {
      changes.push({ type: "changed", relativePath, kind: "file" });
    }
  }

  for (const relativePath of next.keys()) {
    if (!previous.has(relativePath)) {
      const entry = next.get(relativePath);
      if (entry !== undefined) {
        changes.push({ type: "created", relativePath, kind: entry.kind });
      }
    }
  }

  return changes.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function describeWatchError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return error instanceof Error ? error.message : "unknown error";
}
