/**
 * The open project: one adapter, one watcher, and the wiring between them.
 *
 * The main process may hold exactly one project at a time (OQ-007: "one in
 * MVP"). The session owns both halves and answers for their coordination:
 *
 *   - Opening replaces whatever was open, so "switch project" cannot leave a
 *     watcher running against a root nobody is looking at.
 *   - A successful write is registered with the watcher as a self-write, which
 *     is how FR-G06 (one edit → one write, no echo) reaches the filesystem
 *     layer without every caller having to remember to announce itself.
 *   - Verified external changes are handed to `onChanges`, which the entry
 *     point forwards to the renderer. The session makes no policy about what
 *     they mean; that is the sync layer's decision (FR-G02/G04).
 *
 * Pure Node, so the whole coordination contract is unit-testable.
 */

import type {
  ProjectFileContents,
  ProjectFileSystem,
  ProjectListEntry,
  ProjectWriteResult,
} from "./project-fs";
import { openProjectFileSystem } from "./project-fs";
import { createProjectWatcher, type FsChange, type ProjectWatcher } from "./project-watcher";

/** What `projectOpen` answers with. */
export interface ProjectOpenResult {
  /** Canonical root, so the renderer never has to guess how it was resolved. */
  readonly root: string;
  /** Listing of the root directory, ready for the explorer. */
  readonly entries: readonly ProjectListEntry[];
}

export interface ProjectSessionDeps {
  onChanges: (changes: readonly FsChange[]) => void;
  /** Forwarded a watcher fallback, for diagnostics. */
  onWatcherFallback?: (reason: string) => void;
  /** Watcher tuning, passed through — tests shorten the debounce. */
  watcher?: { debounceMs?: number; pollIntervalMs?: number; forcePolling?: boolean };
}

export interface ProjectSession {
  /** Opens `rootPath`, replacing any project already open. */
  open(rootPath: string): Promise<ProjectOpenResult>;
  /** Closes the project and stops its watcher. Safe to call when closed. */
  close(): Promise<void>;
  list(relativePath?: string): Promise<ProjectListEntry[]>;
  readTextFile(relativePath: string): Promise<ProjectFileContents>;
  writeTextFile(
    relativePath: string,
    text: string,
    expectedHash?: string,
  ): Promise<ProjectWriteResult>;
  /** The canonical root of the open project, or `null`. */
  readonly root: string | null;
}

/** Raised when an operation needs an open project and there is none. */
export class ProjectNotOpenError extends Error {
  constructor() {
    super("No project is open.");
    this.name = "ProjectNotOpenError";
  }
}

export function createProjectSession(deps: ProjectSessionDeps): ProjectSession {
  let project: ProjectFileSystem | undefined;
  let watcher: ProjectWatcher | undefined;

  async function requireOpen(): Promise<ProjectFileSystem> {
    if (project === undefined) throw new ProjectNotOpenError();
    return project;
  }

  return {
    get root() {
      return project?.root ?? null;
    },

    async open(rootPath: string): Promise<ProjectOpenResult> {
      // Replace first: two open projects would mean two watchers, and only one
      // of them would ever be told about.
      await this.close();

      const opened = await openProjectFileSystem(rootPath);
      const openedWatcher = createProjectWatcher(opened, {
        ...deps.watcher,
        onChanges: deps.onChanges,
        ...(deps.onWatcherFallback !== undefined
          ? { onFallback: deps.onWatcherFallback }
          : {}),
      });

      project = opened;
      watcher = openedWatcher;
      await openedWatcher.start();

      return { root: opened.root, entries: await opened.list() };
    },

    async close(): Promise<void> {
      const current = watcher;
      watcher = undefined;
      project = undefined;
      if (current !== undefined) await current.stop();
    },

    async list(relativePath?: string): Promise<ProjectListEntry[]> {
      const opened = await requireOpen();
      return opened.list(relativePath);
    },

    async readTextFile(relativePath: string): Promise<ProjectFileContents> {
      const opened = await requireOpen();
      return opened.readTextFile(relativePath);
    },

    async writeTextFile(
      relativePath: string,
      text: string,
      expectedHash?: string,
    ): Promise<ProjectWriteResult> {
      const opened = await requireOpen();
      // The write and its artifacts (`.lock` sibling, temp file) are ours
      // before the first byte moves — a rescan that lands mid-write must not
      // mistake our coordination debris for an external change.
      watcher?.beginWrite(relativePath);
      try {
        const result = await opened.writeTextFile(relativePath, text, expectedHash);
        // Announce our own bytes before anyone can observe the watcher's view
        // of them: the registration is what keeps the sync layer from
        // mistaking our save for an external edit.
        watcher?.noteOwnWrite(result.relativePath, result.hash);
        return result;
      } finally {
        watcher?.endWrite(relativePath);
      }
    },
  };
}
