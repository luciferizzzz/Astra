import { create } from "zustand";
import { detectEntryPoint } from "../../../shared/entry-point";
import { MENU_COMMANDS } from "../../../shared/ipc";
import type { ProjectFsChange, ProjectListEntry } from "../../../shared/ipc";
import { bridge } from "./bridge";
import type { AppState } from "./app-store";

/** Directory key for the project root. */
export const ROOT_DIRECTORY = "" as const;

export type FileIssue = "unavailable" | null;

export interface OpenProjectFile {
  readonly relativePath: string;
  readonly text: string;
  readonly hash: string;
}

export interface ProjectStoreState {
  readonly root: string | null;
  readonly name: string | null;
  readonly entriesByDirectory: Readonly<Record<string, readonly ProjectListEntry[]>>;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly selectedPath: string | null;
  readonly openFile: OpenProjectFile | null;
  /**
   * The project's entry page (`index.html`, else `index.htm`), or `null`.
   *
   * Derived from the root listing rather than stored separately, so it cannot
   * drift: any refresh of the root — open, hydrate, or a watcher event that
   * created/deleted the entry — recomputes it here.
   */
  readonly entryPoint: string | null;
  /** Set when the open file vanished or became unreadable (FR-B06). */
  readonly fileIssue: FileIssue;
  /** A short, non-blocking message about the last external change (FR-B05). */
  readonly notice: string | null;
  readonly opening: boolean;
  readonly error: string | null;

  hydrate: () => Promise<void>;
  subscribeToFs: () => () => void;
  openProject: () => Promise<void>;
  openProjectAt: (rootPath: string) => Promise<void>;
  closeProject: () => Promise<void>;
  /** Opens the entry page in the code editor. No-op when there is none. */
  openEntryPoint: () => Promise<void>;
  toggleDirectory: (relativePath: string) => Promise<void>;
  refreshDirectory: (relativePath: string) => Promise<void>;
  selectFile: (relativePath: string) => Promise<void>;
  dismissFileIssue: () => void;
  clearNotice: () => void;
  applyFsChanges: (changes: readonly ProjectFsChange[]) => Promise<void>;
}

export const APP_TITLE = "Astra";

function projectNameFrom(root: string | null): string | null {
  if (root === null) return null;
  const segments = root.split(/[\\/]/).filter((segment) => segment !== "");
  const last = segments[segments.length - 1];
  return last ?? root;
}

function parentDirectory(relativePath: string): string {
  const index = relativePath.lastIndexOf("/");
  return index === -1 ? ROOT_DIRECTORY : relativePath.slice(0, index);
}

function emptyProjectState(): ProjectStoreState {
  return {
    root: null,
    name: null,
    entriesByDirectory: {},
    expanded: {},
    selectedPath: null,
    openFile: null,
    entryPoint: null,
    fileIssue: null,
    notice: null,
    opening: false,
    error: null,
    hydrate: () => Promise.resolve(),
    subscribeToFs: () => () => undefined,
    openProject: () => Promise.resolve(),
    openProjectAt: () => Promise.resolve(),
    closeProject: () => Promise.resolve(),
    openEntryPoint: () => Promise.resolve(),
    toggleDirectory: () => Promise.resolve(),
    refreshDirectory: () => Promise.resolve(),
    selectFile: () => Promise.resolve(),
    dismissFileIssue: () => undefined,
    clearNotice: () => undefined,
    applyFsChanges: () => Promise.resolve(),
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return String(error);
}

export function applyProjectTitle(name: string | null): void {
  if (typeof document === "undefined") return;
  document.title = name === null ? APP_TITLE : `${name} — ${APP_TITLE}`;
}

const initialProjectState = emptyProjectState();

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  ...initialProjectState,

  hydrate: async () => {
    const api = bridge();
    if (!api?.getProjectState) return;
    try {
      const { root } = await api.getProjectState();
      if (root === null) {
        applyProjectTitle(null);
        set({ root: null, name: null, entriesByDirectory: {}, expanded: {}, entryPoint: null });
        return;
      }
      const name = projectNameFrom(root);
      applyProjectTitle(name);
      set({ root, name, entriesByDirectory: {}, expanded: {}, entryPoint: null });
      await get().refreshDirectory(ROOT_DIRECTORY).catch(() => undefined);
    } catch {
      // Leave the shell closed: the app should still boot.
    }
  },

  subscribeToFs: () => {
    const api = bridge();
    if (!api?.onProjectFsEvent) return () => undefined;
    return api.onProjectFsEvent((changes) => void get().applyFsChanges(changes));
  },

  openProject: async () => {
    const api = bridge();
    if (!api?.pickProjectFolder) return;
    set({ error: null });
    let picked: string | null = null;
    try {
      picked = await api.pickProjectFolder();
    } catch (error) {
      set({ error: `Could not show the folder picker: ${describeError(error)}` });
      return;
    }
    if (picked === null) return; // dismissed
    await get().openProjectAt(picked);
  },

  openProjectAt: async (rootPath) => {
    const api = bridge();
    if (!api?.projectOpen) return;
    set({ opening: true, error: null });
    try {
      const opened = await api.projectOpen(rootPath);
      const name = projectNameFrom(opened.root);
      applyProjectTitle(name);
      set({
        root: opened.root,
        name,
        entriesByDirectory: { [ROOT_DIRECTORY]: [...opened.entries] },
        expanded: {},
        selectedPath: null,
        openFile: null,
        entryPoint: detectEntryPoint(opened.entries),
        fileIssue: null,
        notice: null,
        opening: false,
      });
    } catch (error) {
      set({
        opening: false,
        error: `Could not open that folder: ${describeError(error)}`,
      });
    }
  },

  closeProject: async () => {
    const api = bridge();
    try {
      await api?.projectClose?.();
    } catch (error) {
      set({ error: `Could not close the project: ${describeError(error)}` });
      return;
    }
    applyProjectTitle(null);
    set({
      root: null,
      name: null,
      entriesByDirectory: {},
      expanded: {},
      selectedPath: null,
      openFile: null,
      entryPoint: null,
      fileIssue: null,
      notice: null,
      opening: false,
      error: null,
    });
  },

  openEntryPoint: async () => {
    const entry = get().entryPoint;
    if (entry === null) return;
    await get().selectFile(entry);
  },

  toggleDirectory: async (relativePath) => {
    const willExpand = !get().expanded[relativePath];
    set((state) => ({
      expanded: { ...state.expanded, [relativePath]: willExpand },
    }));
    if (willExpand && get().entriesByDirectory[relativePath] === undefined) {
      try {
        await get().refreshDirectory(relativePath);
      } catch (error) {
        set({ error: `Could not list "${relativePath || "project root"}": ${describeError(error)}` });
      }
    }
  },

  refreshDirectory: async (relativePath) => {
    const api = bridge();
    if (!api?.projectList) return;
    const entries = await api.projectList(relativePath === ROOT_DIRECTORY ? undefined : relativePath);
    set((state) => ({
      entriesByDirectory: { ...state.entriesByDirectory, [relativePath]: [...entries] },
      // A root refresh is the one moment the entry page can change under us:
      // the watcher reported index.html created or deleted, so the verdict is
      // retaken from the listing the refresh just brought back.
      ...(relativePath === ROOT_DIRECTORY ? { entryPoint: detectEntryPoint(entries) } : {}),
    }));
  },

  selectFile: async (relativePath) => {
    const api = bridge();
    if (!api?.projectReadFile) return;
    set({ selectedPath: relativePath, notice: null, fileIssue: null });
    try {
      const file = await api.projectReadFile(relativePath);
      set({
        openFile: { relativePath: file.relativePath, text: file.text, hash: file.hash },
        fileIssue: null,
      });
    } catch {
      set({ openFile: null, fileIssue: "unavailable" });
    }
  },

  dismissFileIssue: () => set({ fileIssue: null }),

  clearNotice: () => set({ notice: null }),

  applyFsChanges: async (changes) => {
    const state = get();
    if (state.root === null || changes.length === 0) return;

    const directories = new Set<string>();
    for (const change of changes) {
      directories.add(parentDirectory(change.relativePath));
    }

    const deletedDirectories = changes
      .filter((change) => change.type === "deleted" && change.kind === "directory")
      .map((change) => change.relativePath);

    if (deletedDirectories.length > 0) {
      const entriesByDirectory = { ...state.entriesByDirectory };
      const expanded = { ...state.expanded };
      for (const dir of deletedDirectories) {
        for (const key of Object.keys(entriesByDirectory)) {
          if (key === dir || key.startsWith(`${dir}/`)) {
            delete entriesByDirectory[key];
          }
        }
        delete expanded[dir];
        for (const key of Object.keys(expanded)) {
          if (key === dir || key.startsWith(`${dir}/`)) {
            delete expanded[key];
          }
        }
      }
      set({ entriesByDirectory, expanded });
    }

    await Promise.all(
      [...directories].map((directory) =>
        get()
          .refreshDirectory(directory)
          .catch(() => undefined),
      ),
    );

    const selected = get().selectedPath;
    if (selected === null) return;
    const touched = changes.some((change) => change.relativePath === selected);
    if (!touched) return;

    const latest = changes.find((change) => change.relativePath === selected);
    if (latest?.type === "deleted") {
      set({ fileIssue: "unavailable", notice: null });
      return;
    }
    if (get().openFile !== null) {
      await get().selectFile(selected);
      set({ notice: `Reloaded “${selected}” after an external change.` });
    }
  },
}));

/** Extends the shell command bus to cover project actions. */
export function bindProjectCommands(appState: AppState, projectStore: ProjectStoreState): void {
  const original = appState.runCommand;
  appState.runCommand = (command) => {
    if (command === MENU_COMMANDS.openProject) {
      void projectStore.openProject();
      return;
    }
    if (command === MENU_COMMANDS.closeProject) {
      void projectStore.closeProject();
      return;
    }
    original(command);
  };
}
