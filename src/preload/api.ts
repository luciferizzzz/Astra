import type { PingResponse } from "../shared/ipc";

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
}
