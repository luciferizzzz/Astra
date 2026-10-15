import { describe, expect, it } from "vitest";
import { IpcValidationError, validatePingPayload } from "../src/main/validation";

const CHANNEL = "astra:app:ping";

describe("validatePingPayload — accepted payloads", () => {
  it("treats an absent payload as an empty request", () => {
    expect(validatePingPayload(CHANNEL, undefined)).toEqual({});
    expect(validatePingPayload(CHANNEL, null)).toEqual({});
  });

  it("accepts an empty object", () => {
    expect(validatePingPayload(CHANNEL, {})).toEqual({});
  });

  it("echoes a well-formed nonce unchanged", () => {
    expect(validatePingPayload(CHANNEL, { nonce: "renderer-ready" })).toEqual({ nonce: "renderer-ready" });
  });

  it("treats a nullish nonce as absent", () => {
    expect(validatePingPayload(CHANNEL, { nonce: null })).toEqual({});
    expect(validatePingPayload(CHANNEL, { nonce: undefined })).toEqual({});
  });

  it("tolerates keys the contract does not know about", () => {
    // The preload and the main process are versioned together, but a stale
    // renderer should not be able to break a liveness probe by sending extra
    // fields. Strictness belongs on the fields that carry meaning.
    expect(validatePingPayload(CHANNEL, { nonce: "ok", futureField: 1 })).toEqual({ nonce: "ok" });
  });

  it("accepts a nonce at exactly the length limit", () => {
    const nonce = "x".repeat(128);
    expect(validatePingPayload(CHANNEL, { nonce })).toEqual({ nonce });
  });
});

describe("validatePingPayload — rejected payloads", () => {
  it.each([
    ["a string", "nonce"],
    ["a number", 42],
    ["a boolean", true],
    ["a symbol", Symbol("nonce")],
    ["an array", ["nonce"]],
    ["a function", () => undefined],
  ])("rejects %s instead of coercing it", (_label, payload) => {
    expect(() => validatePingPayload(CHANNEL, payload)).toThrow(IpcValidationError);
  });

  it("rejects a nonce that is present but not a string", () => {
    for (const nonce of [42, {}, [], true]) {
      expect(() => validatePingPayload(CHANNEL, { nonce })).toThrow(IpcValidationError);
    }
  });

  it("rejects a nonce longer than the contract allows", () => {
    expect(() => validatePingPayload(CHANNEL, { nonce: "x".repeat(129) })).toThrow(/exceeds 128/);
  });
});

describe("validatePingPayload — error shape", () => {
  it("raises a typed error the main process can catch specifically", () => {
    let caught: unknown;
    try {
      validatePingPayload(CHANNEL, 42);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IpcValidationError);
    expect((caught as IpcValidationError).name).toBe("IpcValidationError");
  });

  it("names the offending channel so a failure is traceable", () => {
    expect(() => validatePingPayload(CHANNEL, 42)).toThrow(/astra:app:ping/);
  });

  it("describes the type it found without echoing the value", () => {
    expect(() => validatePingPayload(CHANNEL, "nonce")).toThrow(/received string/);
    expect(() => validatePingPayload(CHANNEL, ["nonce"])).toThrow(/received an array/);
  });

  it("does not carry the rest of the payload into the error message", () => {
    const token = "super-secret-token";
    // `nonce` is the wrong type, so this rejects — and the message must not
    // smuggle the sibling fields back to whoever is logging it.
    expect(() => validatePingPayload(CHANNEL, { nonce: 42, token })).toThrow(IpcValidationError);
    expect(() => validatePingPayload(CHANNEL, { nonce: 42, token })).not.toThrow(token);
  });
});
