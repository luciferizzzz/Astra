import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVisualDocument,
  childVisualId,
  findVisualNode,
  VISUAL_ROOT_ID,
  visualLabel,
  visualPath,
} from "@core/model/visual";
import { emitHtml, parseHtml } from "@core/parsers/html";
import { patchHtmlText } from "@core/sync/patch";

/**
 * The visual tree is a projection, not a copy. These tests pin the two things
 * that would make it unsafe as a bridge from Phase 0 to Phase 1: that it never
 * perturbs the byte-preserving source model, and that its read-only verdicts
 * agree with the parser's trust rules.
 */
describe("visual model", () => {
  function project(source: string) {
    const model = parseHtml(source);
    return { model, document: buildVisualDocument(model) };
  }

  function readFixture(name: string): string {
    return readFileSync(join(process.cwd(), "fixtures", "html", name), "utf8");
  }

  it("roots the tree at the document with no parent and depth 0", () => {
    const { document } = project("<main><h1>Hi</h1></main>");

    expect(document.root.id).toBe(VISUAL_ROOT_ID);
    expect(document.root.kind).toBe("document");
    expect(document.root.parentId).toBeNull();
    expect(document.root.depth).toBe(0);
  });

  it("does not touch the source: emission stays byte-identical after projecting", () => {
    const source = readFixture("document-malformed.html");
    const { model, document } = project(source);

    // Building the view must leave the byte-preserving model untouched.
    expect(emitHtml(model)).toBe(source);
    expect(document.sourceLength).toBe(source.length);
  });

  it("gives every node a unique id and a consistent parent/depth chain", () => {
    const { document } = project("<section><p>a</p><p>b</p></section>");

    const ids = document.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.byId.size).toBe(document.nodes.length);

    for (const node of document.nodes) {
      if (node.parentId === null) {
        expect(node).toBe(document.root);
        continue;
      }
      const parent = findVisualNode(document, node.parentId);
      if (!parent) throw new Error(`missing parent ${node.parentId} for ${node.id}`);
      expect(node.depth).toBe(parent.depth + 1);
      expect(parent.children).toContain(node);
    }
  });

  it("lists nodes in pre-order so the layer tree reads top-to-bottom", () => {
    const { document } = project("<main><h1>Hi</h1></main>");

    // html > body > main > h1, with the comment-free implied nodes included.
    const main = document.nodes.find((node) => node.tagName === "main");
    const heading = document.nodes.find((node) => node.tagName === "h1");
    if (!main || !heading) throw new Error("expected main > h1 in the projection");
    expect(document.nodes.indexOf(main)).toBeLessThan(document.nodes.indexOf(heading));
    expect(heading.id).toBe(childVisualId(main.id, 0));
  });

  it("marks implied nodes read-only and trusted anchored nodes editable", () => {
    const { document } = project("<main><h1>Hi</h1></main>");

    // `html`, `head` and `body` are synthesised by parse5: no bytes, no edits.
    for (const node of document.nodes.filter((candidate) => candidate.implied)) {
      expect(node.editable).toBe(false);
    }

    const heading = document.nodes.find((node) => node.tagName === "h1");
    expect(heading?.implied).toBe(false);
    expect(heading?.editable).toBe(true);

    const text = document.nodes.find((node) => node.kind === "text" && node.value === "Hi");
    expect(text?.editable).toBe(true);
  });

  it("surfaces the parser's unsupported nodes as read-only", () => {
    const source = readFixture("table-foster.html");
    const { model, document } = project(source);

    expect(model.unsupported.length).toBeGreaterThan(0);
    const readOnlyIds = new Set(document.readOnly.map((node) => node.id));
    for (const node of model.unsupported) {
      const match = document.nodes.find((candidate) => candidate.anchor === node.anchor);
      if (match) {
        expect(readOnlyIds.has(match.id)).toBe(true);
      }
    }
    expect(document.editable.length).toBe(document.nodes.length - document.readOnly.length);
  });

  it("builds a breadcrumb path from the root to a node", () => {
    const { document } = project("<main id=\"x\"><h1>Hi</h1></main>");

    const heading = document.nodes.find((node) => node.tagName === "h1");
    const path = visualPath(document, heading?.id ?? "");

    expect(path[0]).toBe(document.root);
    expect(path[path.length - 1]).toBe(heading);
    expect(path.map(visualLabel)).toEqual(["#document", "<html>", "<body>", "<main#x>", "<h1>"]);
  });

  it("returns an empty path for an unknown id instead of throwing", () => {
    const { document } = project("<main></main>");
    expect(visualPath(document, "root.99.99")).toEqual([]);
  });

  it("is deterministic: the same source yields the same ids every time", () => {
    const source = "<ul><li>one</li><li>two</li></ul>";
    const first = buildVisualDocument(parseHtml(source)).nodes.map((node) => node.id);
    const second = buildVisualDocument(parseHtml(source)).nodes.map((node) => node.id);
    expect(second).toEqual(first);
  });

  it("keeps ids stable across an edit that only rewrites a text value", () => {
    const source = "<main><h1>before</h1><p>keep</p></main>";
    const model = parseHtml(source);
    const heading = buildVisualDocument(model).nodes.find((node) => node.tagName === "h1");
    if (!heading) throw new Error("expected an <h1> in the projection");
    const headingId = heading.id;

    const textNode = model.nodes.find((node) => node.kind === "text" && node.value === "before");
    if (!textNode) throw new Error("expected a text node in the source model");
    const edited = patchHtmlText(model, textNode, "after");

    const rebuilt = buildVisualDocument(parseHtml(edited));
    // Same structural position, different text: the id is a path, not a hash.
    const after = findVisualNode(rebuilt, headingId);
    expect(after?.tagName).toBe("h1");
    expect(after?.children.some((child) => child.value === "after")).toBe(true);
  });

  it("labels elements with an id or the first class for a scannable tree", () => {
    const { document } = project('<a id="home" class="link primary" href="#">Go</a>');
    const anchor = document.nodes.find((node) => node.tagName === "a");
    if (!anchor) throw new Error("expected an <a> in the projection");
    expect(visualLabel(anchor)).toBe("<a#home>");
  });
});
