import { describe, expect, it } from "vitest";
import {
  IpcValidationError,
  validateProjectListPayload,
  validateProjectOpenPayload,
  validateProjectRelativePathPayload,
  validateProjectWritePayload,
} from "../src/main/validation";

/**
 * The project channels are the first to name user files, so their validators
 * carry the same verdict the filesystem layer would reach — before any handler
 * logic runs (PRD §14.4, SEC-019). A traversal attempt must be *refused here*,
 * not discovered later; a well-formed request must pass through untouched.
 */

const OPEN = "astra:project:open";
const LIST = "astra:project:list";
const READ = "astra:project:read-file";
const WRITE = "astra:project:write-file";

describe("validateProjectOpenPayload", () => {
  it("accepts a plain absolute path", () => {
    expect(validateProjectOpenPayload(OPEN, { rootPath: "D:/dev/my-site" })).toEqual({
      rootPath: "D:/dev/my-site",
    });
  });

  it("tolerates unknown keys", () => {
    expect(validateProjectOpenPayload(OPEN, { rootPath: "C:/site", extra: 1 })).toEqual({
      rootPath: "C:/site",
    });
  });

  it("refuses anything but a plain object", () => {
    for (const payload of ["C:/site", 42, ["C:/site"], null, undefined]) {
      expect(() => validateProjectOpenPayload(OPEN, payload)).toThrow(IpcValidationError);
    }
  });

  it("refuses a missing, non-string or empty rootPath", () => {
    expect(() => validateProjectOpenPayload(OPEN, {})).toThrow(/rootPath/);
    expect(() => validateProjectOpenPayload(OPEN, { rootPath: 42 })).toThrow(/rootPath/);
    expect(() => validateProjectOpenPayload(OPEN, { rootPath: "   " })).toThrow(/empty/);
  });

  it("refuses NUL bytes and absurd lengths", () => {
    expect(() => validateProjectOpenPayload(OPEN, { rootPath: "C:/site\0" })).toThrow(/NUL/);
    expect(() => validateProjectOpenPayload(OPEN, { rootPath: "a".repeat(5000) })).toThrow(
      /4096/,
    );
  });
});

describe("validateProjectRelativePathPayload", () => {
  it("accepts a project-relative path", () => {
    expect(validateProjectRelativePathPayload(READ, { relativePath: "src/app.ts" })).toEqual({
      relativePath: "src/app.ts",
    });
  });

  it("refuses traversal, absolute paths and the empty path", () => {
    for (const relativePath of ["../secret", "..\\secret", "/etc/passwd", "C:\\win.ini", ""]) {
      expect(() => validateProjectRelativePathPayload(READ, { relativePath })).toThrow(
        IpcValidationError,
      );
    }
  });

  it("refuses a missing path", () => {
    expect(() => validateProjectRelativePathPayload(READ, {})).toThrow(IpcValidationError);
    expect(() => validateProjectRelativePathPayload(READ, null)).toThrow(IpcValidationError);
  });
});

describe("validateProjectListPayload", () => {
  it("treats an absent path as the project root", () => {
    expect(validateProjectListPayload(LIST, undefined)).toEqual({ relativePath: undefined });
    expect(validateProjectListPayload(LIST, null)).toEqual({ relativePath: undefined });
    expect(validateProjectListPayload(LIST, {})).toEqual({ relativePath: undefined });
    expect(validateProjectListPayload(LIST, { relativePath: null })).toEqual({
      relativePath: undefined,
    });
  });

  it("normalises a supplied path like any other", () => {
    expect(validateProjectListPayload(LIST, { relativePath: "src\\components" })).toEqual({
      relativePath: "src/components",
    });
  });

  it("refuses traversal", () => {
    expect(() => validateProjectListPayload(LIST, { relativePath: ".." })).toThrow(
      IpcValidationError,
    );
  });
});

describe("validateProjectWritePayload", () => {
  it("accepts text with an optional matching hash", () => {
    const hash = "a".repeat(64);
    expect(validateProjectWritePayload(WRITE, { relativePath: "a.html", text: "<p/>", expectedHash: hash })).toEqual({
      relativePath: "a.html",
      text: "<p/>",
      expectedHash: hash,
    });
  });

  it("accepts an absent or null hash as unconditional", () => {
    expect(validateProjectWritePayload(WRITE, { relativePath: "a.html", text: "" })).toEqual({
      relativePath: "a.html",
      text: "",
      expectedHash: undefined,
    });
    expect(
      validateProjectWritePayload(WRITE, { relativePath: "a.html", text: "", expectedHash: null }),
    ).toEqual({ relativePath: "a.html", text: "", expectedHash: undefined });
  });

  it("refuses non-string text", () => {
    expect(() => validateProjectWritePayload(WRITE, { relativePath: "a.html", text: 42 })).toThrow(
      /text/,
    );
    expect(() => validateProjectWritePayload(WRITE, { relativePath: "a.html" })).toThrow(/text/);
  });

  it("refuses a malformed hash — a lying guard is worse than none", () => {
    for (const expectedHash of ["zz".repeat(32), "a".repeat(63), "a".repeat(65), 42]) {
      expect(() =>
        validateProjectWritePayload(WRITE, { relativePath: "a.html", text: "", expectedHash }),
      ).toThrow(/expectedHash/);
    }
  });

  it("refuses traversal in the target path", () => {
    expect(() =>
      validateProjectWritePayload(WRITE, { relativePath: "../escape.html", text: "x" }),
    ).toThrow(IpcValidationError);
  });
});
