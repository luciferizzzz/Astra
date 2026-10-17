import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_MAX_MS,
  AUTOSAVE_MIN_MS,
  AUTOSAVE_OFF,
  DEFAULT_SETTINGS,
  coerceSettingValue,
  isAutosaveInterval,
  isFontSize,
  normalizeSettings,
} from "../src/shared/settings";

/**
 * The settings contract is the pivot every other layer trusts: the main process
 * uses these functions to read a file it did not write, and the validator uses
 * them to decide what a renderer is allowed to store. Guessing a type here would
 * quietly corrupt preferences everywhere, so the cases below pin the two
 * behaviours that matter — never throw on read, never accept a value outside its
 * declared range.
 */
describe("defaults", () => {
  it("turns telemetry off and blocks external resources out of the box", () => {
    expect(DEFAULT_SETTINGS.telemetry).toBe(false);
    expect(DEFAULT_SETTINGS.externalResourcePolicy).toBe("block");
    expect(DEFAULT_SETTINGS.formattingPolicy).toBe("preserve");
    expect(DEFAULT_SETTINGS.autosaveIntervalMs).toBe(AUTOSAVE_OFF);
  });
});

describe("isFontSize", () => {
  it("accepts whole numbers inside the range and nothing else", () => {
    expect(isFontSize(10)).toBe(true);
    expect(isFontSize(24)).toBe(true);
    expect(isFontSize(9.9)).toBe(false);
    expect(isFontSize(25)).toBe(false);
    expect(isFontSize(13.5)).toBe(false);
    expect(isFontSize("13")).toBe(false);
  });
});

describe("isAutosaveInterval", () => {
  it("treats 0 as the explicit 'off' value", () => {
    expect(isAutosaveInterval(0)).toBe(true);
  });

  it("rejects a non-zero interval below the floor and above the ceiling", () => {
    expect(isAutosaveInterval(AUTOSAVE_MIN_MS)).toBe(true);
    expect(isAutosaveInterval(AUTOSAVE_MAX_MS)).toBe(true);
    expect(isAutosaveInterval(100)).toBe(false);
    expect(isAutosaveInterval(AUTOSAVE_MAX_MS + 1)).toBe(false);
  });
});

describe("coerceSettingValue", () => {
  it("returns the value when it fits the field", () => {
    expect(coerceSettingValue("theme", "light")).toBe("light");
    expect(coerceSettingValue("fontSize", 15)).toBe(15);
    expect(coerceSettingValue("telemetry", true)).toBe(true);
  });

  it("returns undefined for anything else, so the caller decides the policy", () => {
    expect(coerceSettingValue("theme", "sepia")).toBeUndefined();
    expect(coerceSettingValue("fontSize", 99)).toBeUndefined();
    expect(coerceSettingValue("telemetry", "yes")).toBeUndefined();
    expect(coerceSettingValue("formattingPolicy", null)).toBeUndefined();
  });
});

describe("normalizeSettings", () => {
  it("returns the defaults for a non-object", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps the known, valid fields and fills the rest from defaults", () => {
    expect(normalizeSettings({ theme: "light", fontSize: 20 })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "light",
      fontSize: 20,
    });
  });

  it("drops fields that are the wrong type or out of range rather than throwing", () => {
    const result = normalizeSettings({ theme: "sepia", fontSize: "big", autosaveIntervalMs: -5 });
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores unknown keys an older or hand-edited file might carry", () => {
    const result = normalizeSettings({ theme: "dark", legacyKey: true });
    expect(result).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
    expect(result).not.toHaveProperty("legacyKey");
  });
});
