import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type { ProjectSession } from "./project-session";
import type { SettingsStore } from "./settings-store";
import { isTrustedRendererUrl, type TrustedRendererTarget } from "./trusted-url";
import {
  IpcValidationError,
  validatePingPayload,
  validateProjectListPayload,
  validateProjectOpenPayload,
  validateProjectRelativePathPayload,
  validateProjectWritePayload,
  validateSettingsUpdatePayload,
} from "./validation";

/**
 * The main-process services the project handlers need from the entry point.
 *
 * Injected rather than imported so this module stays free of window and dialog
 * concerns: the entry point owns the window, and a test can register the
 * handlers and drive them with plain functions.
 */
export interface ProjectHost {
  /** Shows the native folder picker. Resolves to the chosen path, or `null`. */
  pickProjectFolder: () => Promise<string | null>;
  /** Re-installs the application menu so its enabled state matches the session. */
  refreshMenu: () => void;
}

/**
 * The complete set of privileged operations the renderer may request.
 *
 * Every handler verifies its sender before looking at the payload. The settings
 * and project handlers are the first that touch *user data*, so they are also
 * the first that go through a strict payload validator: the renderer can ask
 * for a preference or a file *inside the open project*, but it cannot name an
 * arbitrary path — that verdict is reached by the validator and, again, by the
 * adapter's containment check.
 *
 * See PRD §14.4 (SEC-016, SEC-019), FR-A05 and FR-K01.
 */
export function registerIpcHandlers(
  target: TrustedRendererTarget,
  settings: SettingsStore,
  project: ProjectSession,
  host: ProjectHost,
): void {
  ipcMain.handle(IPC_CHANNELS.appPing, (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.appPing, target);
    const request = validatePingPayload(IPC_CHANNELS.appPing, payload);
    return { pong: true as const, nonce: request.nonce ?? null };
  });

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (event) => {
    assertTrustedSender(event, IPC_CHANNELS.appGetVersion, target);
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.settingsGet, (event) => {
    assertTrustedSender(event, IPC_CHANNELS.settingsGet, target);
    return settings.read();
  });

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.settingsUpdate, target);
    const patch = validateSettingsUpdatePayload(IPC_CHANNELS.settingsUpdate, payload);
    return settings.update(patch);
  });

  ipcMain.handle(IPC_CHANNELS.projectPickFolder, async (event) => {
    assertTrustedSender(event, IPC_CHANNELS.projectPickFolder, target);
    return host.pickProjectFolder();
  });

  ipcMain.handle(IPC_CHANNELS.projectOpen, async (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.projectOpen, target);
    const { rootPath } = validateProjectOpenPayload(IPC_CHANNELS.projectOpen, payload);
    try {
      return await project.open(rootPath);
    } finally {
      // A failed open still changed the session: `open` closes the previous
      // project first, so the menu must not keep offering "Close Project".
      host.refreshMenu();
    }
  });

  ipcMain.handle(IPC_CHANNELS.projectClose, async (event) => {
    assertTrustedSender(event, IPC_CHANNELS.projectClose, target);
    try {
      await project.close();
      return { root: null };
    } finally {
      host.refreshMenu();
    }
  });

  ipcMain.handle(IPC_CHANNELS.projectGetState, (event) => {
    assertTrustedSender(event, IPC_CHANNELS.projectGetState, target);
    return { root: project.root };
  });

  ipcMain.handle(IPC_CHANNELS.projectList, async (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.projectList, target);
    const { relativePath } = validateProjectListPayload(IPC_CHANNELS.projectList, payload);
    return project.list(relativePath);
  });

  ipcMain.handle(IPC_CHANNELS.projectReadFile, async (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.projectReadFile, target);
    const { relativePath } = validateProjectRelativePathPayload(
      IPC_CHANNELS.projectReadFile,
      payload,
    );
    return project.readTextFile(relativePath);
  });

  ipcMain.handle(IPC_CHANNELS.projectWriteFile, async (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.projectWriteFile, target);
    const { relativePath, text, expectedHash } = validateProjectWritePayload(
      IPC_CHANNELS.projectWriteFile,
      payload,
    );
    return project.writeTextFile(relativePath, text, expectedHash);
  });
}

/**
 * Refuses IPC from anything that is not the Astra renderer — including a
 * subframe the renderer might have been talked into loading.
 */
function assertTrustedSender(
  event: IpcMainInvokeEvent,
  channel: string,
  target: TrustedRendererTarget,
): void {
  const senderUrl = event.senderFrame?.url ?? "";
  if (!isTrustedRendererUrl(senderUrl, target)) {
    throw new IpcValidationError(channel, `untrusted sender "${senderUrl}"`);
  }
}
