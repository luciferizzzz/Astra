/**
 * Path handling for the project filesystem — pure, and therefore testable
 * without touching a disk.
 *
 * Everything that crosses the IPC boundary is untrusted, and a renderer driven
 * by project markup is an assumed compromise scenario (PRD §14.4, SEC-003,
 * SEC-004, SEC-013). Two rules follow:
 *
 *   1. A relative path from the renderer is *normalised into a contract*, not
 *      merely joined onto the project root. Absolute paths, drive letters, UNC
 *      prefixes, `..` segments and NUL bytes are rejected outright — silently
 *      rewriting them would hide the attempt instead of answering it.
 *   2. Containment is decided on **canonical** paths (`realpath`), because a
 *      symlink inside the project can point anywhere. The adapter resolves the
 *      nearest existing ancestor and checks that it is still inside the root
 *      before any byte is read or written.
 *
 * Paths are addressed with forward slashes everywhere in the contract; this
 * module converts to and from the platform's separator at the boundary.
 */

import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

/** Directory names that are never listed and never watched (PRD FR-K02). */
export const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  ".astra",
]);

/**
 * Astra's own write artifacts: the temp file `atomicWrite` flushes before the
 * rename (`.<pid>.<random>.tmp`). Hidden by exact shape rather than by suffix,
 * so a project's real `*.tmp` files stay visible — the pattern is precise
 * enough that a collision with a user's file is not worth the ceremony of
 * imagining it. Ignoring it outright also covers debris from a crash.
 */
const ASTRA_TEMP_FILE_PATTERN = /^\.\d+\.[a-z0-9]+\.tmp$/;

/** Raised when a path from the caller cannot be accepted. */
export class UnsafePathError extends Error {
  constructor(reason: string) {
    super(`Unsafe project path: ${reason}`);
    this.name = "UnsafePathError";
  }
}

/** Converts a platform path to the contract's forward-slash form. */
export function toPosixPath(path: string): string {
  return sep === "\\" ? path.split(sep).join("/") : path;
}

/** True when a single directory or file name is one Astra never touches. */
export function isIgnoredName(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name) || ASTRA_TEMP_FILE_PATTERN.test(name);
}

/**
 * The sibling `atomicWrite` lock for a file being written — `<file>.lock`.
 * Not ignored by name (a project may legitimately hold a `Cargo.lock`); the
 * watcher suppresses it only while its base file is mid-write.
 */
export function isLockSibling(relativePath: string): boolean {
  return relativePath.endsWith(".lock") && relativePath.length > ".lock".length;
}

/** `index.html.lock` → `index.html`; anything else unchanged. */
export function baseOfLockSibling(relativePath: string): string {
  return isLockSibling(relativePath) ? relativePath.slice(0, -".lock".length) : relativePath;
}

/** True when any segment of a relative path lands in an ignored directory. */
export function isIgnoredPath(relativePath: string): boolean {
  return relativePath.split("/").some((segment) => isIgnoredName(segment));
}

/**
 * Validates a caller-supplied relative path and returns it in contract form.
 *
 * The empty string (meaning "the project root") is rejected here; callers that
 * accept "the root" handle it before calling, so that every path this function
 * returns names something *inside* the project.
 */
export function normalizeRelativePath(input: unknown): string {
  if (typeof input !== "string") {
    throw new UnsafePathError(`expected a string, received ${describe(input)}`);
  }
  if (input.length === 0) {
    throw new UnsafePathError("path is empty");
  }
  if (input.includes("\0")) {
    throw new UnsafePathError("path contains a NUL byte");
  }
  if (input.length > 4096) {
    throw new UnsafePathError("path exceeds 4096 characters");
  }

  // Accept either separator from the caller, but the contract speaks only
  // forward slashes from here on.
  const slashed = input.replace(/\\/g, "/");

  // A leading slash is absolute, and `C:` / `//server` are their own flavours
  // of it. None of them may name a location; the renderer addresses files by
  // their position inside the project and by nothing else.
  if (slashed.startsWith("/")) {
    throw new UnsafePathError(`absolute paths are not allowed ("${input}")`);
  }
  if (/^[a-zA-Z]:/.test(slashed)) {
    throw new UnsafePathError(`drive-qualified paths are not allowed ("${input}")`);
  }

  // `normalize` collapses `.` and interior `..` segments — but speaks the
  // platform's separator, so the contract's forward slashes are restored
  // *before* the segment checks. Skipping this on Windows would hide both the
  // slashes and the `..` behind a backslash.
  const normalized = toPosixPath(normalize(slashed));
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new UnsafePathError(`path escapes the project ("${input}")`);
  }

  const clean = segments.filter((segment) => segment !== "" && segment !== ".").join("/");
  if (clean === "") {
    throw new UnsafePathError(`path resolves to the project root ("${input}")`);
  }
  return clean;
}

/**
 * True when `target` is `root` itself or lives beneath it, decided on
 * canonical paths. Both arguments must already be `realpath`-resolved.
 */
export function isWithinRoot(root: string, target: string): boolean {
  if (root === target) return true;
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Joins a validated relative path onto a canonical root. */
export function joinUnderRoot(root: string, relativePath: string): string {
  return resolve(join(root, ...relativePath.split("/")));
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}
