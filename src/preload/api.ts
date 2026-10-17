import type { AstraSettings } from "../shared/settings";
import type { MenuCommand, PingResponse } from "../shared/ipc";

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
}
