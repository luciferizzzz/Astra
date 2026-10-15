/**
 * URL trust decisions for the main process.
 *
 * Pure by design: this module imports nothing from `electron`, so it is
 * unit-testable under Vitest. Everything the renderer may legitimately be — or
 * navigate to — is expressed as a single target, and every check reduces to a
 * comparison against that target.
 *
 * See PRD §14.4 (SEC-018: navigation and new-window denial).
 */

export interface TrustedRendererTarget {
  /** Absolute URL of the Vite dev server, e.g. `http://localhost:5173`. Absent in a packaged build. */
  readonly devServerUrl?: string;
  /** `file://` URL of the built `out/renderer/index.html`. Always present. */
  readonly fileUrl: string;
}

/**
 * True when `candidate` addresses the Astra renderer itself.
 *
 * Development: only the dev server's origin is trusted, so a redirect to some
 * other port or host is still refused.
 *
 * Production: only the exact renderer document is trusted. Any other `file://`
 * path on disk is refused, which keeps a compromised renderer from navigating
 * to an arbitrary local file and reading it back through the DOM.
 */
export function isTrustedRendererUrl(candidate: string, target: TrustedRendererTarget): boolean {
  const url = parse(candidate);
  if (!url) return false;

  if (target.devServerUrl) {
    const dev = parse(target.devServerUrl);
    if (!dev) return false;
    return url.origin === dev.origin && (url.protocol === "http:" || url.protocol === "https:");
  }

  const file = parse(target.fileUrl);
  if (!file || file.protocol !== "file:" || url.protocol !== "file:") return false;
  return normalizePathname(url) === normalizePathname(file);
}

/**
 * Windows file paths are case-insensitive, and the string Electron reports for a
 * loaded document is not guaranteed to be byte-identical to the one we built
 * with `pathToFileURL`. Comparing the decoded pathname avoids refusing our own
 * renderer over a difference in encoding.
 */
function normalizePathname(url: URL): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    decoded = url.pathname;
  }
  return process.platform === "win32" ? decoded.toLowerCase() : decoded;
}

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
