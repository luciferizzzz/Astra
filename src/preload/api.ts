import type { AstraSettings } from "../shared/settings";
import type {
  CanvasSelectionPayload,
  CanvasSurfaceRequest,
  CanvasSurfaceResponse,
  MenuCommand,
  PingResponse,
  ProjectFileContents,
  ProjectFsChange,
  ProjectListEntry,
  ProjectOpenResponse,
  ProjectWriteFileResponse,
} from "../shared/ipc";

/**
 * The exact surface `window.astra` publishes to the renderer.
 *
 * Held in a standalone module so the renderer's TypeScript sees the same shape
 * the preload actually exposes — drift between the two would otherwise only
 * surface at runtime, inside a sandboxed process that cannot be inspected.
 */
export interface AstraApi {
  /** Liveness probe. Resolves with an echo of `nonce` when the round trip is intact. */
  ping(nonce?: string): Promise<PingResponse>;
  /** Version of the packaged application, read from the main process. */
  getAppVersion(): Promise<string>;
  /** The persisted user settings, normalised by the main process. */
  getSettings(): Promise<AstraSettings>;
  /** Applies a partial update; resolves with the whole, normalised settings. */
  updateSettings(patch: Partial<AstraSettings>): Promise<AstraSettings>;
  /**
   * Subscribes to menu commands forwarded by the main process.
   *
   * Returns an unsubscribe function. The listener receives only values from the
   * fixed `MENU_COMMANDS` set — the main process is the source, but the preload
   * still refuses to forward anything else.
   */
  onMenuCommand(listener: (command: MenuCommand) => void): () => void;

  /** Opens a project folder, replacing any project already open. */
  projectOpen(rootPath: string): Promise<ProjectOpenResponse>;
  /**
   * Shows the operating system's folder picker.
   *
   * Resolves with the chosen path, or `null` when the dialog was dismissed. This
   * is the renderer's only source of an absolute path, and the value is still
   * validated by `projectOpen` before anything is read.
   */
  pickProjectFolder(): Promise<string | null>;
  /** Closes the open project and stops watching it. */
  projectClose(): Promise<{ root: null }>;
  /** Lists one project directory (absent path = the project root). */
  projectList(relativePath?: string): Promise<ProjectListEntry[]>;
  /** Reads a project file as text, with the hash of the bytes on disk. */
  projectReadFile(relativePath: string): Promise<ProjectFileContents>;
  /**
   * Writes a project file atomically. With `expectedHash`, a file that changed
   * on disk since it was read is reported as a conflict, not overwritten.
   */
  projectWriteFile(
    relativePath: string,
    text: string,
    expectedHash?: string,
  ): Promise<ProjectWriteFileResponse>;
  /** Canonical root of the open project, or `null`. */
  getProjectState(): Promise<{ root: string | null }>;
  /**
   * Subscribes to verified external changes to the open project.
   *
   * Returns an unsubscribe function. Batches, because a single save elsewhere
   * arrives from the OS as a burst of events.
   */
  onProjectFsEvent(listener: (changes: readonly ProjectFsChange[]) => void): () => void;
  /**
   * Tells the main process where the canvas surface is and what to load.
   *
   * The canvas is a separate renderer laid over the UI window, so its rectangle
   * is reported rather than derived: only the renderer knows the layout. Pass
   * `null` bounds or a `null` entry path to hide it.
   */
  setCanvasSurface(request: CanvasSurfaceRequest): Promise<CanvasSurfaceResponse>;
  /** Subscribes to selection results from the canvas. */
  onCanvasSelection(listener: (payload: CanvasSelectionPayload) => void): () => void;
  /** Get DOM tree snapshot from canvas. */
  getCanvasTree(): Promise<import("../shared/ipc").CanvasTreePayload>;
}
