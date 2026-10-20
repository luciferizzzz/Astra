import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  isMenuCommand,
  type MenuCommand,
  type ProjectFsEvent,
} from "../shared/ipc";
import type { AstraSettings } from "../shared/settings";
import type { AstraApi } from "./api";

/**
 * The only bridge between the renderer and the operating system.
 *
 * It is deliberately a flat list of named methods rather than a generic
 * `invoke(channel, payload)` escape hatch: such a method would hand a
 * compromised renderer every privileged operation the main process happens to
 * expose, which is precisely what PRD §14.4 (SEC-016) forbids.
 *
 * Runs with `sandbox: true`, so it may import nothing but `electron` and
 * in-repo constants — the bundle has to be self-contained.
 */

/** Shape check for pushed filesystem events: the preload drops anything malformed. */
function isProjectFsEvent(value: unknown): value is ProjectFsEvent {
  if (typeof value !== "object" || value === null) return false;
  const changes = (value as { changes?: unknown }).changes;
  if (!Array.isArray(changes)) return false;
  return changes.every((change) => {
    if (typeof change !== "object" || change === null) return false;
    const { type, relativePath, kind } = change as Record<string, unknown>;
    return (
      (type === "created" || type === "changed" || type === "deleted") &&
      typeof relativePath === "string" &&
      (kind === "file" || kind === "directory")
    );
  });
}

const api: AstraApi = {
  ping: (nonce?: string) => ipcRenderer.invoke(IPC_CHANNELS.appPing, { nonce }),
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appGetVersion),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  updateSettings: (patch: Partial<AstraSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, { patch }),
  onMenuCommand: (listener: (command: MenuCommand) => void) => {
    const handler = (_event: unknown, command: unknown): void => {
      // The main process is trusted, but the allowlist stays closed anyway: a
      // value outside the known set is dropped rather than handed to the app.
      if (isMenuCommand(command)) listener(command);
    };
    ipcRenderer.on(IPC_CHANNELS.menuCommand, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.menuCommand, handler);
    };
  },

  projectOpen: (rootPath: string) => ipcRenderer.invoke(IPC_CHANNELS.projectOpen, { rootPath }),
  pickProjectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.projectPickFolder),
  projectClose: () => ipcRenderer.invoke(IPC_CHANNELS.projectClose),
  projectList: (relativePath?: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.projectList,
      relativePath === undefined ? undefined : { relativePath },
    ),
  projectReadFile: (relativePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.projectReadFile, { relativePath }),
  projectWriteFile: (relativePath: string, text: string, expectedHash?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.projectWriteFile, {
      relativePath,
      text,
      ...(expectedHash !== undefined ? { expectedHash } : {}),
    }),
  getProjectState: () => ipcRenderer.invoke(IPC_CHANNELS.projectGetState),
  setCanvasSurface: (request) => ipcRenderer.invoke(IPC_CHANNELS.canvasSurface, request),
  onProjectFsEvent: (listener) => {
    const handler = (_event: unknown, payload: unknown): void => {
      if (isProjectFsEvent(payload)) listener(payload.changes);
    };
    ipcRenderer.on(IPC_CHANNELS.projectFsEvent, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.projectFsEvent, handler);
    };
  },
};

contextBridge.exposeInMainWorld("astra", api);
