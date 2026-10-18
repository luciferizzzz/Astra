/**
 * What kind of file the explorer is looking at (FR-B03).
 *
 * The distinction matters to the rest of the app, not just to a badge: HTML is
 * where structure lives, CSS where appearance does, and the image and font types
 * are the ones the canvas loads by URL. Deciding it here — purely, from the name,
 * with no filesystem access — means every surface asks the same question and
 * gets the same answer.
 *
 * Two deliberate refusals:
 *
 *   - Nothing is guessed from content. A `.html` file that does not parse is
 *     still an HTML file; a file with an unrecognised extension is honestly
 *     "other" rather than assumed to be text.
 *   - The preprocessor extensions the MVP does not support (`.scss`, `.ts`,
 *     `.tsx`, `.jsx` — see `OQ-005`) are classified as "other" rather than
 *     promoted to CSS or JavaScript. The tree still shows them, badge and all,
 *     and opening one is treated as plain text.
 */

export type FileKindId = "html" | "css" | "javascript" | "json" | "image" | "font" | "other";

export interface FileKind {
  readonly id: FileKindId;
  /** Human name, for titles and labels. */
  readonly label: string;
  /** The short badge the narrow tree can afford; not an icon font. */
  readonly badge: string;
  /**
   * Whether the file is worth opening as text.
   *
   * The known binary types — raster images and font binaries — are excluded so
   * the editor never fills with mojibake. Everything else is attempted: a
   * misjudged file fails the read and is reported as unreadable (FR-B06), which
   * is a better answer than refusing it by extension.
   */
  readonly textual: boolean;
}

const KIND_BY_EXTENSION: Readonly<Record<string, FileKindId>> = {
  html: "html",
  htm: "html",
  xhtml: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  // Scalable vector graphics is both: presented as an image, but text on disk.
  svg: "image",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  ico: "image",
  woff: "font",
  woff2: "font",
  ttf: "font",
  otf: "font",
  eot: "font",
};

const LABELS: Readonly<Record<FileKindId, string>> = {
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  json: "JSON",
  image: "Image",
  font: "Font",
  other: "Other",
};

/** Nothing wider than this fits the badge column without truncating. */
const MAX_BADGE_LENGTH = 4;

/** The lower-cased extension of a file name, or `""` when it has none. */
export function extensionOf(fileName: string): string {
  const base = fileName.slice(Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  // `dot <= 0` also rejects a leading dot: ".gitignore" is a name, not the
  // "gitignore" extension.
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/** The badge shown for an extension: its upper-cased form, clipped to fit. */
export function badgeFor(extension: string): string {
  return extension === "" ? "—" : extension.slice(0, MAX_BADGE_LENGTH).toUpperCase();
}

/** Classifies a file by name alone. Never throws, never reads the disk. */
export function classifyFile(fileName: string): FileKind {
  const extension = extensionOf(fileName);
  const id = KIND_BY_EXTENSION[extension] ?? "other";
  return {
    id,
    label: LABELS[id],
    badge: badgeFor(extension),
    // SVG is an image by kind and text by content; the badge and the editor
    // disagree on purpose and both are right.
    textual: extension === "svg" || (id !== "image" && id !== "font"),
  };
}
