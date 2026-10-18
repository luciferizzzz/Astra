/**
 * Entry-point detection: which file in a project root is "the page".
 *
 * Pure data in, pure answer out — no filesystem, no Electron — so the same
 * verdict can be reached in the main process, the renderer, and a unit test
 * without any of them owning a second copy of the rule.
 *
 * The rule itself is deliberately small and mirrors what a static file server
 * does: among the root's *files* (a directory called `index.html` is not an
 * entry), the first candidate in `ENTRY_POINT_CANDIDATES` order wins. Name
 * comparison is case-insensitive because Windows filesystems are — a project
 * authored with `Index.html` on disk is still that project's entry page.
 *
 * The answer is a `relativePath` (not a bare name) so the caller can hand it
 * straight to `selectFile`/`readTextFile`, which address the project by
 * position, never by absolute path.
 */

import type { ProjectListEntry } from "./ipc";

/** Candidate entry files, in the order a browser-style static server tries them. */
export const ENTRY_POINT_CANDIDATES = ["index.html", "index.htm"] as const;

/**
 * The entry page among `entries`, or `null` when the project has none.
 *
 * `entries` is expected to be one directory listing (the project root); the
 * function does not recurse and never will — discovering nested pages is the
 * project graph's job (FR-G11), not the entry point's.
 */
export function detectEntryPoint(entries: readonly ProjectListEntry[]): string | null {
  const files = entries.filter((entry) => entry.kind === "file");
  for (const candidate of ENTRY_POINT_CANDIDATES) {
    const match = files.find((entry) => entry.name.toLowerCase() === candidate);
    if (match) return match.relativePath;
  }
  return null;
}
