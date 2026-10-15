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

/** Every IPC channel Astra is allowed to use. Adding one is a deliberate, reviewable act. */
export const IPC_CHANNELS = {
  appPing: "astra:app:ping",
  appGetVersion: "astra:app:get-version",
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
