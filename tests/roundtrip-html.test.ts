import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitHtml, parseHtml } from "../src/core/parsers/html";
import { buildPartition } from "../src/core/model/source";

describe("roundtrip-html", () => {
  function roundtrip(name: string): string {
    const src = readFileSync(join(process.cwd(), "fixtures", "html", name), "utf8");
    const model = parseHtml(src);
    expect(emitHtml(model)).toBe(src);
    // coverage tiling: spans + gaps cover [0, len)
    const kept = model.spans.map((s) => s.anchor);
    const segs = buildPartition(kept, src.length);
    let cursor = 0;
    for (const s of segs) {
      expect(s.start).toBe(cursor);
      cursor = s.end;
    }
    expect(cursor).toBe(src.length);
    return src;
  }

  it("fragment-basic", () => roundtrip("fragment-basic.html"));
  it("document-malformed", () => roundtrip("document-malformed.html"));
  it("table-nested", () => roundtrip("table-nested.html"));
  it("table-foster", () => roundtrip("table-foster.html"));
  it("raw-text", () => roundtrip("raw-text.html"));
  it("entities", () => roundtrip("entities.html"));
  it("trailing-content", () => roundtrip("trailing-content.html"));
  it("template-select", () => roundtrip("template-select.html"));
  it("attributes-exotic", () => roundtrip("attributes-exotic.html"));
});
