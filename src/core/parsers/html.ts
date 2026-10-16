/**
 * HTML parsing that never loses a byte.
 *
 * The Phase 0 spike measured what parse5 does with messy, real-world HTML and
 * found three properties the sync engine has to live with:
 *
 *   1. Implied elements (`html`, `head`, `body`, `tbody`) have no source range.
 *   2. Some bytes belong to no node at all — leading whitespace, a stray
 *      `</head>` left behind when content forced the head closed, a doctype
 *      swallowed after a byte-order mark.
 *   3. Foster parenting moves nodes: the text around a table is re-attached to
 *      `body` while its range still spans the table markup, and content after
 *      `</html>` lands in `body` with a range that runs past the closing tags.
 *
 * So we do not serialise the tree. We keep the original text, collect the
 * byte range of every start tag, end tag and leaf node, and reconstruct the
 * document by slicing those ranges in order. Bytes no node claims are kept as
 * explicit gaps. Reconstruction is byte-identical by construction, and the
 * test suite refutes that construction if any range is wrong.
 *
 * Nodes whose range cannot be trusted (a fostered text node whose slice is not
 * its value) are marked `unsupported`: they are still emitted verbatim, but
 * the editor refuses to splice edits into them. See PRD §13 and FR-G01/G05.
 */

import { parse, parseFragment } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import {
  buildPartition,
  clamp,
  type Segment,
  type SourceRange,
} from "../model/source";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;
type Parse5Template = DefaultTreeAdapterTypes.Template;

/** The subset of parse5's location info we consume. */
interface RawLocation {
  startOffset: number;
  endOffset: number;
}

interface RawElementLocation extends RawLocation {
  attrs?: Record<string, RawLocation>;
  startTag?: RawLocation;
  endTag?: RawLocation;
}

export type HtmlTrust = "trusted" | "unsupported";

export interface HtmlAttribute {
  /** Attribute name, lower-cased by the parser. */
  name: string;
  /** Decoded attribute value. */
  value: string;
  /** Bytes of `name[=value]` inside the start tag, when parse5 reported them. */
  anchor?: SourceRange;
}

export interface HtmlNode {
  kind: "document" | "fragment" | "element" | "text" | "comment" | "doctype";
  tagName?: string;
  attrs?: HtmlAttribute[];
  /** Decoded value for text and comment nodes, the name for a doctype. */
  value?: string;
  children: HtmlNode[];
  /** Whole-node byte range, when the parser reported one. */
  anchor?: SourceRange;
  /** Bytes of the start tag only. */
  startTag?: SourceRange;
  /** Bytes of the end tag only. */
  endTag?: SourceRange;
  /** True when parse5 synthesised the node: it owns no bytes. */
  implied: boolean;
  /** Whether edits may be spliced into this node's range. */
  trust: HtmlTrust;
  /** Why a node was marked unsupported (for diagnostics and tests). */
  notes: string[];
}

/** One reconstructable piece of the document. */
export interface HtmlSpan {
  node: HtmlNode;
  part: "start-tag" | "end-tag" | "self";
  anchor: SourceRange;
}

export interface HtmlDocumentModel {
  language: "html";
  source: string;
  root: HtmlNode;
  /** Every node carrying a range, ordered by source position. */
  nodes: HtmlNode[];
  /** Trusted, non-overlapping ranges that reconstruct the document. */
  spans: HtmlSpan[];
  /** Gap-free partition of `[0, source.length)`. */
  segments: Segment[];
  /** Ranges owned by no node (still emitted verbatim). */
  gaps: SourceRange[];
  /** Nodes the editor must treat as read-only. */
  unsupported: HtmlNode[];
}

/** Parses HTML into an anchor-carrying model. */
export function parseHtml(source: string): HtmlDocumentModel {
  const root = toModelNode(parse(source, { sourceCodeLocationInfo: true }), source.length);
  const nodes: HtmlNode[] = [];
  const parents = new Map<HtmlNode, HtmlNode>();
  collectAnchored(root, nodes, parents);
  nodes.sort((a, b) => (a.anchor?.start ?? 0) - (b.anchor?.start ?? 0));

  const model: HtmlDocumentModel = {
    language: "html",
    source,
    root,
    nodes,
    spans: [],
    segments: [],
    gaps: [],
    unsupported: [],
  };

  classify(model, parents);
  return model;
}

/**
 * Reconstructs the document from its anchors.
 *
 * For an unmodified model this returns the input byte-for-byte. The assert in
 * the test suite is what makes that meaningful: it fails loudly when a range is
 * missing or wrong instead of quietly dropping bytes.
 */
export function emitHtml(model: HtmlDocumentModel): string {
  let output = "";
  for (const segment of model.segments) {
    output += model.source.slice(segment.start, segment.end);
  }
  return output;
}

/** Finds the first node matching a predicate, depth-first. */
export function findHtmlNode(
  root: HtmlNode,
  predicate: (node: HtmlNode) => boolean,
): HtmlNode | undefined {
  if (predicate(root)) {
    return root;
  }
  for (const child of root.children) {
    const match = findHtmlNode(child, predicate);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function toModelNode(node: Parse5Node, sourceLength: number): HtmlNode {
  switch (node.nodeName) {
    case "#document": {
      const document = node as DefaultTreeAdapterTypes.Document;
      return container(
        "document",
        document.childNodes.map((child) => toModelNode(child, sourceLength)),
      );
    }
    case "#document-fragment": {
      const fragment = node as DefaultTreeAdapterTypes.DocumentFragment;
      return container(
        "fragment",
        fragment.childNodes.map((child) => toModelNode(child, sourceLength)),
      );
    }
    case "#text": {
      const text = node as DefaultTreeAdapterTypes.TextNode;
      const anchor = toRange(text.sourceCodeLocation, sourceLength);
      return {
        kind: "text",
        value: text.value,
        children: [],
        anchor,
        implied: anchor === undefined,
        trust: "trusted",
        notes: [],
      };
    }
    case "#comment": {
      const comment = node as DefaultTreeAdapterTypes.CommentNode;
      const anchor = toRange(comment.sourceCodeLocation, sourceLength);
      return {
        kind: "comment",
        value: comment.data,
        children: [],
        anchor,
        implied: anchor === undefined,
        trust: "trusted",
        notes: [],
      };
    }
    case "#documentType": {
      const doctype = node as DefaultTreeAdapterTypes.DocumentType;
      const anchor = toRange(doctype.sourceCodeLocation, sourceLength);
      return {
        kind: "doctype",
        value: doctype.name,
        children: [],
        anchor,
        implied: anchor === undefined,
        trust: "trusted",
        notes: [],
      };
    }
    default:
      return toElementNode(node as Parse5Element, sourceLength);
  }
}

function toElementNode(element: Parse5Element, sourceLength: number): HtmlNode {
  const location = element.sourceCodeLocation as RawElementLocation | null | undefined;
  const isTemplate = element.nodeName === "template";
  const childNodes = isTemplate
    ? (element as Parse5Template).content.childNodes
    : element.childNodes;

  return {
    kind: "element",
    tagName: element.tagName,
    attrs: element.attrs.map((attr) => ({
      name: attr.name,
      value: attr.value,
      anchor: toRange(location?.attrs?.[attr.name], sourceLength),
    })),
    children: childNodes.map((child) => toModelNode(child, sourceLength)),
    anchor: toRange(location, sourceLength),
    startTag: toRange(location?.startTag, sourceLength),
    endTag: toRange(location?.endTag, sourceLength),
    implied: location === null || location === undefined,
    trust: "trusted",
    notes: [],
  };
}

function container(kind: "document" | "fragment", children: HtmlNode[]): HtmlNode {
  return { kind, children, implied: true, trust: "trusted", notes: [] };
}

function toRange(
  location: RawLocation | null | undefined,
  sourceLength: number,
): SourceRange | undefined {
  if (!location) {
    return undefined;
  }
  // parse5 can report an end offset one past the end for an unclosed comment;
  // clamping keeps the partition inside the document.
  const start = clamp(location.startOffset, 0, sourceLength);
  const end = clamp(location.endOffset, start, sourceLength);
  if (end <= start) {
    return undefined;
  }
  return { start, end };
}

function collectAnchored(
  node: HtmlNode,
  into: HtmlNode[],
  parents: Map<HtmlNode, HtmlNode>,
): void {
  if (node.anchor) {
    into.push(node);
  }
  for (const child of node.children) {
    parents.set(child, node);
    collectAnchored(child, into, parents);
  }
}

function classify(model: HtmlDocumentModel, parents: Map<HtmlNode, HtmlNode>): void {
  const { source } = model;

  for (const node of model.nodes) {
    if (node.implied) {
      continue;
    }
    switch (node.kind) {
      case "text":
        checkText(node, source, parents.get(node)?.tagName);
        break;
      case "comment":
        checkComment(node, source);
        break;
      case "doctype":
        checkDoctype(node, source);
        break;
      case "element":
        checkElement(node, source);
        break;
      default:
        break;
    }
  }

  const spans: HtmlSpan[] = [];
  for (const node of model.nodes) {
    if (node.trust === "unsupported") {
      continue;
    }
    for (const span of spansOf(node)) {
      spans.push(span);
    }
  }

  // Any remaining overlap means two nodes claim the same bytes. The first
  // (outermost) claim wins; the other node becomes read-only rather than
  // letting the editor write the same byte twice.
  spans.sort((a, b) => a.anchor.start - b.anchor.start || b.anchor.end - a.anchor.end);
  const kept: HtmlSpan[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.anchor.start < cursor) {
      span.node.trust = "unsupported";
      span.node.notes.push("anchor overlaps another node's bytes");
      continue;
    }
    kept.push(span);
    cursor = span.anchor.end;
  }

  model.spans = kept;
  model.segments = buildPartition(
    kept.map((span) => span.anchor),
    source.length,
  );
  model.gaps = model.segments
    .filter((segment) => segment.owner === "gap")
    .map((segment) => ({ start: segment.start, end: segment.end }));
  model.unsupported = model.nodes.filter((node) => node.trust === "unsupported");
}

function spansOf(node: HtmlNode): HtmlSpan[] {
  if (node.kind === "element") {
    const spans: HtmlSpan[] = [];
    if (node.startTag) {
      spans.push({ node, part: "start-tag", anchor: node.startTag });
    }
    if (node.endTag) {
      spans.push({ node, part: "end-tag", anchor: node.endTag });
    }
    if (spans.length === 0) {
      node.trust = "unsupported";
      node.notes.push("element has no start-tag anchor");
    }
    return spans;
  }
  if (!node.anchor) {
    return [];
  }
  return [{ node, part: "self", anchor: node.anchor }];
}

/**
 * Elements whose text content is taken raw. Inside them the byte slice *is*
 * the value, so a slice that contains markup-looking text (a string literal in
 * a script) is still a faithful anchor.
 */
const RAW_TEXT_ELEMENTS = new Set([
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "noscript",
]);

function checkText(node: HtmlNode, source: string, parentTag: string | undefined): void {
  if (!node.anchor || node.value === undefined) {
    return;
  }
  const slice = source.slice(node.anchor.start, node.anchor.end);
  if (parentTag !== undefined && RAW_TEXT_ELEMENTS.has(parentTag) && slice === node.value) {
    return;
  }
  // Otherwise a genuine text anchor re-parses to exactly that one text value.
  // Fostered or re-parented text (whose range spans sibling markup) does not,
  // and is therefore read-only.
  const fragment = parseFragment(slice);
  const children = fragment.childNodes;
  const only = children.length === 1 ? children[0] : undefined;
  if (
    only === undefined ||
    only.nodeName !== "#text" ||
    (only as DefaultTreeAdapterTypes.TextNode).value !== node.value
  ) {
    node.trust = "unsupported";
    node.notes.push("text range does not re-parse to its value");
  }
}

function checkComment(node: HtmlNode, source: string): void {
  if (!node.anchor) {
    return;
  }
  const slice = source.slice(node.anchor.start, node.anchor.end);
  if (!slice.startsWith("<!--") || !slice.endsWith("-->")) {
    node.trust = "unsupported";
    node.notes.push("comment range is not a complete comment");
  }
}

function checkDoctype(node: HtmlNode, source: string): void {
  if (!node.anchor) {
    return;
  }
  const slice = source.slice(node.anchor.start, node.anchor.end);
  if (!/^<!doctype/i.test(slice)) {
    node.trust = "unsupported";
    node.notes.push("doctype range is not a doctype");
  }
}

function checkElement(node: HtmlNode, source: string): void {
  if (!node.tagName) {
    node.trust = "unsupported";
    node.notes.push("element has no tag name");
    return;
  }
  const tag = escapeRegExp(node.tagName);
  if (node.startTag) {
    const slice = source.slice(node.startTag.start, node.startTag.end);
    if (!new RegExp(`^<${tag}(\\s|/|>)`, "i").test(slice) || !slice.endsWith(">")) {
      node.trust = "unsupported";
      node.notes.push("start tag range does not begin with the tag name");
    }
  }
  if (node.endTag) {
    const slice = source.slice(node.endTag.start, node.endTag.end);
    if (!new RegExp(`^</${tag}\\s*>$`, "i").test(slice)) {
      node.trust = "unsupported";
      node.notes.push("end tag range is not a closing tag");
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
