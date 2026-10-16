import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitCss, parseCss } from "../src/core/parsers/css";
import { buildPartition } from "../src/core/model/source";

describe("roundtrip-css", () => {
  it("valid-messy", () => {
    const src = readFileSync(join(process.cwd(), "fixtures", "css", "valid-messy.css"), "utf8");
    const model = parseCss(src);
    expect(model.recovered).toBe(false);
    expect(emitCss(model)).toBe(src);
    const ranges = model.nodes
      .map((n) => n.anchor)
      .filter((a): a is { start: number; end: number } => a !== undefined);
    const segs = buildPartition(ranges, src.length);
    let cursor = 0;
    for (const s of segs) {
      expect(s.start).toBe(cursor);
      cursor = s.end;
    }
    expect(cursor).toBe(src.length);
  });

  it("hacks", () => {
    const src = readFileSync(join(process.cwd(), "fixtures", "css", "hacks.css"), "utf8");
    const model = parseCss(src);
    expect(emitCss(model)).toBe(src);
  });

  it("malformed falls back to safe parser and still emits original", () => {
    const src = readFileSync(join(process.cwd(), "fixtures", "css", "malformed.css"), "utf8");
    const model = parseCss(src);
    expect(model.recovered).toBe(true);
    expect(emitCss(model)).toBe(src);
  });

  it("comments", () => {
    const src = readFileSync(join(process.cwd(), "fixtures", "css", "comments.css"), "utf8");
    const model = parseCss(src);
    expect(emitCss(model)).toBe(src);
  });
});
