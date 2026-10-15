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
