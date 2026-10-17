/**
 * IPC payload validation.
 *
 * Every value that crosses the process boundary is untrusted. The renderer is
 * driven by markup from projects Astra did not author, so a compromised
 * renderer is an assumed scenario — not a theoretical one. Validators therefore
 * reject rather than coerce, and they run before any handler logic executes.
 *
 * Pure by design: this module imports nothing from `electron`, so it is
 * unit-testable under Vitest. See PRD §14.4 (SEC-019).
 */

import type { PingRequest } from "../shared/ipc";
import { coerceSettingValue, SETTINGS_KEYS, type AstraSettings } from "../shared/settings";

/** Raised when a payload does not satisfy the contract. Carries no stack to the renderer beyond the message. */
export class IpcValidationError extends Error {
  constructor(channel: string, reason: string) {
    super(`Rejected IPC payload on "${channel}": ${reason}`);
    this.name = "IpcValidationError";
  }
}

const MAX_NONCE_LENGTH = 128;

/**
 * Validates the payload of `astra:app:ping`.
 *
 * Accepts an absent payload, `null`, or a plain object carrying an optional
 * string nonce. Anything else — arrays, class instances, primitives — is
 * rejected rather than coerced, because coercion would quietly hide a contract
 * mismatch between the two sides of the bridge.
 */
export function validatePingPayload(channel: string, payload: unknown): PingRequest {
  if (payload === undefined || payload === null) return {};

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new IpcValidationError(channel, `expected a plain object, received ${describe(payload)}`);
  }

  const { nonce } = payload as { readonly nonce?: unknown };
  if (nonce === undefined || nonce === null) return {};

  if (typeof nonce !== "string") {
    throw new IpcValidationError(channel, `"nonce" must be a string, received ${describe(nonce)}`);
  }
  if (nonce.length > MAX_NONCE_LENGTH) {
    throw new IpcValidationError(channel, `"nonce" exceeds ${MAX_NONCE_LENGTH} characters`);
  }

  return { nonce };
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

/**
 * Validates the payload of `astra:settings:update`.
 *
 * Stricter than the read path on purpose. Reading a settings file is forgiving
 * because the file is not an attack surface; this payload *is* one, so an
 * unknown key or an out-of-range value is rejected rather than dropped. The
 * accepted result is a patch carrying only fields the store knows, each already
 * narrowed to its legal type and range.
 *
 * See PRD §14.4 (SEC-019).
 */
export function validateSettingsUpdatePayload(
  channel: string,
  payload: unknown,
): Partial<AstraSettings> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new IpcValidationError(channel, `expected a plain object, received ${describe(payload)}`);
  }

  const { patch } = payload as { readonly patch?: unknown };
  if (patch === undefined) {
    throw new IpcValidationError(channel, 'missing "patch"');
  }
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    throw new IpcValidationError(channel, `"patch" must be a plain object, received ${describe(patch)}`);
  }

  const record = patch as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(SETTINGS_KEYS as readonly string[]).includes(key)) {
      throw new IpcValidationError(channel, `unknown setting "${key}"`);
    }
  }

  const result: { -readonly [K in keyof AstraSettings]?: AstraSettings[K] } = {};
  for (const key of SETTINGS_KEYS) {
    if (!(key in record)) continue;
    const coerced = coerceSettingValue(key, record[key]);
    if (coerced === undefined) {
      throw new IpcValidationError(channel, `invalid value for "${key}" (${describe(record[key])})`);
    }
    (result[key] as AstraSettings[typeof key]) = coerced as AstraSettings[typeof key];
  }

  return result;
}
