/**
 * CSS parsing that locates nodes without rewriting the stylesheet.
 *
 * The spike measured PostCSS on real-world stylesheets and found:
 *
 *   - For well-formed input `postcss.parse(source).toString()` is byte-identical
 *     to the source, so PostCSS can be trusted to *locate* nodes.
 *   - For malformed input the only way to get a tree is `postcss-safe-parser`,
 *     and that parser *repairs* the source (it inserts a missing closing brace
 *     or comment terminator). Its output is therefore not the document, and
 *     must never be written back.
 *
 * So the model keeps the original text, the byte range of every rule, at-rule,
 * comment and declaration, and the byte range of each declaration's *value*.
 * Edits are spliced into those ranges; emission is slicing, never printing.
 *
 * Declaration values are located arithmetically (start of the declaration, plus
 * the property, plus whatever separated it from the value) and then *verified*
 * against the source. When the arithmetic is wrong — IE hacks such as `*color`
 * move the start offset — we fall back to finding the raw value inside the
 * declaration, but only when that occurrence is unambiguous. Anything else is
 * marked `unsupported` and left read-only. See PRD §13 and FR-G01/G05.
 */

import postcss from "postcss";
import safeParser from "postcss-safe-parser";
import type { ChildNode, Declaration, Root, Source } from "postcss";
import {
  buildPartition,
  clamp,
  type Segment,
  type SourceRange,
} from "../model/source";

export type CssTrust = "trusted" | "unsupported";

export interface CssNode {
  kind: "root" | "rule" | "atrule" | "declaration" | "comment";
  /** At-rule name, for example `media`. */
  name?: string;
  /** Rule selector, as written. */
  selector?: string;
  /** At-rule prelude, e.g. `(min-width: 40rem)`. */
  params?: string;
  /** Declaration property, as written. */
  prop?: string;
  /** Decoded value for declarations and comments. */
  value?: string;
  /** The declaration value exactly as it appears in the source. */
  rawValue?: string;
  important?: boolean;
  /** Whole-node byte range, when the parser reported one. */
  anchor?: SourceRange;
  /** Bytes of a declaration's value, verified against the source. */
  valueAnchor?: SourceRange;
  children: CssNode[];
  trust: "trusted" | "unsupported";
  notes: string[];
}

export interface CssDocumentModel {
  language: "css";
  source: string;
  root: CssNode;
  /** Flat, source-ordered list of nodes that carry an anchor. */
  nodes: CssNode[];
  /** Every declaration in the document, in source order. */
  declarations: CssNode[];
  segments: Segment[];
  gaps: SourceRange[];
  unsupported: CssNode[];
  /** True when the strict parser rejected the input and the tolerant one ran. */
  recovered: boolean;
  /** The strict parser's message, when `recovered` is true. */
  parseError?: string;
}

/** Parses CSS into an anchor-carrying model, falling back to a tolerant parse. */
export function parseCss(source: string): CssDocumentModel {
  let root: Root;
  let recovered = false;
  let parseError: string | undefined;

  try {
    root = postcss.parse(source) as Root;
  } catch (error) {
    recovered = true;
    parseError = error instanceof Error ? error.message : String(error);
    root = safeParser(source) as Root;
  }

  const model: CssDocumentModel = {
    language: "css",
    source,
    root: toRootNode(root, recovered, source),
    nodes: [],
    declarations: [],
    segments: [],
    gaps: [],
    unsupported: [],
    recovered,
    parseError,
  };

  collectAnchored(model.root, model.nodes);
  model.nodes.sort((a, b) => (a.anchor?.start ?? 0) - (b.anchor?.start ?? 0));
  model.declarations = model.nodes.filter((node) => node.kind === "declaration");
  classify(model);
  return model;
}

/** Reconstructs the stylesheet from its anchors (byte-identical when unedited). */
export function emitCss(model: CssDocumentModel): string {
  let output = "";
  for (const segment of model.segments) {
    output += model.source.slice(segment.start, segment.end);
  }
  return output;
}

function toRootNode(root: Root, recovered: boolean, text: string): CssNode {
  return {
    kind: "root",
    children: root.nodes.map((child) => toModelNode(child, recovered, text)),
    anchor: toRange(root.source, text.length),
    trust: recovered ? "unsupported" : "trusted",
    notes: recovered ? [recoveredNote()] : [],
  };
}

function toModelNode(node: ChildNode, recovered: boolean, text: string): CssNode {
  switch (node.type) {
    case "decl":
      return toDeclaration(node, recovered, text);
    case "rule":
      return toContainer("rule", node.nodes, recovered, node.source, text, {
        selector: node.selector,
      });
    case "atrule":
      return toContainer("atrule", node.nodes, recovered, node.source, text, {
        name: node.name,
        params: node.params,
      });
    case "comment":
      return {
        kind: "comment",
        value: node.text,
        children: [],
        anchor: toRange(node.source, text.length),
        trust: recovered ? "unsupported" : "trusted",
        notes: recovered ? [recoveredNote()] : [],
      };
  }
}

function toContainer(
  kind: "rule" | "atrule",
  children: ChildNode[] | undefined,
  recovered: boolean,
  nodeSource: Source | undefined,
  text: string,
  fields: { selector?: string; name?: string; params?: string },
): CssNode {
  const modelNode: CssNode = {
    kind,
    children: (children ?? []).map((child) => toModelNode(child, recovered, text)),
    anchor: toRange(nodeSource, text.length),
    trust: recovered ? "unsupported" : "trusted",
    notes: recovered ? [recoveredNote()] : [],
  };
  if (fields.selector !== undefined) modelNode.selector = fields.selector;
  if (fields.name !== undefined) modelNode.name = fields.name;
  if (fields.params !== undefined) modelNode.params = fields.params;
  return modelNode;
}

function toDeclaration(node: Declaration, recovered: boolean, text: string): CssNode {
  const notes: string[] = recovered ? [recoveredNote()] : [];
  const anchor = toRange(node.source, text.length);
  const rawValue = node.raws.value?.raw ?? node.value;
  const between = node.raws.between ?? ":";
  const start = node.source?.start?.offset;

  let valueAnchor: { start: number; end: number } | undefined;
  if (start !== undefined && anchor !== undefined) {
    const arithmetic = start + node.prop.length + between.length;
    if (text.slice(arithmetic, arithmetic + rawValue.length) === rawValue) {
      valueAnchor = { start: arithmetic, end: arithmetic + rawValue.length };
    } else {
      // IE hacks (`*color`, `_color`) shift the recorded start offset. Recover
      // the value only when it appears exactly once in the declaration.
      const slice = text.slice(anchor.start, anchor.end);
      const index = slice.indexOf(rawValue);
      const unambiguous =
        rawValue.length > 0 &&
        index > node.prop.length &&
        slice.indexOf(rawValue, index + 1) === -1;
      if (unambiguous) {
        valueAnchor = {
          start: anchor.start + index,
          end: anchor.start + index + rawValue.length,
        };
      } else {
        notes.push("declaration value could not be located in the source");
      }
    }
  } else if (!recovered) {
    notes.push("declaration has no usable source range");
  }

  const trust =
    !recovered && anchor !== undefined && valueAnchor !== undefined
      ? "trusted"
      : "unsupported";

  return {
    kind: "declaration",
    prop: node.prop,
    value: node.value,
    rawValue,
    important: node.important === true,
    children: [],
    anchor,
    valueAnchor,
    trust,
    notes,
  };
}

function classify(model: CssDocumentModel): void {
  const ranges = model.nodes
    .map((node) => node.anchor)
    .filter((anchor): anchor is SourceRange => anchor !== undefined);

  // Containers enclose declarations, so coalescing is expected here: the goal
  // is only to show that every byte of the stylesheet is accounted for.
  model.segments = buildPartition(ranges, model.source.length);
  model.gaps = model.segments
    .filter((segment) => segment.owner === "gap")
    .map((segment) => ({ start: segment.start, end: segment.end }));
  model.unsupported = model.nodes.filter((node) => node.trust === "unsupported");
}

function collectAnchored(node: CssNode, into: CssNode[]): void {
  if (node.anchor) {
    into.push(node);
  }
  for (const child of node.children) {
    collectAnchored(child, into);
  }
}

function toRange(
  nodeSource: { start?: { offset: number }; end?: { offset: number } } | undefined,
  length: number,
): SourceRange | undefined {
  const start = nodeSource?.start?.offset;
  const end = nodeSource?.end?.offset;
  if (start === undefined || end === undefined || end <= start) {
    return undefined;
  }
  return { start: clamp(start, 0, length), end: clamp(end, start, length) };
}

function recoveredNote(): string {
  return "input needed a repairing parse; offsets are not safe to edit";
}
