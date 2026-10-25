/**
 * IPC contract shared by the main process, the preload allowlist and the renderer.
 *
 * This module is bundled into all three processes, so it must stay free of
 * runtime dependencies and side effects: frozen constants and types only.
 *
 * The renderer never addresses an Electron API directly — it only ever sees the
 * narrow surface that `src/preload/index.ts` chooses to publish. See PRD §11.2
 * (trust boundaries) and §14.4 (SEC-015..SEC-022).
 */

import type { AstraSettings } from "./settings";

/** Every IPC channel Astra is allowed to use. Adding one is a deliberate, reviewable act. */
export const IPC_CHANNELS = {
  appPing: "astra:app:ping",
  appGetVersion: "astra:app:get-version",
  /** Read the persisted user settings. */
  settingsGet: "astra:settings:get",
  /** Apply a partial update and return the whole, normalised settings object. */
  settingsUpdate: "astra:settings:update",
  /**
   * Main → renderer. The application menu lives in the main process, but the
   * actions it names are renderer concerns, so a menu click is forwarded here.
   * The menu is the only *command* channel the main process pushes on.
   */
  menuCommand: "astra:menu:command",
  /** Open a project folder; answers with its canonical root and root listing. */
  projectOpen: "astra:project:open",
  /** Close the open project and stop watching it. */
  projectClose: "astra:project:close",
  /** List one directory of the open project. */
  projectList: "astra:project:list",
  /** Read a project file as text, with the hash of the bytes on disk. */
  projectReadFile: "astra:project:read-file",
  /** Atomically write a project file, refusing to clobber a newer one. */
  projectWriteFile: "astra:project:write-file",
  /** Which project is open, if any. */
  projectGetState: "astra:project:get-state",
  /**
   * Main → renderer. Verified external changes to the open project. The
   * renderer is told *what* changed, never asked to decide anything about it:
   * conflict policy belongs to the sync layer (FR-G02, FR-G04).
   */
  projectFsEvent: "astra:project:fs-event",
  /**
   * Show the operating system's folder picker so the user can name a folder.
   *
   * This is the only way an absolute path can enter the renderer. The renderer
   * never types one and never invents one: it asks for the native dialog, and
   * whatever comes back is still put through the `projectOpen` validator and the
   * adapter's containment check before a single byte is read. Answers with the
   * chosen path, or `null` when the dialog was dismissed.
   */
  projectPickFolder: "astra:project:pick-folder",
  /**
   * Tell the main process where the canvas surface is, and what it should show.
   *
   * The canvas is a separate Electron renderer (`WebContentsView`) laid over the
   * UI window, so the main process — which owns that view — needs two things the
   * renderer alone knows: the rectangle the surface currently occupies, and
   * which project file to load into it. The renderer reports both; the main
   * process never guesses a layout.
   *
   * Sending `entryPath: null` (or a zero-area rectangle) hides the surface. No
   * project handle, path or URL crosses this channel in the other direction.
   */
  canvasSurface: "astra:canvas:surface",
  /** Preview (WebContentsView) → main: click coordinates from inside the page. */
  canvasClick: "astra:canvas:click",
  /** Main → renderer: element selected in canvas (path + metadata). */
  canvasSelection: "astra:canvas:selection",
  /** UI → main: request DOM tree snapshot from canvas for layer tree. */
  canvasGetTree: "astra:canvas:get-tree",
  /** Main → UI: DOM tree snapshot. */
  canvasTree: "astra:canvas:tree",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Payload for `astra:app:ping`. Intentionally minimal — a liveness probe. */
export interface PingRequest {
  /** Opaque client-generated string echoed back, to prove the round trip is intact. */
  readonly nonce?: string;
}

export interface PingResponse {
  readonly pong: true;
  readonly nonce: string | null;
}

/** Payload for `astra:settings:update`: a partial settings object. */
export interface SettingsUpdateRequest {
  readonly patch: Partial<AstraSettings>;
}

/** Reply for both settings channels: the complete, normalised settings. */
export type SettingsResponse = AstraSettings;

/* ------------------------------------------------------------------------- *
 * Project filesystem contract (Phase 1 — FS adapter + watcher).
 *
 * All paths in this contract are forward-slash and relative to the project
 * root. The renderer never handles an absolute path: it asks by position
 * inside the project, and the main process owns every resolution.
 * ------------------------------------------------------------------------- */

/** One entry of a project directory listing. */
export interface ProjectListEntry {
  readonly name: string;
  readonly relativePath: string;
  readonly kind: "file" | "directory";
}

/** Payload for `astra:project:open`. */
export interface ProjectOpenRequest {
  /** Absolute path of the folder to open, as the operating system knows it. */
  readonly rootPath: string;
}

/** Reply for `astra:project:open`: how the root resolved, and what is in it. */
export interface ProjectOpenResponse {
  readonly root: string;
  readonly entries: readonly ProjectListEntry[];
}

/** Payload for `astra:project:list`. */
export interface ProjectListRequest {
  /** Directory to list, relative to the root. Absent means the root itself. */
  readonly relativePath?: string;
}

/** Payload for `astra:project:read-file`. */
export interface ProjectReadFileRequest {
  readonly relativePath: string;
}

/** A project file's text plus the hash of the bytes that produced it. */
export interface ProjectFileContents {
  readonly relativePath: string;
  readonly text: string;
  /**
   * SHA-256 of the bytes on disk at read time. Pass it back as `expectedHash`
   * when writing, and a file that changed in between raises a conflict rather
   * than being overwritten (FR-G08).
   */
  readonly hash: string;
}

/** Payload for `astra:project:write-file`. */
export interface ProjectWriteFileRequest {
  readonly relativePath: string;
  readonly text: string;
  /** Optional optimistic-concurrency guard; omit to write unconditionally. */
  readonly expectedHash?: string;
}

/** Reply for `astra:project:write-file`. */
export interface ProjectWriteFileResponse {
  readonly relativePath: string;
  /** SHA-256 of the bytes now on disk — hand it to the watcher as a self-write. */
  readonly hash: string;
  readonly bytes: number;
}

/** Reply for `astra:project:get-state`. */
export interface ProjectStateResponse {
  /** Canonical root of the open project, or `null` when none is open. */
  readonly root: string | null;
}

/**
 * Reply for `astra:project:pick-folder`: the folder the user chose, or `null`
 * when the dialog was dismissed.
 *
 * The value is the operating system's own path, and the native dialog is the
 * only producer of it — the renderer can ask for the dialog but never supply the
 * answer. Treat it as a request to open, not as a decision: `projectOpen`
 * validates it and the adapter proves it is a real, contained directory.
 */
export type ProjectPickFolderResponse = string | null;

/** One verified external change to the open project. */
export interface ProjectFsChange {
  readonly type: "created" | "changed" | "deleted";
  readonly relativePath: string;
  readonly kind: "file" | "directory";
}

/** Push payload for `astra:project:fs-event`: a batch, because bursts coalesce. */
export interface ProjectFsEvent {
  readonly changes: readonly ProjectFsChange[];
}

/* ------------------------------------------------------------------------- *
 * Canvas surface contract (Phase 2 — the sandboxed preview over the shell).
 *
 * The canvas is its own Electron renderer, not a region of the UI document.
 * This payload is how the UI tells the main process where to put it and what
 * to load — the only two facts the view needs and the only two the renderer
 * can be trusted to know.
 * ------------------------------------------------------------------------- */

/** A rectangle in the UI window's client coordinates, in CSS pixels. */
export interface CanvasBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Payload for `astra:canvas:surface`.
 *
 * `entryPath` names a file *inside the open project*, in the contract's
 * forward-slash form — the same normaliser every other project path goes
 * through validates it, so a canvas cannot name a file the explorer could not.
 * A `null` entry means "nothing to render" and hides the surface.
 */
export interface CanvasSurfaceRequest {
  readonly bounds: CanvasBounds | null;
  readonly entryPath: string | null;
  /**
   * Changes whenever the preview must be reloaded even though the path did not
   * change — an external edit to the entry page, a reload after a save. The main
   * process compares it with the value it last loaded and reloads on a mismatch.
   */
  readonly revision: number;
}

/** Reply for `astra:canvas:surface`: what the main process actually did. */
export interface CanvasSurfaceResponse {
  /** True when a document is now displayed in the surface. */
  readonly shown: boolean;
  /** The file that was loaded, or `null` when the surface is hidden. */
  readonly relativePath: string | null;
}

/** Click event forwarded from preview preload (Option C). */
export interface CanvasClickPayload {
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly tagName: string | null;
}

/** Selection result reported to the UI (FR-C02/C06). */
export interface CanvasSelectionPayload {
  readonly found: boolean;
  readonly selector?: string;
  readonly tagName?: string;
  readonly id?: string | null;
  readonly className?: string | null;
  readonly rect?: { x: number; y: number; width: number; height: number };
  readonly path?: string[];
  readonly reason?: string;
}

/** Layer tree node snapshot from canvas. */
export interface CanvasTreeNode {
  readonly tagName: string;
  readonly id: string | null;
  readonly className: string | null;
  readonly selector: string;
  readonly children: readonly CanvasTreeNode[];
}

/** Payload for canvas tree snapshot. */
export interface CanvasTreePayload {
  readonly root: CanvasTreeNode | null;
}

/**
 * Menu actions the main process forwards to the renderer.
 *
 * The menu is built in the main process because that is where Electron menus
 * live, but almost every item names something the renderer owns (a panel, a
 * viewport preset, a dialog). Rather than give the main process a second view of
 * that state, a click is forwarded as one of these commands and the renderer
 * decides what it means. This is the seed of the PRD's "command bus" (FR-A02).
 */
export const MENU_COMMANDS = {
  openSettings: "open-settings",
  /**
   * Show the folder picker and open the chosen project.
   *
   * Forwarded to the renderer rather than run in the main process on purpose:
   * the renderer owns the view of what is open, and routing the click through
   * the same store method the toolbar button uses means one code path opens a
   * project, not two that can drift.
   */
  openProject: "open-project",
  /** Close the open project and return the shell to its welcome state. */
  closeProject: "close-project",
  toggleSidebar: "toggle-sidebar",
  toggleInspector: "toggle-inspector",
  toggleEditor: "toggle-editor",
  togglePreview: "toggle-preview",
  viewportDesktop: "viewport-desktop",
  viewportTablet: "viewport-tablet",
  viewportMobile: "viewport-mobile",
} as const;

export type MenuCommand = (typeof MENU_COMMANDS)[keyof typeof MENU_COMMANDS];

/** True when `value` is one of the commands the renderer knows how to run. */
export function isMenuCommand(value: unknown): value is MenuCommand {
  return typeof value === "string" && (Object.values(MENU_COMMANDS) as string[]).includes(value);
}
