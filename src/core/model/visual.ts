/**
 * The visual tree — a UI-facing projection of a parsed HTML document.
 *
 * Phase 0 produced a *source* model: `HtmlDocumentModel` keeps the original
 * bytes and records where every node lives, which is what makes surgical
 * write-back possible. That model is the wrong shape for the canvas, the layer
 * tree and the inspector, though: they want a stable, addressed tree they can
 * point at, select and re-render, and they must never be able to write bytes.
 *
 * So this module builds a second structure from the first. The split is
 * deliberate:
 *
 *   - `HtmlDocumentModel` is the single source of truth for *editing*. It owns
 *     the text; changes are computed against it and spliced in by `patch.ts`.
 *   - `VisualNode` is a read-only *view* for rendering and selection. It refers
 *     to source ranges but never holds or rewrites a byte.
 *
 * Every visual node carries:
 *
 *   - a deterministic `id` (its position in the tree), so the UI has a stable
 *     handle to hang selection and to re-find a node after a reparse;
 *   - `parentId` and `depth`, so breadcrumbs and the layer tree need no
 *     back-pointers;
 *   - `editable`, derived from the source model's trust verdict: implied nodes
 *     (synthesised `html`/`head`/`body`/`tbody`) and nodes whose range is unsafe
 *     are read-only, which is how FR-G05 reaches the UI without the UI having
 *     to re-derive trust rules.
 *
 * See PRD §11.1 (module 6), §11.4 and §13 (Phase 0 → Phase 1 bridge).
 */

import type { HtmlAttribute, HtmlDocumentModel, HtmlNode } from "../parsers/html";
import type { SourceRange } from "./source";

/** The kinds of node a visual tree can contain — the source model's set. */
export type VisualNodeKind = HtmlNode["kind"];

/** A read-only, addressed node for the canvas, layer tree and inspector. */
export interface VisualNode {
  /** Deterministic path id, e.g. `root`, `root.0`, `root.0.1`. */
  readonly id: string;
  readonly kind: VisualNodeKind;
  readonly tagName?: string;
  /** Decoded text/comment value, or a doctype's name. */
  readonly value?: string;
  readonly attrs?: readonly HtmlAttribute[];
  readonly children: VisualNode[];
  readonly parentId: string | null;
  /** Distance from the root; the root is `0`. */
  readonly depth: number;
  /** Whole-node source range, when the source model reported one. */
  readonly anchor?: SourceRange;
  readonly startTag?: SourceRange;
  readonly endTag?: SourceRange;
  /** True when the parser synthesised the node: it owns no bytes. */
  readonly implied: boolean;
  /** True when the source model trusts this node's range for a surgical edit. */
  readonly editable: boolean;
  /** Why the node is read-only, for diagnostics and tooltips. */
  readonly notes: readonly string[];
}

/** The projected tree plus the flat indexes the UI consults. */
export interface VisualDocument {
  readonly language: "html";
  /** Length of the underlying source, so the UI can reason about ranges. */
  readonly sourceLength: number;
  readonly root: VisualNode;
  /** Pre-order (source order) flat list of every node. */
  readonly nodes: readonly VisualNode[];
  readonly byId: ReadonlyMap<string, VisualNode>;
  /** Nodes a surgical edit may target. */
  readonly editable: readonly VisualNode[];
  /** Nodes the editor must treat as read-only. */
  readonly readOnly: readonly VisualNode[];
}

/** The id of the tree's root, which is always the parsed document or fragment. */
export const VISUAL_ROOT_ID = "root";

/** Builds the id of a node from its parent's id and its child index. */
export function childVisualId(parentId: string, index: number): string {
  return `${parentId}.${index}`;
}

/**
 * Projects a source model into a read-only visual tree.
 *
 * Pure and side-effect free: it reads `model` but never mutates it, so it can be
 * run on every reparse (after an edit, an external change, or a code-editor
 * keystroke) without disturbing the byte-preserving state that editing depends
 * on.
 */
export function buildVisualDocument(model: HtmlDocumentModel): VisualDocument {
  const nodes: VisualNode[] = [];
  const byId = new Map<string, VisualNode>();

  const root = project(model.root, VISUAL_ROOT_ID, null, 0, nodes, byId);

  const editable: VisualNode[] = [];
  const readOnly: VisualNode[] = [];
  for (const node of nodes) {
    (node.editable ? editable : readOnly).push(node);
  }

  return {
    language: "html",
    sourceLength: model.source.length,
    root,
    nodes,
    byId,
    editable,
    readOnly,
  };
}

function project(
  node: HtmlNode,
  id: string,
  parentId: string | null,
  depth: number,
  into: VisualNode[],
  byId: Map<string, VisualNode>,
): VisualNode {
  // Built in pre-order: the node is registered before its children, so `nodes`
  // reads top-to-bottom the way the layer tree does.
  const children: VisualNode[] = [];
  const visual: VisualNode = {
    id,
    kind: node.kind,
    tagName: node.tagName,
    value: node.value,
    attrs: node.attrs,
    children,
    parentId,
    depth,
    anchor: node.anchor,
    startTag: node.startTag,
    endTag: node.endTag,
    implied: node.implied,
    editable: isEditable(node),
    notes: node.notes,
  };

  into.push(visual);
  byId.set(id, visual);

  node.children.forEach((child, index) => {
    children.push(project(child, childVisualId(id, index), id, depth + 1, into, byId));
  });

  return visual;
}

/**
 * Whether a surgical edit may target this node.
 *
 * Implied nodes own no bytes, and the parser marks a node `unsupported` when
 * its range cannot be trusted; both are read-only. An element additionally needs
 * a start-tag anchor, since that is what an attribute or text edit rewrites.
 */
function isEditable(node: HtmlNode): boolean {
  if (node.implied || node.trust !== "trusted") {
    return false;
  }
  if (node.kind === "element") {
    return node.startTag !== undefined;
  }
  return node.anchor !== undefined;
}

/** Looks a node up by id. */
export function findVisualNode(
  document: VisualDocument,
  id: string,
): VisualNode | undefined {
  return document.byId.get(id);
}

/**
 * Returns the path from the root to `id`, inclusive, for a breadcrumb.
 *
 * An unknown id yields an empty path rather than throwing: a node can vanish
 * between a reparse and a lookup, and the UI should simply show nothing.
 */
export function visualPath(document: VisualDocument, id: string): VisualNode[] {
  const path: VisualNode[] = [];
  let current = document.byId.get(id);
  while (current !== undefined) {
    path.unshift(current);
    current = current.parentId === null ? undefined : document.byId.get(current.parentId);
  }
  return path;
}

/**
 * A short, human label for a node, used by the layer tree and breadcrumb.
 *
 * Elements read like an inspector would write them — `<div#main>`,
 * `<button.primary>` — so the tree is scannable without extra chrome.
 */
export function visualLabel(node: VisualNode): string {
  switch (node.kind) {
    case "text":
      return truncate((node.value ?? "").trim()) || "#text";
    case "comment":
      return "<!-- -->";
    case "doctype":
      return node.value ? `<!doctype ${node.value}>` : "<!doctype>";
    case "document":
      return "#document";
    case "fragment":
      return "#fragment";
    case "element":
      return elementLabel(node);
  }
}

function elementLabel(node: VisualNode): string {
  const tag = node.tagName ?? "?";
  const id = node.attrs?.find((attr) => attr.name === "id")?.value;
  if (id) {
    return `<${tag}#${id}>`;
  }
  const className = node.attrs?.find((attr) => attr.name === "class")?.value?.trim().split(/\s+/)[0];
  return className ? `<${tag}.${className}>` : `<${tag}>`;
}

function truncate(value: string): string {
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}
