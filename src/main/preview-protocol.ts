/**
 * The canvas preview protocol — how untrusted project bytes reach the preview.
 *
 * The preview renders a real site, so it needs the site's own files: the entry
 * document, its stylesheets, scripts, images and fonts. Handing it a `file://`
 * path would let it read anything on the machine, so asset delivery goes
 * through a custom scheme that can only ever name a file *inside the open
 * project* (PRD §11.7, SEC-013).
 *
 * Everything in this module is pure: the URL grammar, the content-type table
 * and the preview's own Content-Security-Policy are values and functions that
 * can be asserted without an Electron process. The Electron-facing half —
 * registering the scheme and answering requests — is `canvas-view.ts`.
 *
 * Grammar: `astra-preview://project/<relative-path>`
 *
 *   - the host is a fixed literal, so a URL can never name another root;
 *   - the path is a project-relative path in the contract's forward-slash form;
 *   - the empty host and any other host are refused.
 */

import { UnsafePathError, normalizeRelativePath } from "./project-paths";
import type { CanvasBounds } from "../shared/ipc";

/** The scheme the preview documents are served from. */
export const PREVIEW_SCHEME = "astra-preview";

/** The only host the scheme answers on. */
export const PREVIEW_HOST = "project";

/** The origin every preview document runs as. */
export const PREVIEW_ORIGIN = `${PREVIEW_SCHEME}://${PREVIEW_HOST}`;

/** The URL the preview loads for a project-relative entry path. */
export function previewUrlFor(relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${PREVIEW_ORIGIN}/${encoded}`;
}

/**
 * True when `rawUrl` addresses the preview origin — the scheme *and* the
 * project host. Used to decide whether an in-page navigation stays inside the
 * served site; `astra-preview:` alone is not enough, because a URL naming
 * another host would be a different root (and the handler would refuse it).
 */
export function isPreviewOriginUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return url.protocol === `${PREVIEW_SCHEME}:` && url.hostname === PREVIEW_HOST;
}

/**
 * The rectangle, in whole pixels, Electron will place the view at.
 *
 * The renderer reports a `getBoundingClientRect`, which is fractional on any
 * display whose device pixel ratio is not 1 — and on exactly those displays a
 * rounded *down* view leaves a hairline gap where the UI shows through. Widths
 * and heights are clamped at zero because Electron treats a negative dimension
 * as no update at all, which would silently leave a stale rectangle on screen.
 */
export function toWholePixels(bounds: CanvasBounds): CanvasBounds {
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };
}

/** Raised when a URL does not address a file inside the open project. */
export class PreviewUrlError extends Error {
  constructor(reason: string) {
    super(`Unusable preview URL: ${reason}`);
    this.name = "PreviewUrlError";
  }
}

/**
 * Turns a preview URL back into a validated project-relative path.
 *
 * The verdict is reached by the same normaliser the filesystem adapter uses,
 * so an attempt that the adapter would refuse is refused here too — the
 * protocol is not a second, weaker door. Percent-decoding happens before the
 * normaliser deliberately: `%2e%2e%2f` must be seen as `../` and rejected, not
 * passed through as innocuous-looking text.
 */
export function relativePathFromPreviewUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PreviewUrlError(`not a URL ("${rawUrl}")`);
  }

  if (url.protocol !== `${PREVIEW_SCHEME}:`) {
    throw new PreviewUrlError(`wrong scheme ("${url.protocol}")`);
  }
  if (url.hostname !== PREVIEW_HOST) {
    throw new PreviewUrlError(`wrong host ("${url.hostname}")`);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    throw new PreviewUrlError("path is not valid percent-encoding");
  }

  const withoutLeadingSlash = decoded.startsWith("/") ? decoded.slice(1) : decoded;

  try {
    return normalizeRelativePath(withoutLeadingSlash);
  } catch (error) {
    if (error instanceof UnsafePathError) {
      throw new PreviewUrlError(error.message);
    }
    throw error;
  }
}

/**
 * Content types for the project files a site actually loads.
 *
 * A miss falls back to `application/octet-stream`, which — with the
 * `X-Content-Type-Options: nosniff` header every response carries — makes the
 * browser download rather than execute the file. Guessing text/html for an
 * unknown extension would be the unsafe direction.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  pdf: "application/pdf",
};

/** The content type for a project-relative path, by extension. */
export function contentTypeFor(relativePath: string): string {
  const dot = relativePath.lastIndexOf(".");
  const slash = relativePath.lastIndexOf("/");
  if (dot === -1 || dot < slash) return "application/octet-stream";
  const extension = relativePath.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * The policy every preview document is served with.
 *
 * Deliberately *not* the renderer's policy (`shared/csp.ts`): that one keeps
 * `frame-src 'none'` and forbids `unsafe-inline`, both of which a real site
 * needs — it is written for Astra's own UI, and this one is written for code the
 * user did not author. The two are separate on purpose, so neither has to be
 * loosened to accommodate the other.
 *
 * What it allows is exactly "the project's own files": every source expression
 * names the preview scheme, so an external CDN, font host or analytics URL is
 * blocked by construction (FR-K04, and the offline posture of the app itself).
 * A sandboxed frame reaching for `https://…` is refused by the policy, not
 * merely by the absence of a network handler.
 *
 * `'unsafe-inline'` and `'unsafe-eval'` are present, and that is a considered
 * choice rather than an oversight. Real pages are full of inline `<script>` and
 * `<style>`, and plenty of frameworks build code strings at runtime. Blocking
 * either would break the sites this canvas exists to show, and it would buy no
 * safety: the preview holds *no* privilege to escalate — no Node, no bridge,
 * no filesystem, no network — so the worst `eval` can do is run more of the
 * project's own JavaScript, which is already allowed to run.
 *
 * `'self'` is deliberately absent. The preview document is sandboxed, so it has
 * a unique opaque origin against which `'self'` matches nothing; naming the
 * scheme is both more precise and what actually works.
 */
export const PREVIEW_CSP = [
  "default-src 'none'",
  `script-src ${PREVIEW_SCHEME}: 'unsafe-inline' 'unsafe-eval' data: blob:`,
  `style-src ${PREVIEW_SCHEME}: 'unsafe-inline' data:`,
  `img-src ${PREVIEW_SCHEME}: data: blob:`,
  `font-src ${PREVIEW_SCHEME}: data:`,
  `media-src ${PREVIEW_SCHEME}: data: blob:`,
  `connect-src ${PREVIEW_SCHEME}: data: blob:`,
  `worker-src ${PREVIEW_SCHEME}: blob:`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
