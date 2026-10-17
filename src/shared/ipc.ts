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
   * This is the only channel the main process pushes on.
   */
  menuCommand: "astra:menu:command",
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
