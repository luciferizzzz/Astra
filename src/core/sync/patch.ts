/**
 * Surgical edits.
 *
 * Every change Astra makes is expressed as a small set of `SourceEdit`s: a
 * byte range in the original text and the replacement string. `applyEdits`
 * validates and applies them in one pass, so the caller never builds an
 * intermediate tree and the bytes around the edit are copied verbatim.
 *
 * The helpers at the bottom turn a node address into that one range. They all
 * refuse to touch a node the parser marked `unsupported`, which is how PRD
 * FR-G05 ("decline edits that would need unsupported-syntax rewriting") is
 * enforced at the last line of defence rather than only in the UI.
 */

import { escapeAttributeValue, escapeText } from "../lib/escape";
import type { SourceRange } from "../model/source";
import type { CssDocumentModel, CssNode } from "../parsers/css";
import type { HtmlDocumentModel, HtmlNode } from "../parsers/html";

/** A byte range and the text that replaces it. */
export interface SourceEdit {
  readonly range: SourceRange;
  readonly text: string;
}

/** The region that changed between two texts, expressed in both. */
export interface ChangedRegion {
  /** Range in the text before the edit. */
  readonly before: SourceRange;
  /** Range in the text after the edit. */
  readonly after: SourceRange;
}

/** Thrown when an edit is malformed or would corrupt the document. */
export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

/**
 * Applies edits to a source string.
 *
 * Edits are sorted and applied left-to-right. They must lie inside the document
 * and must not overlap: two edits touching the same byte almost always means the
 * caller computed an address from a stale model, and silently picking one would
 * corrupt the file.
 */
export function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  const sorted = [...edits].sort(
    (a, b) => a.range.start - b.range.start || a.range.end - b.range.end,
  );

  let cursor = 0;
  let output = "";
  for (const edit of sorted) {
    const { start, end } = edit.range;
    if (start < 0 || end > source.length || end < start) {
      throw new PatchError(
        `Edit range [${start}, ${end}) is outside the document (length ${source.length}).`,
      );
    }
    if (start < cursor) {
      throw new PatchError(
        `Edit range [${start}, ${end}) overlaps a previous edit ending at ${cursor}.`,
      );
    }
    output += source.slice(cursor, start) + edit.text;
    cursor = end;
  }
  output += source.slice(cursor);
  return output;
}

/**
 * Returns the smallest region that differs between two texts, or `null` when
 * they are identical.
 *
 * The implementation shrinks from both ends. For a single-range edit that is
 * exactly the range that changed, which is what the "editing must not reformat
 * untouched code" requirement (PRD FR-G03, TEST-004) needs to be checked
 * against.
 */
export function changedRegion(before: string, after: string): ChangedRegion | null {
  if (before === after) {
    return null;
  }

  const shortest = Math.min(before.length, after.length);
  let start = 0;
  while (start < shortest && before.charCodeAt(start) === after.charCodeAt(start)) {
    start += 1;
  }

  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }

  return { before: { start, end: endBefore }, after: { start, end: endAfter } };
}

/** Replaces the text of a trusted text node. */
export function patchHtmlText(
  model: HtmlDocumentModel,
  node: HtmlNode,
  newText: string,
): string {
  if (node.kind !== "text" || !node.anchor) {
    throw new PatchError("Only anchored text nodes can be patched.");
  }
  requireTrustedHtml(node);
  return applyEdits(model.source, [
    { range: node.anchor, text: escapeText(newText) },
  ]);
}

/**
 * Replaces one attribute value, keeping the author's quote style.
 *
 * `attr.anchor` covers `name="value"`, so the edit has to find the value inside
 * it. A bare attribute (no `=`) is given a quoted value, which is the only way
 * to give an attribute that had none a non-empty one.
 */
export function patchHtmlAttribute(
  model: HtmlDocumentModel,
  node: HtmlNode,
  name: string,
  newValue: string,
): string {
  if (node.kind !== "element") {
    throw new PatchError("Only element nodes carry attributes.");
  }
  requireTrustedHtml(node);

  const lower = name.toLowerCase();
  const attr = node.attrs?.find((candidate) => candidate.name === lower);
  if (!attr) {
    throw new PatchError(`<${node.tagName ?? "?"}> has no attribute named "${name}".`);
  }
  if (!attr.anchor) {
    throw new PatchError(`Attribute "${name}" has no source anchor.`);
  }

  const raw = model.source.slice(attr.anchor.start, attr.anchor.end);
  const equals = raw.indexOf("=");
  if (equals === -1) {
    return applyEdits(model.source, [
      {
        range: attr.anchor,
        text: `${raw}="${escapeAttributeValue(newValue, '"')}"`,
      },
    ]);
  }

  const afterEquals = raw.slice(equals + 1);
  const leading = /^\s*/.exec(afterEquals)?.[0] ?? "";
  const rest = afterEquals.slice(leading.length);
  const quote = rest.startsWith('"') ? '"' : rest.startsWith("'") ? "'" : "";
  const prefix = equals + 1 + leading.length + (quote ? 1 : 0);
  const suffix = quote ? 1 : 0;

  return applyEdits(model.source, [
    {
      range: {
        start: attr.anchor.start + prefix,
        end: attr.anchor.end - suffix,
      },
      text: escapeAttributeValue(newValue, quote),
    },
  ]);
}

/** Replaces the value of a trusted CSS declaration, keeping `!important`. */
export function patchCssValue(
  model: CssDocumentModel,
  declaration: CssNode,
  newValue: string,
): string {
  if (declaration.kind !== "declaration" || !declaration.valueAnchor) {
    throw new PatchError("Only anchored declarations can be patched.");
  }
  if (declaration.trust !== "trusted") {
    throw new PatchError(
      `Declaration "${declaration.prop ?? "?"}" is read-only: ${
        declaration.notes.join("; ") || "no reason recorded"
      }.`,
    );
  }
  return applyEdits(model.source, [
    { range: declaration.valueAnchor, text: newValue },
  ]);
}

function requireTrustedHtml(node: HtmlNode): void {
  if (node.trust !== "trusted") {
    throw new PatchError(
      `<${node.tagName ?? node.kind}> is read-only: ${
        node.notes.join("; ") || "no reason recorded"
      }.`,
    );
  }
}
