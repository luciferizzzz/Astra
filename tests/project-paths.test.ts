import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  baseOfLockSibling,
  isIgnoredName,
  isIgnoredPath,
  isLockSibling,
  isWithinRoot,
  joinUnderRoot,
  normalizeRelativePath,
  toPosixPath,
  UnsafePathError,
} from "../src/main/project-paths";

/**
 * The path normaliser is the boundary a compromised renderer has to cross to
 * reach a byte outside the project (SEC-003, SEC-013). These tests pin both
 * halves of its contract: everything legitimate passes through unchanged in
 * contract form, and every escape attempt is *refused by name* rather than
 * silently rewritten.
 */

describe("normalizeRelativePath — accepted", () => {
  it("passes a simple file through", () => {
    expect(normalizeRelativePath("index.html")).toBe("index.html");
  });

  it("keeps nested paths", () => {
    expect(normalizeRelativePath("css/main.css")).toBe("css/main.css");
  });

  it("accepts backslashes and reports forward slashes", () => {
    expect(normalizeRelativePath("css\\main.css")).toBe("css/main.css");
  });

  it("drops interior `.` segments", () => {
    expect(normalizeRelativePath("./assets/./logo.svg")).toBe("assets/logo.svg");
  });

  it("collapses an interior `..` that stays inside the project", () => {
    expect(normalizeRelativePath("css/../index.html")).toBe("index.html");
  });
});

describe("normalizeRelativePath — refused", () => {
  it("rejects non-strings", () => {
    expect(() => normalizeRelativePath(undefined)).toThrow(UnsafePathError);
    expect(() => normalizeRelativePath(42)).toThrow(UnsafePathError);
    expect(() => normalizeRelativePath(null)).toThrow(UnsafePathError);
    expect(() => normalizeRelativePath({ path: "x" })).toThrow(UnsafePathError);
  });

  it("rejects the empty path", () => {
    expect(() => normalizeRelativePath("")).toThrow(UnsafePathError);
  });

  it("rejects NUL bytes", () => {
    expect(() => normalizeRelativePath("index.html\0.png")).toThrow(/NUL/);
  });

  it("rejects overlong paths", () => {
    expect(() => normalizeRelativePath("a".repeat(4097))).toThrow(/4096/);
  });

  it("rejects POSIX-absolute paths", () => {
    expect(() => normalizeRelativePath("/etc/passwd")).toThrow(/absolute/);
  });

  it("rejects drive-qualified paths", () => {
    expect(() => normalizeRelativePath("C:\\Windows\\System32")).toThrow(/drive/);
    expect(() => normalizeRelativePath("c:/windows")).toThrow(/drive/);
  });

  it("rejects parent traversal", () => {
    expect(() => normalizeRelativePath("../secret")).toThrow(/escape/);
    expect(() => normalizeRelativePath("..\\secret")).toThrow(/escape/);
    expect(() => normalizeRelativePath("css/../../secret")).toThrow(/escape/);
    // After normalisation the `..` is still there only if it tried to climb
    // above the root — `a/..` alone resolves to the root and is refused too.
    expect(() => normalizeRelativePath("a/..")).toThrow(/root/);
  });

  it("rejects a path that resolves to the project root", () => {
    expect(() => normalizeRelativePath(".")).toThrow(/root/);
  });
});

describe("ignored names", () => {
  it("names the three directories Astra never touches", () => {
    expect(isIgnoredName("node_modules")).toBe(true);
    expect(isIgnoredName(".git")).toBe(true);
    expect(isIgnoredName(".astra")).toBe(true);
  });

  it("leaves project files alone", () => {
    expect(isIgnoredName("index.html")).toBe(false);
    expect(isIgnoredName(".gitignore")).toBe(false);
    expect(isIgnoredName("git")).toBe(false);
  });

  it("hides Astra's own temp files by exact shape", () => {
    // `atomicWrite` writes `.<pid>.<random>.tmp` beside its target.
    expect(isIgnoredName(".12345.abc9z1.tmp")).toBe(true);
    // But not things that merely end in .tmp, or lock files, or real dotfiles.
    expect(isIgnoredName("build-output.tmp")).toBe(false);
    expect(isIgnoredName("Cargo.lock")).toBe(false);
    expect(isIgnoredName(".editorconfig")).toBe(false);
  });

  it("sees an ignored directory anywhere in a path", () => {
    expect(isIgnoredPath("node_modules/react/index.js")).toBe(true);
    expect(isIgnoredPath("src/node_modules/x.js")).toBe(true);
    expect(isIgnoredPath("src/components/Button.tsx")).toBe(false);
  });
});

describe("lock siblings", () => {
  it("recognises a coordination lock and recovers its base", () => {
    expect(isLockSibling("index.html.lock")).toBe(true);
    expect(baseOfLockSibling("index.html.lock")).toBe("index.html");
  });

  it("leaves real files alone", () => {
    // `Cargo.lock` ends in .lock but its base is not a file Astra wrote; the
    // watcher only suppresses the sibling of a write in flight.
    expect(isLockSibling("Cargo.lock")).toBe(true);
    expect(isLockSibling("lock")).toBe(false);
    expect(isLockSibling("index.html")).toBe(false);
    expect(baseOfLockSibling("index.html")).toBe("index.html");
  });
});

describe("containment", () => {
  // Platform-appropriate shapes so the assertions hold on Windows and POSIX.
  const root = resolve("/tmp/astra-proj");
  const inside = join(root, "src", "index.ts");
  const beside = `${root}-sibling${sep}secret.txt`;
  const above = dirname(dirname(root));

  it("accepts the root itself and its descendants", () => {
    expect(isWithinRoot(root, root)).toBe(true);
    expect(isWithinRoot(root, inside)).toBe(true);
  });

  it("refuses anything above or beside the root", () => {
    expect(isWithinRoot(root, above)).toBe(false);
    expect(isWithinRoot(root, beside)).toBe(false);
  });

  it("joins contract paths under a root", () => {
    expect(joinUnderRoot(root, "src/index.ts")).toBe(inside);
  });
});

describe("toPosixPath", () => {
  it("is the identity when the separator is already `/`", () => {
    // On Windows this converts; on POSIX it must not mangle anything.
    expect(toPosixPath("a/b/c")).toBe("a/b/c");
  });
});
