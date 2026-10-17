import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, isMenuCommand, type MenuCommand } from "../shared/ipc";
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
};

contextBridge.exposeInMainWorld("astra", api);
