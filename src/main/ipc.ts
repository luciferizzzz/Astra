import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type { SettingsStore } from "./settings-store";
import { isTrustedRendererUrl, type TrustedRendererTarget } from "./trusted-url";
import {
  IpcValidationError,
  validatePingPayload,
  validateSettingsUpdatePayload,
} from "./validation";

/**
 * The complete set of privileged operations the renderer may request.
 *
 * Every handler verifies its sender before looking at the payload. The settings
 * handlers are the first that *write*, so they are also the first that go
 * through the strict payload validator and the atomic store — the renderer can
 * ask for a preference, but it cannot name a file or a path.
 *
 * See PRD §14.4 (SEC-016, SEC-019) and FR-A05.
 */
export function registerIpcHandlers(target: TrustedRendererTarget, settings: SettingsStore): void {
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
