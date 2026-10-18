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
import { normalizeRelativePath, UnsafePathError } from "./project-paths";

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

/** Absolute paths from the renderer stop here: Windows path syntax is the most generous. */
const MAX_ROOT_PATH_LENGTH = 4096;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function requirePlainObject(channel: string, payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new IpcValidationError(channel, `expected a plain object, received ${describe(payload)}`);
  }
  return payload as Record<string, unknown>;
}

/**
 * Validates the payload of `astra:project:open`.
 *
 * The root is the one path the renderer may name absolutely — choosing a
 * folder is the whole point of opening a project. It is checked for shape
 * only; containment is the adapter's job, and directories that do not exist
 * are answered by the adapter with a real error rather than rejected twice.
 */
export function validateProjectOpenPayload(channel: string, payload: unknown): { rootPath: string } {
  const record = requirePlainObject(channel, payload);
  const { rootPath } = record;

  if (typeof rootPath !== "string") {
    throw new IpcValidationError(channel, `"rootPath" must be a string, received ${describe(rootPath)}`);
  }
  if (rootPath.trim() === "") {
    throw new IpcValidationError(channel, `"rootPath" must not be empty`);
  }
  if (rootPath.includes("\0")) {
    throw new IpcValidationError(channel, `"rootPath" contains a NUL byte`);
  }
  if (rootPath.length > MAX_ROOT_PATH_LENGTH) {
    throw new IpcValidationError(channel, `"rootPath" exceeds ${MAX_ROOT_PATH_LENGTH} characters`);
  }

  return { rootPath };
}

/**
 * Validates a payload carrying one project-relative path (read-file and
 * write-file). The path goes through the same normaliser the adapter uses, so
 * a traversal attempt is rejected at the boundary with the same verdict the
 * filesystem layer would have reached.
 */
export function validateProjectRelativePathPayload(
  channel: string,
  payload: unknown,
): { relativePath: string } {
  const record = requirePlainObject(channel, payload);
  return { relativePath: safeNormalize(channel, record["relativePath"]) };
}

/**
 * Validates the payload of `astra:project:list`. The path is optional — an
 * absent path means "the project root", which only this channel accepts.
 */
export function validateProjectListPayload(
  channel: string,
  payload: unknown,
): { relativePath: string | undefined } {
  if (payload === undefined || payload === null) return { relativePath: undefined };
  const record = requirePlainObject(channel, payload);
  const raw = record["relativePath"];
  if (raw === undefined || raw === null) return { relativePath: undefined };
  return { relativePath: safeNormalize(channel, raw) };
}

/**
 * Validates the payload of `astra:project:write-file`.
 *
 * The text is accepted as-is — it is data, and the atomic writer treats it as
 * such. The optional `expectedHash` must be a SHA-256 in the exact shape the
 * hashers produce, because a malformed guard would turn a real conflict into a
 * false one.
 */
export function validateProjectWritePayload(
  channel: string,
  payload: unknown,
): { relativePath: string; text: string; expectedHash: string | undefined } {
  const record = requirePlainObject(channel, payload);
  const { relativePath, text, expectedHash } = record;

  if (typeof text !== "string") {
    throw new IpcValidationError(channel, `"text" must be a string, received ${describe(text)}`);
  }
  if (expectedHash !== undefined && expectedHash !== null) {
    if (typeof expectedHash !== "string" || !HASH_PATTERN.test(expectedHash)) {
      throw new IpcValidationError(channel, `"expectedHash" must be a 64-character hex SHA-256`);
    }
  }

  return {
    relativePath: safeNormalize(channel, relativePath),
    text,
    expectedHash:
      typeof expectedHash === "string" && HASH_PATTERN.test(expectedHash) ? expectedHash : undefined,
  };
}

function safeNormalize(channel: string, value: unknown): string {
  try {
    return normalizeRelativePath(value);
  } catch (error) {
    if (error instanceof UnsafePathError) {
      throw new IpcValidationError(channel, error.message);
    }
    throw error;
  }
}
