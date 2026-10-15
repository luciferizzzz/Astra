import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import { isTrustedRendererUrl, type TrustedRendererTarget } from "./trusted-url";
import { IpcValidationError, validatePingPayload } from "./validation";

/**
 * The complete set of privileged operations the renderer may request.
 *
 * Every handler verifies its sender before looking at the payload, and every
 * handler is read-only at this stage — Astra performs no filesystem writes
 * until the project-root surface exists (PRD §11.2, Phase 0).
 *
 * See PRD §14.4 (SEC-016, SEC-019).
 */
export function registerIpcHandlers(target: TrustedRendererTarget): void {
  ipcMain.handle(IPC_CHANNELS.appPing, (event, payload) => {
    assertTrustedSender(event, IPC_CHANNELS.appPing, target);
    const request = validatePingPayload(IPC_CHANNELS.appPing, payload);
    return { pong: true as const, nonce: request.nonce ?? null };
  });

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (event) => {
    assertTrustedSender(event, IPC_CHANNELS.appGetVersion, target);
    return app.getVersion();
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
